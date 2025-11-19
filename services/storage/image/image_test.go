package image_test

import (
	"crypto/sha256"
	"encoding/hex"
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
			sum:      "3cffeb9c31e624970f6b6e440213a9805c4ecf56052268631d1add81f9fde37b",
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
			sum:      "131c9a8f0dfb0aa345bb498a314da97711b5f3c146e572c02d62d09ace22db7b",
			size:     33399,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeJPEG},
		},
		{
			name:     "png",
			filename: "testdata/nhost.png",
			sum:      "ac7da45c3a994e50fdbc25123992b31116d32f20dac2c5436d2d6fdbfd319853",
			size:     68307,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypePNG},
		},
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			sum:      "e9e2342f901aa447ebd32ee4ef5a6f89f007f8d692350ec45b7f02b727cc043b",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeWEBP},
		},
		{
			name:     "jpg only blur",
			filename: "testdata/nhost.jpg",
			sum:      "e359c19b3a708cfce10577d7b67f7372ddc57b478dcfc5c34b7d49e63bd13a86",
			size:     33399,
			options:  image.Options{Blur: 2, Format: image.ImageTypeJPEG},
		},
		{
			name:     "webp to avif",
			filename: "testdata/nhost.webp",
			sum:      "44ae1c37353bcd8db71df35120be7c6c22435d258ccb3248662bd4fd181b7cf0",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeAVIF},
		},
		{
			name:     "jpeg to avif, no image manipulation",
			filename: "testdata/nhost.jpg",
			sum:      "3c03519a14713701db1eaab77dae305b5484f20baacac9625294dd6952446062",
			size:     17784,
			options:  image.Options{Format: image.ImageTypeAVIF},
		},
		{
			name:     "heic",
			filename: "testdata/nhost.heic",
			sum:      "621a8cac7292d02342e699b11db69b1b5b6f55cb09ce06006a53f9cff7727a98",
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
			sum:      "c564a40516e3c6f39a8b5d1ba934f3007512d9766630fd512a4c268a0c0b4cb8",
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
			sum:      "f1d3ebb85e83f70b4d283b30e5c2f765a9f8847b7dceae3d40907aab16b93004",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC},
		},
	}

	transformer := image.NewTransformer()

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
			// if err := transformer.Run(orig, tc.size, f, tc.options); err != nil {
			if err := transformer.Run(orig, tc.size, hasher, tc.options); err != nil {
				t.Fatal(err)
			}

			got := hex.EncodeToString(hasher.Sum(nil))
			if !cmp.Equal(got, tc.sum) {
				t.Error(cmp.Diff(got, tc.sum))
			}
		})
	}
}

func BenchmarkManipulate(b *testing.B) {
	transformer := image.NewTransformer()

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
