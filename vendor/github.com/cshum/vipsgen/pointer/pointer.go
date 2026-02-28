package pointer

// #include <stdlib.h>
import "C"

import (
	"sync"
	"unsafe"
)

const blockSize = 1024

var (
	mutex  sync.RWMutex
	store  = map[unsafe.Pointer]interface{}{}
	free   []unsafe.Pointer
	blocks []unsafe.Pointer
)

func allocMem() {
	mem := C.malloc(blockSize)
	if mem == nil {
		panic("can't allocate memory block for C pointers")
	}
	blocks = append(blocks, mem)
	for i := 0; i < blockSize; i++ {
		p := unsafe.Pointer(uintptr(mem) + uintptr(blockSize-1-i))
		free = append(free, p)
	}
}

func getPtr() unsafe.Pointer {
	// Generate real fake C pointer.
	// This pointer will not store any data, but will be used for indexing
	// purposes. Since Go doesn't allow to cast dangling pointer to
	// unsafe.Pointer, we do really allocate memory. Why we need indexing? Because
	// Go doest allow C code to store pointers to Go data.
	if len(free) == 0 {
		allocMem()
	}
	n := len(free) - 1
	p := free[n]
	free = free[:n]
	return p
}

// Save an object in the storage and return an index pointer to it.
func Save(v interface{}) unsafe.Pointer {
	if v == nil {
		return nil
	}

	mutex.Lock()
	ptr := getPtr()
	store[ptr] = v
	mutex.Unlock()

	return ptr
}

// Restore an object from the storage by its index pointer.
func Restore(ptr unsafe.Pointer) (v interface{}) {
	if ptr == nil {
		return nil
	}

	mutex.RLock()
	v = store[ptr]
	mutex.RUnlock()
	return
}

// Unref removes an object from the storage and returns the index pointer to the
// pool for reuse.
func Unref(ptr unsafe.Pointer) {
	if ptr == nil {
		return
	}

	mutex.Lock()
	if _, ok := store[ptr]; ok {
		delete(store, ptr)
		free = append(free, ptr)
	}
	mutex.Unlock()
}

// Clear storage and free all memory
func Clear() {
	mutex.Lock()
	for p := range store {
		delete(store, p)
	}
	free = nil
	for _, p := range blocks {
		C.free(p)
	}
	blocks = nil
	mutex.Unlock()
}
