package controller

import (
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/image"
)

type imageFormatParams struct {
	f *api.OutputImageFormat
}

func (p imageFormatParams) GetH() *int       { return nil }
func (p imageFormatParams) GetW() *int       { return nil }
func (p imageFormatParams) GetB() *float32   { return nil }
func (p imageFormatParams) GetQ() *int       { return nil }
func (p imageFormatParams) GetF() *api.OutputImageFormat {
	return p.f
}

func TestChooseImageFormatAutoAcceptHeader(t *testing.T) {
	t.Parallel()

	auto := api.Auto
	params := imageFormatParams{f: &auto}
	acceptHeader := []string{
		"image/avif, image/webp, image/apng, image/svg+xml, image/*,*/*;q=0.8",
	}

	_, format, err := chooseImageFormat(params, "image/jpeg", acceptHeader)
	if err != nil {
		t.Fatalf("chooseImageFormat: %v", err)
	}
	if format != image.ImageTypeAVIF {
		t.Fatalf("format = %v, want %v", format, image.ImageTypeAVIF)
	}
}

func TestNormalizeAcceptMediaTypes(t *testing.T) {
	t.Parallel()

	got := normalizeAcceptMediaTypes(" image/webp;q=0.8,image/avif")
	want := []string{"image/webp", "image/avif"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
