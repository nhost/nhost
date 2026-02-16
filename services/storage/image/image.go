package image //nolint:revive

import (
	"bytes"
	"fmt"
	"io"
	"sync"
	"sync/atomic"

	"github.com/cshum/vipsgen/vips"
)

const (
	maxWorkers = 3
)

type ImageType int //nolint:revive

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
	pool    sync.Pool
}

func NewTransformer() *Transformer {
	if atomic.CompareAndSwapInt32(&initialized, 0, 1) {
		vips.Startup(&vips.Config{ //nolint:exhaustruct
			ConcurrencyLevel: 1,
			MaxCacheFiles:    0,
			MaxCacheMem:      0,
			MaxCacheSize:     0,
			VectorEnabled:    true,
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

func export(image *vips.Image, opts Options) ([]byte, error) {
	switch opts.Format {
	case ImageTypeJPEG:
		jpegOpts := vips.DefaultJpegsaveBufferOptions()
		jpegOpts.Q = opts.Quality

		return image.JpegsaveBuffer(jpegOpts) //nolint: wrapcheck
	case ImageTypePNG:
		pngOpts := vips.DefaultPngsaveBufferOptions()

		return image.PngsaveBuffer(pngOpts) //nolint: wrapcheck
	case ImageTypeWEBP:
		webpOpts := vips.DefaultWebpsaveBufferOptions()
		webpOpts.Q = opts.Quality

		return image.WebpsaveBuffer(webpOpts) //nolint: wrapcheck
	case ImageTypeAVIF:
		heifOpts := vips.DefaultHeifsaveBufferOptions()
		heifOpts.Q = opts.Quality
		heifOpts.Bitdepth = 8
		heifOpts.Effort = 0
		heifOpts.Compression = vips.HeifCompressionAv1

		return image.HeifsaveBuffer(heifOpts) //nolint: wrapcheck
	case ImageTypeHEIC:
		heifOpts := vips.DefaultHeifsaveBufferOptions()
		heifOpts.Q = opts.Quality
		heifOpts.Bitdepth = 8
		heifOpts.Compression = vips.HeifCompressionHevc

		return image.HeifsaveBuffer(heifOpts) //nolint: wrapcheck
	default:
		return nil, fmt.Errorf("unsupported format: %d", opts.Format) //nolint: err113
	}
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

	if opts.FormatChanged() {
		if err := image.Autorot(nil); err != nil {
			return fmt.Errorf("failed to auto-rotate: %w", err)
		}
	}

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
) error {
	<-t.workers
	defer func() { t.workers <- struct{}{} }()

	buf, _ := t.pool.Get().(*bytes.Buffer)
	defer t.pool.Put(buf)
	defer buf.Reset()

	if l := int(length); buf.Cap() < l { //nolint:gosec
		buf.Grow(l)
	}

	if _, err := io.Copy(buf, orig); err != nil {
		return fmt.Errorf("failed to read image: %w", err)
	}

	image, err := vips.NewImageFromBuffer(buf.Bytes(), nil)
	if err != nil {
		return fmt.Errorf("failed to load image: %w", err)
	}

	defer image.Close()

	if err := imagePipeline(image, opts); err != nil {
		return err
	}

	b, err := export(image, opts)
	if err != nil {
		return fmt.Errorf("failed to export: %w", err)
	}

	if _, err := modified.Write(b); err != nil {
		return fmt.Errorf("failed to write: %w", err)
	}

	return nil
}
