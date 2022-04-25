package vips

// #include "morphology.h"
import "C"

// https://libvips.github.io/libvips/API/current/libvips-morphology.html#vips-rank
func vipsRank(in *C.VipsImage, width int, height int, index int) (*C.VipsImage, error) {
	incOpCounter("rank")
	var out *C.VipsImage

	err := C.rank(in, &out, C.int(width), C.int(height), C.int(index))
	if int(err) != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
