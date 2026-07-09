package image //nolint:revive

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/cshum/vipsgen/vips"
)

// ErrDimensionsTooLarge is returned by Run when the output dimensions — an
// explicit width/height or a dimension derived from the source aspect ratio —
// exceed the configured maximum. The controller maps it to a 400 so the caller
// learns the limit instead of receiving an unexpectedly sized image.
var ErrDimensionsTooLarge = errors.New("output dimensions exceed the maximum")

// ErrOptionsOutOfRange is returned by ValidateOptions when an explicitly
// requested width, height or blur exceeds the configured maximum. The controller
// maps it to a 400 so the caller learns the limit instead of receiving an image
// at an unexpected size.
var ErrOptionsOutOfRange = errors.New("image manipulation parameters out of range")

type ImageType int //nolint:revive

var initialized int32 //nolint: gochecknoglobals

const (
	ImageTypeJPEG ImageType = iota
	ImageTypePNG
	ImageTypeWEBP
	ImageTypeAVIF
	ImageTypeHEIC
)

const (
	// DefaultMaxImageDimension is the default upper bound for the width and
	// height an image may be resized to. libvips allocates the full output
	// buffer up front, so an unbounded dimension lets a single (potentially
	// unauthenticated) request exhaust process memory. Operators can override
	// it through NewTransformer.
	DefaultMaxImageDimension = 8000
	// DefaultMaxBlurSigma is the default upper bound for the Gaussian blur
	// sigma; the convolution kernel grows with sigma, so an unbounded value
	// exhausts CPU and memory. Operators can override it through NewTransformer.
	DefaultMaxBlurSigma = 250
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
	workers      chan struct{}
	pool         sync.Pool
	maxDimension int
	maxBlurSigma float64
}

// NewTransformer builds a Transformer. maxDimension and maxBlurSigma bound the
// output size and blur sigma to keep a single request from exhausting memory;
// any value <= 0 falls back to DefaultMaxImageDimension / DefaultMaxBlurSigma.
func NewTransformer(maxWorkers, maxDimension int, maxBlurSigma float64) *Transformer {
	if maxWorkers <= 0 {
		maxWorkers = 2 * runtime.GOMAXPROCS(0) //nolint:mnd
	}

	if maxDimension <= 0 {
		maxDimension = DefaultMaxImageDimension
	}

	if maxBlurSigma <= 0 {
		maxBlurSigma = DefaultMaxBlurSigma
	}

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
		maxDimension: maxDimension,
		maxBlurSigma: maxBlurSigma,
	}
}

func (t *Transformer) Shutdown() {
	vips.Shutdown()
}

// ValidateOptions rejects a request whose explicitly requested width, height or
// blur exceeds the configured maximum, returning ErrOptionsOutOfRange. It is
// called before the source is downloaded so an oversized explicit request never
// reaches libvips. A dimension derived from the source aspect ratio cannot be
// computed without the image, so that one is checked later in Run; this keeps all
// limit logic in this package rather than splitting it into the controller.
func (t *Transformer) ValidateOptions(opts Options) error {
	var problems []string

	if opts.Width > t.maxDimension {
		problems = append(
			problems,
			fmt.Sprintf("width %d exceeds the maximum of %d", opts.Width, t.maxDimension),
		)
	}

	if opts.Height > t.maxDimension {
		problems = append(
			problems,
			fmt.Sprintf("height %d exceeds the maximum of %d", opts.Height, t.maxDimension),
		)
	}

	if float64(opts.Blur) > t.maxBlurSigma {
		problems = append(
			problems,
			fmt.Sprintf("blur %g exceeds the maximum of %g", opts.Blur, t.maxBlurSigma),
		)
	}

	if len(problems) == 0 {
		return nil
	}

	return fmt.Errorf("%w: %s", ErrOptionsOutOfRange, strings.Join(problems, "; "))
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

// resolveDimensions resolves the requested output dimensions against the
// source image size, deriving a missing dimension from the aspect ratio. The
// explicit width and height are validated up front by ValidateOptions; only a
// dimension derived here from the source aspect ratio can exceed maxDimension
// without that check seeing it, since derivation can amplify a single bounded
// dimension past the cap. Only that derived value is checked, and an oversized
// one is rejected with ErrDimensionsTooLarge: libvips allocates the full output
// buffer up front, so it would otherwise let one request exhaust process memory.
func resolveDimensions(
	reqWidth, reqHeight, srcWidth, srcHeight, maxDimension int,
) (int, int, error) {
	width, height := reqWidth, reqHeight

	if width == 0 && srcHeight != 0 {
		width = int((float64(height) / float64(srcHeight)) * float64(srcWidth))
		if width > maxDimension {
			return 0, 0, dimensionsTooLargeError(width, height, maxDimension)
		}
	}

	if height == 0 && srcWidth != 0 {
		height = int((float64(width) / float64(srcWidth)) * float64(srcHeight))
		if height > maxDimension {
			return 0, 0, dimensionsTooLargeError(width, height, maxDimension)
		}
	}

	return width, height, nil
}

func dimensionsTooLargeError(width, height, maxDimension int) error {
	return fmt.Errorf(
		"%w: resizing to %dx%d exceeds the maximum dimension of %d",
		ErrDimensionsTooLarge, width, height, maxDimension,
	)
}

func (t *Transformer) imageResize(image *vips.Image, opts Options) error {
	if opts.Width <= 0 && opts.Height <= 0 {
		return nil
	}

	width, height, err := resolveDimensions(
		opts.Width, opts.Height, image.Width(), image.Height(), t.maxDimension,
	)
	if err != nil {
		return err
	}

	thumbnailOpts := vips.DefaultThumbnailImageOptions()
	thumbnailOpts.Crop = vips.InterestingCentre
	thumbnailOpts.Height = height

	if err := image.ThumbnailImage(width, thumbnailOpts); err != nil {
		return fmt.Errorf("failed to thumbnail: %w", err)
	}

	return nil
}

func (t *Transformer) imagePipeline(image *vips.Image, opts Options) error {
	if err := t.imageResize(image, opts); err != nil {
		return err
	}

	if opts.FormatChanged() {
		if err := image.Autorot(nil); err != nil {
			return fmt.Errorf("failed to auto-rotate: %w", err)
		}
	}

	if opts.Blur > 0 {
		// The controller rejects an oversized blur sigma before the request
		// reaches the transformer (there is no derived blur to amplify it, so
		// unlike the resize dimensions it needs no enforcement here).
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
	// caller may call this one but we also do it ourselves as it's cheap
	// and we need to ensure limits
	if err := t.ValidateOptions(opts); err != nil {
		return err
	}

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

	if err := t.imagePipeline(image, opts); err != nil {
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
