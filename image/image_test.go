package image_test

import (
	"context"
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
			sum:      "e3d7eec66c0c934cf234e78b34b311b7b26962088220b1062f7fe8e26026d946",
		},
		// png is disabled because metadata contains info that causes the sum to change every time
		// {
		// 	name:     "png",
		// 	filename: "testdata/nhost.png",
		// 	sum:      "ac213b0753f3d9b9e5acacea557b51892cb5dfde3f2cabf9e97a83a36d8a932c",
		// },
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			sum:      "f1467434921394f1bf77f06c9df6800997d385fa93d4a2914eed8a37abef4584",
		},
	}

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
			if err := image.Manipulate(context.Background(), orig, hasher, image.WithNewSize(300, 100)); err != nil {
				t.Fatal(err)
			}

			got := fmt.Sprintf("%x", hasher.Sum(nil))
			if !cmp.Equal(got, tc.sum) {
				t.Error(cmp.Diff(got, tc.sum))
			}
		})
	}
}

// requires "golang.org/x/image/draw"
// for benchmarking.
// func resizePureGo(orig io.Reader, modified io.Writer, newSizeX, newSizeY int) error {
// 	// Decode the image (from PNG to image.Image):
// 	src, err := jpeg.Decode(orig)
// 	if err != nil {
// 		return fmt.Errorf("problem decoding image: %w", err)
// 	}

// 	dst := stdlibImage.NewRGBA(
// 		stdlibImage.Rect(0, 0, newSizeX, newSizeY),
// 	)

// 	draw.ApproxBiLinear.Scale(dst, dst.Rect, src, src.Bounds(), draw.Over, nil)

// 	// Encode to `output`:
// 	if err := jpeg.Encode(modified, dst, &jpeg.Options{Quality: 100}); err != nil {
// 		return fmt.Errorf("problem encoding image: %w", err)
// 	}

// 	return nil
// }

func BenchmarkManipulate(b *testing.B) {
	for i := 0; i < 100; i++ {
		orig, err := os.Open("testdata/nhost.jpg")
		if err != nil {
			b.Fatal(err)
		}
		defer orig.Close()

		if err := image.Manipulate(context.Background(), orig, io.Discard, image.WithNewSize(300, 100)); err != nil {
			b.Fatal(err)
		}
	}
}

// func BenchmarkManipulatePureGo(b *testing.B) {
// 	for i := 0; i < 100; i++ {
// 		orig, err := os.Open("testdata/nhost.jpg")
// 		if err != nil {
// 			b.Fatal(err)
// 		}
// 		defer orig.Close()

// 		if err := resizePureGo(orig, io.Discard, 300, 100); err != nil {
// 			b.Fatal(err)
// 		}
// 	}
// }

// func BenchmarkManipulateMagicWand(b *testing.B) {
// 	for i := 0; i < 100; i++ {
// 		orig, err := os.Open("testdata/nhost.jpg")
// 		if err != nil {
// 			b.Fatal(err)
// 		}
// 		defer orig.Close()

// 		if err := resizePureGo(orig, io.Discard, 300, 100); err != nil {
// 			b.Fatal(err)
// 		}
// 	}
// }
