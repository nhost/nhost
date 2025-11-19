package image

import (
	"fmt"
	"io"
	"sync/atomic"

	"github.com/cshum/vipsgen/vips"
)

const (
	maxWorkers = 3
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
	switch o.Format {
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

	return ""
}

type Transformer struct {
	workers chan struct{}
}

func NewTransformer() *Transformer {
	if atomic.CompareAndSwapInt32(&initialized, 0, 1) {
		vips.Startup(nil)
	}

	workers := make(chan struct{}, maxWorkers)
	for range maxWorkers {
		workers <- struct{}{}
	}

	return &Transformer{
		workers: workers,
	}
}

func (t *Transformer) Shutdown() {
	vips.Shutdown()
}

type readCloserAdapter struct {
	io.Reader
}

func (r readCloserAdapter) Close() error {
	if closer, ok := r.Reader.(io.Closer); ok {
		return closer.Close() //nolint: wrapcheck
	}

	return nil
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
	length uint64, //nolint:revive
	modified io.Writer,
	opts Options,
) error {
	// Limit concurrent processing to avoid processing too many images at the same time
	<-t.workers
	defer func() { t.workers <- struct{}{} }()

	// Create streaming source from io.Reader
	// This avoids loading the entire file into a buffer!
	source := vips.NewSource(readCloserAdapter{orig})
	defer source.Close()

	image, err := vips.NewImageFromSource(source, nil)
	if err != nil {
		return fmt.Errorf("failed to load image from source: %w", err)
	}

	defer image.Close()

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

	return nil
}
