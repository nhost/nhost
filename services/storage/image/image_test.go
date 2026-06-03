package image_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	stdimage "image"
	_ "image/jpeg" // register the JPEG decoder for image.DecodeConfig
	"io"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/image"
)

func TestManipulate(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		filename string
		sum      string
		size     uint64
		options  image.Options
	}{
		{
			name:     "jpg",
			filename: "testdata/nhost.jpg",
			sum:      "6180baf39820a0ac3aa32a862517271deedfd0c80bcfdb5bd2744e4079ba83e1",
			size:     33399,
			options: image.Options{
				Height:  100,
				Width:   300,
				Blur:    2,
				Quality: 50,
				Format:  image.ImageTypeJPEG,
			},
		},
		{
			name:     "jpg",
			filename: "testdata/nhost.jpg",
			sum:      "983f8c573c125e447679e0f2d7a9bcb6ea1608ae48b09c1f953b7597ee74181a",
			size:     33399,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeJPEG},
		},
		{
			name:     "png",
			filename: "testdata/nhost.png",
			sum:      "d538212aa74ad1d17261bc2126e60964e6d2dc1c7898ea3b9f9bd3b5bc94b380",
			size:     68307,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypePNG},
		},
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			sum:      "11848414f628bec47db284e646e24385420d22bae5760ceacf1180e150b0c021",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeWEBP},
		},
		{
			name:     "jpg only blur",
			filename: "testdata/nhost.jpg",
			sum:      "382cd51a0b0dc899ccbfb7757dbe9299b18dfe6b417be30ef6909299393aafea",
			size:     33399,
			options:  image.Options{Blur: 2, Format: image.ImageTypeJPEG},
		},
		{
			name:     "webp to avif",
			filename: "testdata/nhost.webp",
			sum:      "e0a5fb177567987b16b379ce2f263cc319c4f7f5e7145c9ae81682b02c7a9f6d",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeAVIF},
		},
		{
			name:     "jpeg to avif, no image manipulation",
			filename: "testdata/nhost.jpg",
			sum:      "cd3f0137250dcc145ee9f1e63733c30bccfc6ad1c058b2be719ea9e8148029db",
			size:     17784,
			options:  image.Options{Format: image.ImageTypeAVIF},
		},
		{
			name:     "heic",
			filename: "testdata/nhost.heic",
			sum:      "60f53adc17faf5868ab155ad92b67b3cd47fa60d99f3450e53ecc6cc0976e219",
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
			name:     "jpeg to heic",
			filename: "testdata/nhost.jpg",
			sum:      "8ce5b758bfd6f78f8dc170c41f817e0e9d696aebda8d9b1d2e6766c4f58647c7",
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
			name:     "webp to heic",
			filename: "testdata/nhost.webp",
			sum:      "812a1f6953a2fbfcaa9e584398b8ff7733e66110d2d18534f854ac598b398870",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC},
		},
	}

	transformer := image.NewTransformer(0)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			orig, err := os.Open(tc.filename)
			if err != nil {
				t.Fatal(err)
			}
			defer orig.Close()

			hasher := sha256.New()
			// f, _ := os.OpenFile("/tmp/nhost-test."+tc.name, os.O_WRONLY|os.O_CREATE, 0o644)
			// defer f.Close()
			// if err := transformer.Run(slog.Default(), orig, tc.size, f, tc.options); err != nil {
			if err := transformer.Run(
				orig, tc.size, hasher, tc.options,
			); err != nil {
				t.Fatal(err)
			}

			got := hex.EncodeToString(hasher.Sum(nil))
			if !cmp.Equal(got, tc.sum) {
				t.Error(cmp.Diff(got, tc.sum))
			}
		})
	}
}

func TestManipulateClampsOversizedDimensions(t *testing.T) {
	t.Parallel()

	// libvips allocates the full output buffer up front, so honouring an
	// oversized request verbatim (e.g. 50000x50000) attempts a multi-GB
	// allocation and can OOM-kill the process (memory-exhaustion DoS). The
	// transformer must cap the output dimensions instead.
	const (
		requested     = 50000
		maxDimension  = 8000 // keep in sync with image.maxImageDimension
		nhostJPGBytes = 33399
	)

	transformer := image.NewTransformer(1)

	orig, err := os.Open("testdata/nhost.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer orig.Close()

	var out bytes.Buffer
	if err := transformer.Run(
		orig,
		nhostJPGBytes,
		&out,
		image.Options{Width: requested, Height: requested, Format: image.ImageTypeJPEG},
	); err != nil {
		t.Fatal(err)
	}

	cfg, _, err := stdimage.DecodeConfig(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatalf("failed to decode transformed image: %v", err)
	}

	if cfg.Width > maxDimension || cfg.Height > maxDimension {
		t.Errorf(
			"output dimensions %dx%d exceed the cap of %d: clamp not applied",
			cfg.Width, cfg.Height, maxDimension,
		)
	}

	if cfg.Width == requested || cfg.Height == requested {
		t.Errorf(
			"output honoured the unclamped request: %dx%d",
			cfg.Width, cfg.Height,
		)
	}
}

func BenchmarkManipulate(b *testing.B) {
	transformer := image.NewTransformer(0)

	orig, err := os.Open("testdata/nhost.jpg")
	if err != nil {
		b.Fatal(err)
	}
	defer orig.Close()

	for range 100 {
		_, _ = orig.Seek(0, 0)

		if err := transformer.Run(
			orig,
			33399,
			io.Discard,
			image.Options{Width: 300, Height: 100, Blur: 1.5, Format: image.ImageTypeJPEG},
		); err != nil {
			b.Fatal(err)
		}
	}
}
