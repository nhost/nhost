package controller

import (
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/image"
)

type dummyImageParams struct {
	f *api.OutputImageFormat
}

func (d dummyImageParams) GetH() *int                   { return nil }
func (d dummyImageParams) GetW() *int                   { return nil }
func (d dummyImageParams) GetB() *float32               { return nil }
func (d dummyImageParams) GetQ() *int                   { return nil }
func (d dummyImageParams) GetF() *api.OutputImageFormat { return d.f }

func TestChooseImageFormat_AutoAcceptHeaderSanitization(t *testing.T) {
	t.Parallel()

	autoFormat := api.Auto
	params := dummyImageParams{f: &autoFormat}

	tests := []struct {
		name           string
		sourceMime     string
		acceptHeaders  []string
		expectedFormat image.ImageType
	}{
		{
			name:       "Firefox Accept header with spaces after comma",
			sourceMime: "image/jpeg",
			acceptHeaders: []string{
				"image/avif, image/webp, image/png, image/svg+xml, */*;q=0.8",
			},
			expectedFormat: image.ImageTypeAVIF,
		},
		{
			name:       "Chrome Accept header with quality weights",
			sourceMime: "image/jpeg",
			acceptHeaders: []string{
				"image/avif;q=0.9,image/webp;q=0.8,image/apng,*/*;q=0.8",
			},
			expectedFormat: image.ImageTypeAVIF,
		},
		{
			name:       "Safari Accept header favoring WebP with parameters",
			sourceMime: "image/jpeg",
			acceptHeaders: []string{
				"image/webp;q=0.9, image/png;q=0.8, image/*;q=0.5",
			},
			expectedFormat: image.ImageTypeWEBP,
		},
		{
			name:       "Accept header with parameters and leading/trailing whitespace",
			sourceMime: "image/png",
			acceptHeaders: []string{
				"  image/webp;q=0.7  ,  image/jpeg;q=0.5  ",
			},
			expectedFormat: image.ImageTypeWEBP,
		},
		{
			name:       "No modern format accepted - falls back to source image format",
			sourceMime: "image/jpeg",
			acceptHeaders: []string{
				"image/gif, image/tiff;q=0.8",
			},
			expectedFormat: image.ImageTypeJPEG,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			orig, chosen, err := chooseImageFormat(params, tc.sourceMime, tc.acceptHeaders)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if chosen != tc.expectedFormat {
				t.Fatalf("expected format %v, got %v (original format: %v)", tc.expectedFormat, chosen, orig)
			}
		})
	}
}
