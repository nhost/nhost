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
			sum:      "74868ab5a0e944f8db1ff021af11af3eb84e273516383b984761184ddffd9936",
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
			sum:      "a37c9b734caff0cbcb98c56b42443020ad71c86f0ec9f3401bcfe7df0b5c6280",
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
			sum:      "d731b20cbfb6b064e4c4d25db0608c40ab9dcec773cee301393bd332bcf5b300",
			size:     17784,
			options:  image.Options{Width: 300, Height: 100, Blur: 2, Format: image.ImageTypeWEBP},
		},
		{
			name:     "jpg only blur",
			filename: "testdata/nhost.jpg",
			sum:      "dc72277490497dc9b3ca900e5d2797b99a23797a3bcfbc7418f60f9d4c058fe9",
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
