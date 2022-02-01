package image_test

import (
	"context"
	"crypto/sha256"
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
		hash     []byte
	}{
		{
			name:     "jpg",
			filename: "testdata/nhost.jpg",
			hash: []byte{
				0x04, 0xe0, 0x9f, 0x14, 0x03, 0xe1, 0x31, 0xec,
				0x13, 0xc0, 0x64, 0x82, 0x2f, 0xae, 0x33, 0x7e,
				0x3a, 0x2f, 0x13, 0x32, 0x4a, 0xfb, 0x08, 0x92,
				0x6f, 0x44, 0x04, 0xb0, 0x2d, 0x91, 0xdf, 0x4c,
			},
		},
		{
			name:     "png",
			filename: "testdata/nhost.png",
			hash: []byte{
				0xac, 0x21, 0x3b, 0x07, 0x53, 0xf3, 0xd9, 0xb9,
				0xe5, 0xac, 0xac, 0xea, 0x55, 0x7b, 0x51, 0x89,
				0x2c, 0xb5, 0xdf, 0xde, 0x3f, 0x2c, 0xab, 0xf9,
				0xe9, 0x7a, 0x83, 0xa3, 0x6d, 0x8a, 0x93, 0x2c,
			},
		},
		{
			name:     "webp",
			filename: "testdata/nhost.webp",
			hash: []byte{
				0x2c, 0xae, 0x57, 0x24, 0xda, 0x19, 0x49, 0xc9,
				0xd9, 0xdd, 0x20, 0x6a, 0xd1, 0xa6, 0x6c, 0xe3,
				0x08, 0xf3, 0xcd, 0x56, 0x0a, 0x1c, 0x23, 0x5c,
				0x79, 0x47, 0xae, 0x4c, 0x33, 0x4e, 0x54, 0x48,
			},
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

			got := hasher.Sum(nil)
			if !cmp.Equal(got, tc.hash) {
				t.Error(cmp.Diff(got, tc.hash))
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
