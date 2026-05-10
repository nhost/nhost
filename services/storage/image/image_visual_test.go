package image_test

import (
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/services/storage/image"
)

// TestManipulateVisual writes transformer outputs to
// $NHOST_VISUAL_DIR (default $TMPDIR/nhost-visual) so the encoded files
// can be inspected by hand. The storage check derivation has an
// extraCheck that copies $TMPDIR/nhost-visual into $out/visual after
// tests run, so `make check` leaves the outputs at result/visual/*.
func TestManipulateVisual(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		filename string
		ext      string
		size     uint64
		options  image.Options
	}{
		{
			name:     "jpg",
			filename: "testdata/nhost.jpg",
			ext:      "jpg",
			size:     33399,
			options: image.Options{
				Height:  100,
				Width:   300,
				Blur:    2,
				Format:  image.ImageTypeJPEG,
				Quality: 50,
			},
		},
		{
			name:     "png",
			filename: "testdata/nhost.png",
			ext:      "png",
			size:     50333,
			options:  image.Options{Height: 100, Width: 300, Blur: 2, Format: image.ImageTypePNG},
		},
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			ext:      "webp",
			size:     17784,
			options: image.Options{
				Height:  100,
				Width:   300,
				Blur:    2,
				Format:  image.ImageTypeWEBP,
				Quality: 50,
			},
		},
		{
			name:     "webp_to_avif",
			filename: "testdata/nhost.webp",
			ext:      "avif",
			size:     17784,
			options:  image.Options{Format: image.ImageTypeAVIF},
		},
		{
			name:     "heic",
			filename: "testdata/nhost.heic",
			ext:      "heic",
			size:     12968,
			options: image.Options{
				Width:   300,
				Height:  100,
				Blur:    2,
				Format:  image.ImageTypeHEIC,
				Quality: 50,
			},
		},
		{
			name:     "jpeg_to_heic",
			filename: "testdata/nhost.jpg",
			ext:      "heic",
			size:     33399,
			options: image.Options{
				Width:   300,
				Height:  100,
				Blur:    2,
				Format:  image.ImageTypeHEIC,
				Quality: 50,
			},
		},
		{
			name:     "webp_to_heic",
			filename: "testdata/nhost.webp",
			ext:      "heic",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC},
		},
	}

	outDir := os.Getenv("NHOST_VISUAL_DIR")
	if outDir == "" {
		outDir = filepath.Join(os.TempDir(), "nhost-visual")
	}

	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	t.Logf("writing outputs to %s", outDir)

	transformer := image.NewTransformer(0)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			orig, err := os.Open(tc.filename)
			if err != nil {
				t.Fatal(err)
			}
			defer orig.Close()

			outPath := filepath.Join(outDir, tc.name+"."+tc.ext)

			out, err := os.Create(outPath)
			if err != nil {
				t.Fatal(err)
			}
			defer out.Close()

			if err := transformer.Run(orig, tc.size, io.Writer(out), tc.options); err != nil {
				t.Fatal(err)
			}

			t.Logf("wrote %s", outPath)
		})
	}
}
