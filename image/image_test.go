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
	}{
		{
			name:     "jpg",
			filename: "testdata/nhost.jpg",
			sum:      "a93c06cc06da9cd982d3f1a519d042870ad58b44d9069c40049b0693e64634e6",
		},
		{
			name:     "png",
			filename: "testdata/nhost.png",
			sum:      "ac7da45c3a994e50fdbc25123992b31116d32f20dac2c5436d2d6fdbfd319853",
		},
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			sum:      "0e58269cbdf904af89c54d119e0b5db6761f4c5f0514f47b72422c03b4cbb0da",
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
			if err := transformer.Run(orig, hasher, image.Options{Width: 300, Height: 100, Blur: 2}); err != nil {
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
	for i := 0; i < 100; i++ {
		orig, err := os.Open("testdata/nhost.jpg")
		if err != nil {
			b.Fatal(err)
		}
		defer orig.Close()

		if err := transformer.Run(orig, io.Discard, image.Options{Width: 300, Height: 100}); err != nil {
			b.Fatal(err)
		}
	}
}
