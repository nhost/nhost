package image_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"strings"
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
			sum:      "dea3f92d5cfbee43a4478365af5592095c178bcdf04de05086a8ad8bf52969dc",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeAVIF},
		},
		{
			name:     "jpeg to avif, no image manipulation",
			filename: "testdata/nhost.jpg",
			sum:      "8118dc49d72f8d7e24bc79665c35a5d21a0635cf20829007fb458c43bc15555b",
			size:     17784,
			options:  image.Options{Format: image.ImageTypeAVIF},
		},
		{
			name:     "heic",
			filename: "testdata/nhost.heic",
			sum:      "8fe3cccb5b2114877e074e69930278850e16c6a3c4ec99a7575b140a23b93157",
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
			sum:      "a97acda63296b073c47c602f45b2932654bc6432845e015978bf2b822bf65dff",
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
			sum:      "019126f1bfcee5ba2a439e3035068d09f731f9e67f757a013be52389afe503ad",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC},
		},
	}

	transformer := image.NewTransformer(0, 0, 0)

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

func TestRunRejectsOversizedExplicitOptions(t *testing.T) {
	t.Parallel()

	const (
		maxDimension = 100
		maxBlurSigma = 10
	)

	transformer := image.NewTransformer(1, maxDimension, maxBlurSigma)

	err := transformer.Run(
		strings.NewReader("not an image"),
		12,
		io.Discard,
		image.Options{
			Width:  maxDimension + 1,
			Height: maxDimension + 1,
			Blur:   maxBlurSigma + 1,
			Format: image.ImageTypeJPEG,
		},
	)
	if !errors.Is(err, image.ErrOptionsOutOfRange) {
		t.Fatalf("expected ErrOptionsOutOfRange, got %v", err)
	}
}

func TestManipulateRejectsOversizedDerivedDimension(t *testing.T) {
	t.Parallel()

	// When only one dimension is requested the other is derived from the
	// source aspect ratio. testdata/nhost.jpg is 678x258 (landscape), so a
	// bounded height of maxDimension derives a width of maxDimension*678/258
	// ~= 2.6x larger. That derived width is the one dimension the controller
	// cannot check, so the transformer must reject it (the same
	// memory-exhaustion DoS as an explicit oversized request).
	const (
		maxDimension  = 200
		nhostJPGBytes = 33399
	)

	transformer := image.NewTransformer(1, maxDimension, 0)

	orig, err := os.Open("testdata/nhost.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer orig.Close()

	var out bytes.Buffer

	// Only the height is requested; the wider dimension is derived.
	err = transformer.Run(
		orig,
		nhostJPGBytes,
		&out,
		image.Options{Height: maxDimension, Format: image.ImageTypeJPEG},
	)
	if !errors.Is(err, image.ErrDimensionsTooLarge) {
		t.Fatalf("expected ErrDimensionsTooLarge, got %v", err)
	}
}

func TestValidateOptions(t *testing.T) {
	t.Parallel()

	const (
		maxDimension = 100
		maxBlurSigma = 10
	)

	transformer := image.NewTransformer(1, maxDimension, maxBlurSigma)

	cases := []struct {
		name         string
		opts         image.Options
		wantErr      bool
		wantContains []string
	}{
		{
			name:         "empty options pass",
			opts:         image.Options{},
			wantErr:      false,
			wantContains: nil,
		},
		{
			name: "values exactly at the limit pass",
			opts: image.Options{
				Width:  maxDimension,
				Height: maxDimension,
				Blur:   maxBlurSigma,
			},
			wantErr:      false,
			wantContains: nil,
		},
		{
			name:         "width over max is rejected",
			opts:         image.Options{Width: maxDimension + 1},
			wantErr:      true,
			wantContains: []string{"width", "100"},
		},
		{
			name:         "height over max is rejected",
			opts:         image.Options{Height: maxDimension + 1},
			wantErr:      true,
			wantContains: []string{"height", "100"},
		},
		{
			name:         "blur over max is rejected",
			opts:         image.Options{Blur: maxBlurSigma + 1},
			wantErr:      true,
			wantContains: []string{"blur", "10"},
		},
		{
			name: "multiple violations are all reported",
			opts: image.Options{
				Width:  maxDimension + 1,
				Height: maxDimension + 1,
				Blur:   maxBlurSigma + 1,
			},
			wantErr:      true,
			wantContains: []string{"width", "height", "blur"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := transformer.ValidateOptions(tc.opts)

			if !tc.wantErr {
				if err != nil {
					t.Fatalf("expected no error, got %v", err)
				}

				return
			}

			if !errors.Is(err, image.ErrOptionsOutOfRange) {
				t.Fatalf("expected ErrOptionsOutOfRange, got %v", err)
			}

			for _, want := range tc.wantContains {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("expected error %q to contain %q", err.Error(), want)
				}
			}
		})
	}
}

func BenchmarkManipulate(b *testing.B) {
	transformer := image.NewTransformer(0, 0, 0)

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
