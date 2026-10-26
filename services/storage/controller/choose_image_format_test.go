package controller

import (
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/image"
)

func TestChooseImageFormatAuto(t *testing.T) {
	t.Parallel()

	auto := api.Auto

	cases := []struct {
		name         string
		acceptHeader []string
		want         image.ImageType
	}{
		{
			name:         "chrome avif",
			acceptHeader: []string{"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"},
			want:         image.ImageTypeAVIF,
		},
		{
			name:         "firefox webp with spaces",
			acceptHeader: []string{"image/webp, image/png, image/svg+xml, */*;q=0.8"},
			want:         image.ImageTypeWEBP,
		},
		{
			name:         "webp with q parameter",
			acceptHeader: []string{"image/webp;q=0.9, image/png;q=0.8"},
			want:         image.ImageTypeWEBP,
		},
		{
			name:         "safari webp with spaces and params",
			acceptHeader: []string{"image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5"},
			want:         image.ImageTypeWEBP,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			f := auto
			params := api.GetFileParams{F: &f}

			_, got, apiErr := chooseImageFormat(params, "image/jpeg", tc.acceptHeader)
			if apiErr != nil {
				t.Fatalf("unexpected error: %v", apiErr)
			}
			if got != tc.want {
				t.Errorf("got image type %d, want %d", got, tc.want)
			}
		})
	}
}
