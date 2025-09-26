package vips

// #include "header.h"
import "C"
import (
	"strings"
	"unsafe"
)

func vipsHasICCProfile(in *C.VipsImage) bool {
	return int(C.has_icc_profile(in)) != 0
}

func vipsGetICCProfile(in *C.VipsImage) ([]byte, bool) {
	var bufPtr unsafe.Pointer
	var dataLength C.size_t

	if int(C.get_icc_profile(in, &bufPtr, &dataLength)) != 0 {
		return nil, false
	}

	buf := C.GoBytes(bufPtr, C.int(dataLength))
	return buf, true
}

func vipsRemoveICCProfile(in *C.VipsImage) bool {
	return fromGboolean(C.remove_icc_profile(in))
}

func vipsHasIPTC(in *C.VipsImage) bool {
	return int(C.has_iptc(in)) != 0
}

func vipsImageGetFields(in *C.VipsImage) (fields []string) {
	const maxFields = 256

	rawFields := C.image_get_fields(in)
	defer C.g_strfreev(rawFields)

	cFields := (*[maxFields]*C.char)(unsafe.Pointer(rawFields))[:maxFields:maxFields]

	for _, field := range cFields {
		if field == nil {
			break
		}
		fields = append(fields, C.GoString(field))
	}
	return
}

func vipsImageGetExifData(in *C.VipsImage) map[string]string {
	fields := vipsImageGetFields(in)

	exifData := map[string]string{}
	for _, field := range fields {
		if strings.HasPrefix(field, "exif") {
			exifData[field] = vipsImageGetString(in, field)
		}
	}

	return exifData
}

func vipsRemoveMetadata(in *C.VipsImage, keep ...string) {
	fields := vipsImageGetFields(in)

	retain := append(keep, technicalMetadata...)

	for _, field := range fields {
		if contains(retain, field) {
			continue
		}

		cField := C.CString(field)

		C.remove_field(in, cField)

		C.free(unsafe.Pointer(cField))
	}
}

var technicalMetadata = []string{
	C.VIPS_META_ICC_NAME,
	C.VIPS_META_ORIENTATION,
	C.VIPS_META_N_PAGES,
	C.VIPS_META_PAGE_HEIGHT,
}

func contains(a []string, x string) bool {
	for _, n := range a {
		if x == n {
			return true
		}
	}
	return false
}

func vipsGetMetaOrientation(in *C.VipsImage) int {
	return int(C.get_meta_orientation(in))
}

func vipsRemoveMetaOrientation(in *C.VipsImage) {
	C.remove_meta_orientation(in)
}

func vipsSetMetaOrientation(in *C.VipsImage, orientation int) {
	C.set_meta_orientation(in, C.int(orientation))
}

func vipsGetImageNPages(in *C.VipsImage) int {
	return int(C.get_image_n_pages(in))
}

func vipsSetImageNPages(in *C.VipsImage, pages int) {
	C.set_image_n_pages(in, C.int(pages))
}

func vipsGetPageHeight(in *C.VipsImage) int {
	return int(C.get_page_height(in))
}

func vipsSetPageHeight(in *C.VipsImage, height int) {
	C.set_page_height(in, C.int(height))
}

func vipsImageGetMetaLoader(in *C.VipsImage) (string, bool) {
	var out *C.char
	defer freeCString(out)
	code := int(C.get_meta_loader(in, &out))
	return C.GoString(out), code == 0
}

func vipsImageGetDelay(in *C.VipsImage, n int) ([]int, error) {
	incOpCounter("imageGetDelay")
	var out *C.int
	defer gFreePointer(unsafe.Pointer(out))

	if err := C.get_image_delay(in, &out); err != 0 {
		return nil, handleVipsError()
	}
	return fromCArrayInt(out, n), nil
}

func vipsImageSetDelay(in *C.VipsImage, data []C.int) error {
	incOpCounter("imageSetDelay")
	if n := len(data); n > 0 {
		C.set_image_delay(in, &data[0], C.int(n))
	}
	return nil
}

