package vips

// #include "convolution.h"
import "C"

// https://libvips.github.io/libvips/API/current/libvips-convolution.html#vips-gaussblur
func vipsGaussianBlur(in *C.VipsImage, sigma, minAmpl float64) (*C.VipsImage, error) {
	incOpCounter("gaussblur")
	var out *C.VipsImage

	if err := C.gaussian_blur_image(in, &out, C.double(sigma), C.double(minAmpl)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-convolution.html#vips-sharpen
func vipsSharpen(in *C.VipsImage, sigma float64, x1 float64, m2 float64) (*C.VipsImage, error) {
	incOpCounter("sharpen")
	var out *C.VipsImage

	if err := C.sharpen_image(in, &out, C.double(sigma), C.double(x1), C.double(m2)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-convolution.html#vips-sobel
func vipsSobel(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("sobel")
	var out *C.VipsImage

	if err := C.sobel_image(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
