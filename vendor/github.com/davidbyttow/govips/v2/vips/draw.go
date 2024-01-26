package vips

// #include "draw.h"
import "C"

// https://libvips.github.io/libvips/API/current/libvips-draw.html#vips-draw-rect
func vipsDrawRect(in *C.VipsImage, color ColorRGBA, left int, top int, width int, height int, fill bool) error {
	incOpCounter("draw_rect")

	fillBit := 0
	if fill {
		fillBit = 1
	}

	if err := C.draw_rect(in, C.double(color.R), C.double(color.G), C.double(color.B), C.double(color.A),
		C.int(left), C.int(top), C.int(width), C.int(height), C.int(fillBit)); err != 0 {
		return handleImageError(in)
	}

	return nil
}