// vipsDetermineImageTypeFromMetaLoader determine the image type from vips-loader metadata
func vipsDetermineImageTypeFromMetaLoader(in *C.VipsImage) ImageType {
	vipsLoader, ok := vipsImageGetMetaLoader(in)
	if vipsLoader == "" || !ok {
		return ImageTypeUnknown
	}
	if strings.HasPrefix(vipsLoader, "jpeg") {
		return ImageTypeJPEG
	}
	if strings.HasPrefix(vipsLoader, "png") {
		return ImageTypePNG
	}
	if strings.HasPrefix(vipsLoader, "gif") {
		return ImageTypeGIF
	}
	if strings.HasPrefix(vipsLoader, "svg") {
		return ImageTypeSVG
	}
	if strings.HasPrefix(vipsLoader, "webp") {
		return ImageTypeWEBP
	}
	if strings.HasPrefix(vipsLoader, "jp2k") {
		return ImageTypeJP2K
	}
	if strings.HasPrefix(vipsLoader, "jxl") {
		return ImageTypeJXL
	}
	if strings.HasPrefix(vipsLoader, "magick") {
		return ImageTypeMagick
	}
	if strings.HasPrefix(vipsLoader, "tiff") {
		return ImageTypeTIFF
	}
	if strings.HasPrefix(vipsLoader, "heif") {
		return ImageTypeHEIF
	}
	if strings.HasPrefix(vipsLoader, "pdf") {
		return ImageTypePDF
	}
	return ImageTypeUnknown
}

func vipsImageSetBlob(in *C.VipsImage, name string, data []byte) {
	cData := unsafe.Pointer(&data)
	cDataLength := C.size_t(len(data))

	cField := C.CString(name)
	defer freeCString(cField)
	C.image_set_blob(in, cField, cData, cDataLength)
}

func vipsImageGetBlob(in *C.VipsImage, name string) []byte {
	var bufPtr unsafe.Pointer
	var dataLength C.size_t

	cField := C.CString(name)
	defer freeCString(cField)
	if int(C.image_get_blob(in, cField, &bufPtr, &dataLength)) != 0 {
		return nil
	}

	buf := C.GoBytes(bufPtr, C.int(dataLength))
	return buf
}

func vipsImageSetDouble(in *C.VipsImage, name string, f float64) {
	cField := C.CString(name)
	defer freeCString(cField)

	cDouble := C.double(f)
	C.image_set_double(in, cField, cDouble)
}

func vipsImageGetDouble(in *C.VipsImage, name string) float64 {
	cField := C.CString(name)
	defer freeCString(cField)

	var cDouble C.double
	if int(C.image_get_double(in, cField, &cDouble)) == 0 {
		return float64(cDouble)
	}

	return 0
}

func vipsImageSetInt(in *C.VipsImage, name string, i int) {
	cField := C.CString(name)
	defer freeCString(cField)

	cInt := C.int(i)
	C.image_set_int(in, cField, cInt)
}

func vipsImageGetInt(in *C.VipsImage, name string) int {
	cField := C.CString(name)
	defer freeCString(cField)

	var cInt C.int
	if int(C.image_get_int(in, cField, &cInt)) == 0 {
		return int(cInt)
	}

	return 0
}

func vipsImageSetString(in *C.VipsImage, name string, str string) {
	cField := C.CString(name)
	defer freeCString(cField)

	cStr := C.CString(str)
	defer freeCString(cStr)

	C.image_set_string(in, cField, cStr)
}

func vipsImageGetString(in *C.VipsImage, name string) string {
	cField := C.CString(name)
	defer freeCString(cField)
	var cFieldValue *C.char
	defer freeCString(cFieldValue)
	if int(C.image_get_string(in, cField, &cFieldValue)) == 0 {
		return C.GoString(cFieldValue)
	}

	return ""
}

func vipsImageGetAsString(in *C.VipsImage, name string) string {
	cField := C.CString(name)
	defer freeCString(cField)
	var cFieldValue *C.char
	defer freeCString(cFieldValue)
	if int(C.image_get_as_string(in, cField, &cFieldValue)) == 0 {
		return C.GoString(cFieldValue)
	}

	return ""
}
