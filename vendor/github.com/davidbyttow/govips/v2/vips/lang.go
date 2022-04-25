package vips

// #include <vips/vips.h>
// #include <stdlib.h>
import "C"

import (
	"reflect"
	"unsafe"
)

func freeCString(s *C.char) {
	C.free(unsafe.Pointer(s))
}

func gFreePointer(ref unsafe.Pointer) {
	C.g_free(C.gpointer(ref))
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func toGboolean(b bool) C.gboolean {
	if b {
		return C.gboolean(1)
	}
	return C.gboolean(0)
}

func fromGboolean(b C.gboolean) bool {
	return b != 0
}

func fromCArrayInt(out *C.int, n int) []int {
	var result = make([]int, n)
	var data []C.int
	sh := (*reflect.SliceHeader)(unsafe.Pointer(&data))
	sh.Data = uintptr(unsafe.Pointer(out))
	sh.Len = n
	sh.Cap = n
	for i := range data {
		result[i] = int(data[i])
	}
	return result
}
