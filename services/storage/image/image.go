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

// loadImage loads an image from buffer, using ThumbnailBuffer for resize operations
// (more memory efficient) or NewImageFromBuffer for other operations.
func (t *Transformer) loadImage(data []byte, opts Options) (*vips.Image, error) {
	// Use ThumbnailBuffer when resizing is needed - it's much more memory efficient
	// because it shrinks while decoding, never loading the full image into memory.
	if opts.Width > 0 || opts.Height > 0 {
		return t.loadWithThumbnail(data, opts)
	}

	// For operations without resizing (format conversion, blur only),
	// we need to load the full image
	img, err := vips.NewImageFromBuffer(data, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to load image: %w", err)
	}

	return img, nil
}

// applyTransforms applies auto-rotation and blur to the image.
func applyTransforms(image *vips.Image, opts Options) error {
	// Auto-rotate based on EXIF orientation when converting formats.
	// ThumbnailBuffer already handles this, but for non-resize paths we need to do it explicitly.
	if opts.FormatChanged() && opts.Width <= 0 && opts.Height <= 0 {
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
	buf, _ := t.pool.Get().(*bytes.Buffer)
	defer t.pool.Put(buf)
	defer buf.Reset()

	if length > 0 && buf.Cap() < int(length) {
		buf.Grow(int(length))
	}

	if _, err := io.Copy(buf, orig); err != nil {
		return fmt.Errorf("failed to read image: %w", err)
	}

	image, err := t.loadImage(buf.Bytes(), opts)
	if err != nil {
		return err
	}
	defer image.Close()

	logImageMetadata(logger, length, image, opts)

	if err := applyTransforms(image, opts); err != nil {
		return err
	}

	target := vips.NewTarget(writeCloserAdapter{modified})
	defer target.Close()

	if err := exportToTarget(image, target, opts); err != nil {
		return fmt.Errorf("failed to export: %w", err)
	}

	shutdownThread()

	return nil
}

func logImageMetadata(logger *slog.Logger, length uint64, image *vips.Image, opts Options) {
	logger.Debug("processing image",
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
	)
}

// loadWithThumbnail uses vips_thumbnail_buffer which is optimized for memory efficiency.
// It shrinks the image while decoding, never loading the full resolution into memory.
func (t *Transformer) loadWithThumbnail(data []byte, opts Options) (*vips.Image, error) {
	width := opts.Width
	height := opts.Height

	// ThumbnailBuffer needs at least a width
	if width == 0 {
		width = 10000000 // Very large number - height will constrain
	}

	thumbOpts := vips.DefaultThumbnailBufferOptions()
	thumbOpts.Height = height

	// Only crop when BOTH dimensions are specified - this means the user wants
	// to fill a specific aspect ratio. When only one dimension is given,
	// resize proportionally without cropping.
	if opts.Width > 0 && opts.Height > 0 {
		thumbOpts.Crop = vips.InterestingCentre
	}

	// Auto-rotate based on EXIF orientation (NoRotate = false means DO auto-rotate)
	thumbOpts.NoRotate = false

	img, err := vips.NewThumbnailBuffer(data, width, thumbOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to create thumbnail: %w", err)
	}

	return img, nil
}
