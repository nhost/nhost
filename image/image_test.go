package image_test

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-storage/image"
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
			sum:      "609365ae9f099954d90270f1c4ba19fed1bf54094d7b6495dc93b4d0ebae9211",
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
			sum:      "d57de01e6c966a0802bbb558392e973fd28399bc3617a0a8f4c25942f3988b4f",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeWEBP},
		},
		{
			name:     "jpg only blur",
			filename: "testdata/nhost.jpg",
			sum:      "c534df8fcf66240a63b561b1d628e05fa02baad44aac4c8a93550080c2a159f1",
			size:     33399,
			options:  image.Options{Blur: 2, Format: image.ImageTypeJPEG},
		},
	}

	transformer := image.NewTransformer()

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			orig, err := os.Open(tc.filename)
			if err != nil {
				t.Fatal(err)
			}
			defer orig.Close()

			hasher := sha256.New()
			// f, _ := os.OpenFile("/tmp/nhost-test."+tc.name, os.O_WRONLY|os.O_CREATE, 0o644)
			if err := transformer.Run(orig, tc.size, hasher, tc.options); err != nil {
				t.Fatal(err)
			}

			got := fmt.Sprintf("%x", hasher.Sum(nil))
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
	for i := 0; i < 100; i++ {
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
