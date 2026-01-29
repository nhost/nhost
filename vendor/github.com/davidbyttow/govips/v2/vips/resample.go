package vips

// #include "resample.h"
import "C"
import (
	"os"
	"runtime"
	"unsafe"
)

// Kernel represents VipsKernel type
type Kernel int

// Kernel enum
const (
	KernelAuto     Kernel = -1
	KernelNearest  Kernel = C.VIPS_KERNEL_NEAREST
	KernelLinear   Kernel = C.VIPS_KERNEL_LINEAR
	KernelCubic    Kernel = C.VIPS_KERNEL_CUBIC
	KernelLanczos2 Kernel = C.VIPS_KERNEL_LANCZOS2
	KernelLanczos3 Kernel = C.VIPS_KERNEL_LANCZOS3
	KernelMitchell Kernel = C.VIPS_KERNEL_MITCHELL
)

// Size represents VipsSize type
type Size int

const (
	SizeBoth  Size = C.VIPS_SIZE_BOTH
	SizeUp    Size = C.VIPS_SIZE_UP
	SizeDown  Size = C.VIPS_SIZE_DOWN
	SizeForce Size = C.VIPS_SIZE_FORCE
	SizeLast  Size = C.VIPS_SIZE_LAST
)

// https://libvips.github.io/libvips/API/current/libvips-resample.html#vips-resize
func vipsResizeWithVScale(in *C.VipsImage, hscale, vscale float64, kernel Kernel) (*C.VipsImage, error) {
	incOpCounter("resize")
	var out *C.VipsImage

	// libvips recommends Lanczos3 as the default kernel
	if kernel == KernelAuto {
		kernel = KernelLanczos3
	}

	if err := C.resize_image(in, &out, C.double(hscale), C.double(vscale), C.int(kernel)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsThumbnail(in *C.VipsImage, width, height int, crop Interesting, size Size) (*C.VipsImage, error) {
	incOpCounter("thumbnail")
	var out *C.VipsImage

	if err := C.thumbnail_image(in, &out, C.int(width), C.int(height), C.int(crop), C.int(size)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://www.libvips.org/API/current/libvips-resample.html#vips-thumbnail
func vipsThumbnailFromFile(filename string, width, height int, crop Interesting, size Size, params *ImportParams) (*C.VipsImage, ImageType, error) {
	var out *C.VipsImage

	filenameOption := filename
	if params != nil {
		filenameOption += "[" + params.OptionString() + "]"
	}

	cFileName := C.CString(filenameOption)
	defer freeCString(cFileName)

	if err := C.thumbnail(cFileName, &out, C.int(width), C.int(height), C.int(crop), C.int(size)); err != 0 {
		err := handleImageError(out)
		if src, err2 := os.ReadFile(filename); err2 == nil {
			if isBMP(src) {
				if src2, err3 := bmpToPNG(src); err3 == nil {
					return vipsThumbnailFromBuffer(src2, width, height, crop, size, params)
				}
			}
		}
		return nil, ImageTypeUnknown, err
	}

	imageType := vipsDetermineImageTypeFromMetaLoader(out)
	return out, imageType, nil
}

// https://www.libvips.org/API/current/libvips-resample.html#vips-thumbnail-buffer
func vipsThumbnailFromBuffer(buf []byte, width, height int, crop Interesting, size Size, params *ImportParams) (*C.VipsImage, ImageType, error) {
	src := buf
	// Reference src here so it's not garbage collected during image initialization.
	defer runtime.KeepAlive(src)

	var out *C.VipsImage

	var err C.int

	if params == nil {
		err = C.thumbnail_buffer(unsafe.Pointer(&src[0]), C.size_t(len(src)), &out, C.int(width), C.int(height), C.int(crop), C.int(size))
	} else {
		cOptionString := C.CString(params.OptionString())
		defer freeCString(cOptionString)

		err = C.thumbnail_buffer_with_option(unsafe.Pointer(&src[0]), C.size_t(len(src)), &out, C.int(width), C.int(height), C.int(crop), C.int(size), cOptionString)
	}
	if err != 0 {
		err := handleImageError(out)
		if isBMP(src) {
			if src2, err2 := bmpToPNG(src); err2 == nil {
				return vipsThumbnailFromBuffer(src2, width, height, crop, size, params)
			}
		}
		return nil, ImageTypeUnknown, err
	}

	imageType := vipsDetermineImageTypeFromMetaLoader(out)
	return out, imageType, nil
}

// https://libvips.github.io/libvips/API/current/libvips-resample.html#vips-mapim
func vipsMapim(in *C.VipsImage, index *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("mapim")
	var out *C.VipsImage

	if err := C.mapim(in, &out, index); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-histogram.html#vips-maplut
func vipsMaplut(in *C.VipsImage, lut *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("maplut")
	var out *C.VipsImage

	if err := C.maplut(in, &out, lut); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
