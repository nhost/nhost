package image

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"sync"
	"sync/atomic"

	"github.com/davidbyttow/govips/v2/vips"
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
)

type Options struct {
	Height         int
	Width          int
	Blur           float64
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
	}
	return ""
}

type Transformer struct {
	workers chan struct{}
	pool    sync.Pool
}

func NewTransformer() *Transformer {
	if atomic.CompareAndSwapInt32(&initialized, 0, 1) {
		vips.LoggingSettings(nil, vips.LogLevelWarning)
		vips.Startup(nil)
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

func export(image *vips.ImageRef, opts Options) ([]byte, error) {
	var b []byte
	var err error

	switch opts.Format {
	case ImageTypeJPEG:
		ep := vips.NewJpegExportParams()
		ep.Quality = opts.Quality
		b, _, err = image.ExportJpeg(ep)
	case ImageTypePNG:
		ep := vips.NewPngExportParams()
		b, _, err = image.ExportPng(ep)
	case ImageTypeWEBP:
		ep := vips.NewWebpExportParams()
		ep.Quality = opts.Quality
		b, _, err = image.ExportWebp(ep)
	case ImageTypeAVIF:
		ep := vips.NewAvifExportParams()
		ep.Quality = opts.Quality
		b, _, err = image.ExportAvif(ep)
	}

	return b, err //nolint: wrapcheck
}

func processImage(image *vips.ImageRef, opts Options) error {
	if opts.Width > 0 || opts.Height > 0 {
		width := opts.Width
		height := opts.Height

		if width == 0 {
			width = int((float64(height) / float64(image.Height())) * float64(image.Width()))
		}

		if height == 0 {
			height = int((float64(width) / float64(image.Width())) * float64(image.Height()))
		}

		if err := image.Thumbnail(width, height, vips.InterestingCentre); err != nil {
			return fmt.Errorf("failed to thumbnail: %w", err)
		}
	}

	if opts.Blur > 0 {
		if err := image.GaussianBlur(opts.Blur); err != nil {
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
	// this is to avoid processing too many images at the same time in order to save memory
	<-t.workers
	defer func() { t.workers <- struct{}{} }()

	buf, _ := t.pool.Get().(*bytes.Buffer)
	defer t.pool.Put(buf)
	defer buf.Reset()

	if length > math.MaxUint32 {
		panic("length is too big")
	}
	if l := int(length); buf.Len() < l {
		buf.Grow(l)
	}

	_, err := io.Copy(buf, orig)
	if err != nil {
		panic(err)
	}

	image, err := vips.NewImageFromBuffer(buf.Bytes())
	if err != nil {
		return fmt.Errorf("failed to load image: %w", err)
	}
	defer image.Close()

	if err := processImage(image, opts); err != nil {
		return err
	}

	b, err := export(image, opts)
	if err != nil {
		return fmt.Errorf("failed to export: %w", err)
	}

	if _, err = modified.Write(b); err != nil {
		return fmt.Errorf("failed to write: %w", err)
	}

	return nil
}
