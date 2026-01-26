package image

/*
#cgo pkg-config: vips
#include <vips/vips.h>
*/
import "C"

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"

	"github.com/cshum/vipsgen/vips"
)

// shutdownThread clears the libvips cache for the current thread.
// This helps release thread-local memory when a goroutine finishes
// processing images. Should be called when done with image operations.
func shutdownThread() {
	C.vips_thread_shutdown()
}

const (
	// maxWorkers limits concurrent image processing to control memory usage.
	// Each worker processing a large image (e.g., 70MP) can use ~300MB of RSS.
	// With 3 workers and large images, expect up to ~900MB peak memory.
	// The C allocator typically doesn't return this memory to the OS after processing.
	// Reduce this value if you need tighter memory control (at cost of throughput).
	maxWorkers    = 3
	maxMemory     = 50 * 1024 * 1024 // 50MB - VIPS operation cache limit
	maxCache      = 100              // max 100 cached operations
	maxCacheFiles = 0                // no file caching
)

type ImageType int //nolint: revive

var initialized int32 //nolint: gochecknoglobals

const (
	ImageTypeJPEG ImageType = iota
	ImageTypePNG
	ImageTypeWEBP
	ImageTypeAVIF
	ImageTypeHEIC
)

type Options struct {
	Height         int
	Width          int
	Blur           float32
	Quality        int
	OriginalFormat ImageType
	Format         ImageType
}

func (o Options) IsEmpty() bool {
	return o.Height == 0 && o.Width == 0 && o.Blur == 0 && o.Quality == 0 &&
		o.OriginalFormat == o.Format
}

func (o Options) FormatChanged() bool {
	return o.OriginalFormat != o.Format
}

func (o Options) FormatMimeType() string {
	switch o.Format {
	case ImageTypeJPEG:
		return "image/jpeg"
	case ImageTypePNG:
		return "image/png"
	case ImageTypeWEBP:
		return "image/webp"
	case ImageTypeAVIF:
		return "image/avif"
	case ImageTypeHEIC:
		return "image/heic"
	}

	return ""
}

func (o Options) FileExtension() string {
	return imageTypeToString(o.Format)
}

func imageTypeToString(t ImageType) string {
	switch t {
	case ImageTypeJPEG:
		return "jpeg"
	case ImageTypePNG:
		return "png"
	case ImageTypeWEBP:
		return "webp"
	case ImageTypeAVIF:
		return "avif"
	case ImageTypeHEIC:
		return "heic"
	}

	return "unknown"
}

type Transformer struct {
	workers chan struct{}
	pool    sync.Pool
}

func NewTransformer() *Transformer {
	if atomic.CompareAndSwapInt32(&initialized, 0, 1) {
		vips.Startup(&vips.Config{ //nolint:exhaustruct
			ConcurrencyLevel: maxWorkers,
			MaxCacheFiles:    maxCacheFiles,
			MaxCacheMem:      maxMemory,
			MaxCacheSize:     maxCache,
		})
	}

	workers := make(chan struct{}, maxWorkers)
	for range maxWorkers {
		workers <- struct{}{}
	}

	return &Transformer{
		workers: workers,
		pool: sync.Pool{
			New: func() any {
				return new(bytes.Buffer)
			},
		},
	}
}

func (t *Transformer) Shutdown() {
	vips.Shutdown()
}

type writeCloserAdapter struct {
	io.Writer
}

func (w writeCloserAdapter) Close() error {
	if closer, ok := w.Writer.(io.Closer); ok {
		return closer.Close() //nolint: wrapcheck
	}

	return nil
}

func exportToTarget(image *vips.Image, target *vips.Target, opts Options) error {
	quality := opts.Quality
	if quality == 0 {
		quality = 75
	}

	var err error
	switch opts.Format {
	case ImageTypeJPEG:
		jpegOpts := vips.DefaultJpegsaveTargetOptions()
		jpegOpts.Q = quality
		err = image.JpegsaveTarget(target, jpegOpts)
	case ImageTypePNG:
		pngOpts := vips.DefaultPngsaveTargetOptions()
		err = image.PngsaveTarget(target, pngOpts)
	case ImageTypeWEBP:
		webpOpts := vips.DefaultWebpsaveTargetOptions()
		webpOpts.Q = quality
		err = image.WebpsaveTarget(target, webpOpts)
	case ImageTypeAVIF:
		heifOpts := vips.DefaultHeifsaveTargetOptions()
		heifOpts.Q = quality
		heifOpts.Compression = vips.HeifCompressionAv1
		err = image.HeifsaveTarget(target, heifOpts)
	case ImageTypeHEIC:
		heifOpts := vips.DefaultHeifsaveTargetOptions()
		heifOpts.Q = quality
		heifOpts.Compression = vips.HeifCompressionHevc
		err = image.HeifsaveTarget(target, heifOpts)
	default:
		return fmt.Errorf("unsupported format: %d", opts.Format) //nolint: err113
	}

	return err //nolint: wrapcheck
}

