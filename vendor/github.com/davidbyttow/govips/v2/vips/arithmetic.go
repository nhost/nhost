package vips

// #include "arithmetic.h"
import "C"
import "unsafe"

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-add
func vipsAdd(left *C.VipsImage, right *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("add")
	var out *C.VipsImage

	if err := C.add(left, right, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-multiply
func vipsMultiply(left *C.VipsImage, right *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("multiply")
	var out *C.VipsImage

	if err := C.multiply(left, right, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-divide
func vipsDivide(left *C.VipsImage, right *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("divide")
	var out *C.VipsImage

	if err := C.divide(left, right, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-linear
func vipsLinear(in *C.VipsImage, a, b []float64, n int) (*C.VipsImage, error) {
	incOpCounter("linear")
	var out *C.VipsImage

	if err := C.linear(in, &out, (*C.double)(&a[0]), (*C.double)(&b[0]), C.int(n)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-linear1
func vipsLinear1(in *C.VipsImage, a, b float64) (*C.VipsImage, error) {
	incOpCounter("linear1")
	var out *C.VipsImage

	if err := C.linear1(in, &out, C.double(a), C.double(b)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-invert
func vipsInvert(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("invert")
	var out *C.VipsImage

	if err := C.invert_image(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-avg
func vipsAverage(in *C.VipsImage) (float64, error) {
	incOpCounter("average")
	var out C.double

	if err := C.average(in, &out); err != 0 {
		return 0, handleVipsError()
	}

	return float64(out), nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-find-trim
func vipsFindTrim(in *C.VipsImage, threshold float64, backgroundColor *Color) (int, int, int, int, error) {
	incOpCounter("findTrim")
	var left, top, width, height C.int

	if err := C.find_trim(in, &left, &top, &width, &height, C.double(threshold), C.double(backgroundColor.R),
		C.double(backgroundColor.G), C.double(backgroundColor.B)); err != 0 {
		return -1, -1, -1, -1, handleVipsError()
	}

	return int(left), int(top), int(width), int(height), nil
}

// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-getpoint
func vipsGetPoint(in *C.VipsImage, n int, x int, y int) ([]float64, error) {
	incOpCounter("getpoint")
	var out *C.double
	defer gFreePointer(unsafe.Pointer(out))

	if err := C.getpoint(in, &out, C.int(n), C.int(x), C.int(y)); err != 0 {
		return nil, handleVipsError()
	}

	// maximum n is 4
	return (*[4]float64)(unsafe.Pointer(out))[:n:n], nil
}

// https://www.libvips.org/API/current/libvips-arithmetic.html#vips-stats
func vipsStats(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("stats")
	var out *C.VipsImage

	if err := C.stats(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://www.libvips.org/API/current/libvips-arithmetic.html#vips-hist-find
func vipsHistFind(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("histFind")
	var out *C.VipsImage

	if err := C.hist_find(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://www.libvips.org/API/current/libvips-histogram.html#vips-hist-norm
func vipsHistNorm(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("histNorm")
	var out *C.VipsImage

	if err := C.hist_norm(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://www.libvips.org/API/current/libvips-histogram.html#vips-hist-cum
func vipsHistCum(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("histCum")
	var out *C.VipsImage

	if err := C.hist_cum(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://www.libvips.org/API/current/libvips-histogram.html#vips-hist-entropy
func vipsHistEntropy(in *C.VipsImage) (float64, error) {
	incOpCounter("histEntropy")
	var out C.double

	if err := C.hist_entropy(in, &out); err != 0 {
		return 0, handleVipsError()
	}

	return float64(out), nil
}
