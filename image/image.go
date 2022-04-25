package image

import (
	"bytes"
	"fmt"
	"io"

	"github.com/davidbyttow/govips/v2/vips"
)

const (
	maxWorkers = 3
	buffSize   = 5 << 20
)

type Options struct {
	Height  int
	Width   int
	Blur    float64
	Quality int
}

func (o Options) IsEmpty() bool {
	return o.Height == 0 && o.Width == 0 && o.Blur == 0 && o.Quality == 0
}

type Transformer struct {
	workers chan struct{}
}

func NewTransformer() *Transformer {
	vips.Startup(&vips.Config{
		ConcurrencyLevel: 1,
		MaxCacheFiles:    0,
		MaxCacheMem:      0,
		MaxCacheSize:     0,
	})
	vips.LoggingSettings(nil, vips.LogLevelWarning)

	workers := make(chan struct{}, maxWorkers)
	for i := 0; i < maxWorkers; i++ {
		workers <- struct{}{}
	}
	return &Transformer{workers: workers}
}

func (t *Transformer) Shutdown() {
	vips.Shutdown()
}

func (t *Transformer) loadImage(b []byte, opts Options) (*vips.ImageRef, error) {
	var image1 *vips.ImageRef
	var err error
	if opts.Width != 0 || opts.Height != 0 {
		image1, err = vips.LoadThumbnailFromBuffer(
			b, opts.Width, opts.Height, vips.InterestingCentre, vips.SizeBoth, nil,
		)
	} else {
		image1, err = vips.NewImageFromBuffer(b)
	}
	if err != nil {
		return nil, fmt.Errorf("problem loading image: %w", err)
	}
	return image1, nil
}

func (t *Transformer) Run(orig io.Reader, modified io.Writer, opts Options) error {
	<-t.workers
	defer func() { t.workers <- struct{}{} }()

	buf := bytes.NewBuffer(make([]byte, 0, buffSize))

	_, err := io.Copy(buf, orig)
	if err != nil {
		panic(err)
	}

	image1, err := t.loadImage(buf.Bytes(), opts)
	if err != nil {
		return err
	}
	defer image1.Close()

	params := &vips.ExportParams{}

	if opts.Quality != 0 {
		params.Quality = opts.Quality
	}

	if opts.Blur != 0 {
		if err := image1.GaussianBlur(opts.Blur); err != nil {
			return fmt.Errorf("problem blurring image: %w", err)
		}
	}

	b, _, err := image1.Export(params)
	if err != nil {
		return fmt.Errorf("problem exporting image: %w", err)
	}

	if _, err := modified.Write(b); err != nil {
		return fmt.Errorf("problem writing image: %w", err)
	}

	return nil
}