func imageResize(image *vips.Image, opts Options) error {
	if opts.Width > 0 || opts.Height > 0 {
		width := opts.Width
		height := opts.Height

		if width == 0 {
			width = int((float64(height) / float64(image.Height())) * float64(image.Width()))
		}

		if height == 0 {
			height = int((float64(width) / float64(image.Width())) * float64(image.Height()))
		}

		thumbnailOpts := vips.DefaultThumbnailImageOptions()
		thumbnailOpts.Crop = vips.InterestingCentre
		thumbnailOpts.Height = height

		if err := image.ThumbnailImage(width, thumbnailOpts); err != nil {
			return fmt.Errorf("failed to thumbnail: %w", err)
		}
	}

	return nil
}

func imagePipeline(image *vips.Image, opts Options) error {
	if err := imageResize(image, opts); err != nil {
		return err
	}

	// Auto-rotate when converting formats to ensure correct display
	if opts.FormatChanged() {
		if err := image.Autorot(nil); err != nil {
			return fmt.Errorf("failed to auto-rotate: %w", err)
		}
	}

	// Apply blur if specified
	if opts.Blur > 0 {
		if err := image.Gaussblur(float64(opts.Blur), nil); err != nil {
			return fmt.Errorf("failed to blur: %w", err)
		}
	}

	return nil
}

func (t *Transformer) Run(
	orig io.Reader,
	length uint64,
	modified io.Writer,
	opts Options,
	logger *slog.Logger,
) error {
	// Limit concurrent processing to avoid processing too many images at the same time
	<-t.workers
	defer func() { t.workers <- struct{}{} }()

	// Get a buffer from the pool to read the image into.
	// This reuses buffers to reduce memory fragmentation and allocator pressure.
	buf, _ := t.pool.Get().(*bytes.Buffer)
	defer t.pool.Put(buf)
	defer buf.Reset()

	// Pre-grow buffer if we know the size
	if length > 0 && buf.Cap() < int(length) {
		buf.Grow(int(length))
	}

	// Read the entire image into the buffer
	if _, err := io.Copy(buf, orig); err != nil {
		return fmt.Errorf("failed to read image: %w", err)
	}

	// Load image from buffer (more predictable memory behavior than streaming)
	image, err := vips.NewImageFromBuffer(buf.Bytes(), nil)
	if err != nil {
		return fmt.Errorf("failed to load image from buffer: %w", err)
	}
	defer image.Close()

	// Check for interlace/progressive encoding (can affect memory during decode)
	interlaced := false
	if val, err := image.GetInt("interlace"); err == nil && val != 0 {
		interlaced = true
	}

	// Log image metadata to help diagnose memory issues
	logger.Info("processing image",
		slog.Uint64("file_size_bytes", length),
		slog.Int("width", image.Width()),
		slog.Int("height", image.Height()),
		slog.Int("bands", image.Bands()),
		slog.Int("interpretation", int(image.Interpretation())),
		slog.String("original_format", imageTypeToString(opts.OriginalFormat)),
		slog.String("target_format", imageTypeToString(opts.Format)),
		slog.Int("target_width", opts.Width),
		slog.Int("target_height", opts.Height),
		slog.Bool("will_resize", opts.Width > 0 || opts.Height > 0),
		slog.Bool("will_autorotate", opts.FormatChanged()),
		slog.Float64("blur", float64(opts.Blur)),
		slog.Bool("interlaced", interlaced),
		slog.Any("vips_fields", image.GetFields()),
	)

	// Apply additional processing (auto-rotate, blur)
	if err := imagePipeline(image, opts); err != nil {
		return err
	}

	// Export with streaming target
	target := vips.NewTarget(writeCloserAdapter{modified})
	defer target.Close()

	if err := exportToTarget(image, target, opts); err != nil {
		return fmt.Errorf("failed to export: %w", err)
	}

	// Release thread-local caches to reduce memory holding
	shutdownThread()

	return nil
}
