package vips

// #include "create.h"
import "C"

// https://libvips.github.io/libvips/API/current/libvips-create.html#vips-xyz
func vipsXYZ(width int, height int) (*C.VipsImage, error) {
	var out *C.VipsImage

	if err := C.xyz(&out, C.int(width), C.int(height)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// http://libvips.github.io/libvips/API/current/libvips-create.html#vips-black
func vipsBlack(width int, height int) (*C.VipsImage, error) {
	var out *C.VipsImage

	if err := C.black(&out, C.int(width), C.int(height)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-create.html#vips-identity
func vipsIdentity(ushort bool) (*C.VipsImage, error) {
	var out *C.VipsImage
	ushortInt := C.int(boolToInt(ushort))
	if err := C.identity(&out, ushortInt); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
