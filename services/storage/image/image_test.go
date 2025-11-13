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
			sum:      "0a3f081bd296958cfc99297ee9fb4cc2e5a1b22bebfded81c6e00e25caf84f36",
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
			sum:      "cd9857da2c40b6c46d39abd0f18def2c9879c2a06a1702c131c17b2bfdb43268",
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
			sum:      "720eebe382c26b5fb8abf8552f282317074a4c9f6467aa8a60bb93a20f55e063",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeWEBP},
		},
		{
			name:     "jpg only blur",
			filename: "testdata/nhost.jpg",
			sum:      "0b038c3afbe8a848974874aad4fb11983d45ab84d9113eb4260c4ed34d2d03d6",
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
			sum:      "1a2ab1930eef77710d35254a6fbd3e59f60b929070c44e47d0c6043e05b5ab99",
			size:     12968,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC, Quality: 50},
		},
		{
			name:     "jpeg to heic",
			filename: "testdata/nhost.jpg",
			sum:      "870fcccf978667bafdab18ebd5ff2816c2947563cf2718e0b944aed2b3379b0d",
			size:     33399,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeHEIC, Quality: 50},
		},
		{
			name:     "webp to heic",
			filename: "testdata/nhost.webp",
			sum:      "34f36705183310f9a88f147aca2905a872981920e93e9ab9714413185b395aa1",
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
