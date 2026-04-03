package memoization

import (
	"encoding/binary"
	"fmt"
	"os"
	"testing"
)

type actionType int

const (
	set actionType = iota
	get
)

type cacheAction struct {
	actionType    actionType
	key           HString
	value         interface{}
	expectedValue interface{}
}

type testCase struct {
	name     string
	capacity int
	actions  []cacheAction
}

func TestCache(t *testing.T) {
	tests := []testCase{
		{
			name:     "TestNewMemoCache",
			capacity: 5,
			actions: []cacheAction{
				{actionType: get, expectedValue: nil},
			},
		},
		{
			name:     "TestSetAndGet",
			capacity: 10,
			actions: []cacheAction{
				{actionType: set, key: "key1", value: "value1"},
				{actionType: get, key: "key1", expectedValue: "value1"},
				{actionType: set, key: "key1", value: "newValue1"},
				{actionType: get, key: "key1", expectedValue: "newValue1"},
				{actionType: get, key: "nonExistentKey", expectedValue: nil},
				{actionType: set, key: "nilKey", value: ""},
				{actionType: get, key: "nilKey", expectedValue: ""},
				{actionType: set, key: "keyA", value: "valueA"},
				{actionType: set, key: "keyB", value: "valueB"},
				{actionType: get, key: "keyA", expectedValue: "valueA"},
				{actionType: get, key: "keyB", expectedValue: "valueB"},
			},
		},
		{
			name:     "TestSetNilValue",
			capacity: 10,
			actions: []cacheAction{
				{actionType: set, key: HString("nilKey"), value: nil},
				{actionType: get, key: HString("nilKey"), expectedValue: nil},
			},
		},
		{
			name:     "TestGetAfterEviction",
			capacity: 2,
			actions: []cacheAction{
				{actionType: set, key: HString("1"), value: 1},
				{actionType: set, key: HString("2"), value: 2},
				{actionType: set, key: HString("3"), value: 3},
				{actionType: get, key: HString("1"), expectedValue: nil},
				{actionType: get, key: HString("2"), expectedValue: 2},
			},
		},
		{
			name:     "TestGetAfterLRU",
			capacity: 2,
			actions: []cacheAction{
				{actionType: set, key: HString("1"), value: 1},
				{actionType: set, key: HString("2"), value: 2},
				{actionType: get, key: HString("1"), expectedValue: 1},
				{actionType: set, key: HString("3"), value: 3},
				{actionType: get, key: HString("1"), expectedValue: 1},
				{actionType: get, key: HString("3"), expectedValue: 3},
				{actionType: get, key: HString("2"), expectedValue: nil},
			},
		},
		{
			name:     "TestLRU_Capacity3",
			capacity: 3,
			actions: []cacheAction{
				{actionType: set, key: HString("1"), value: 1},
				{actionType: set, key: HString("2"), value: 2},
				{actionType: set, key: HString("3"), value: 3},
				{actionType: get, key: HString("1"), expectedValue: 1}, // Accessing key "1"
				{actionType: set, key: HString("4"), value: 4},         // Should evict key "2" since "1" was recently accessed
				{actionType: get, key: HString("2"), expectedValue: nil},
				{actionType: get, key: HString("1"), expectedValue: 1},
				{actionType: get, key: HString("3"), expectedValue: 3},
				{actionType: get, key: HString("4"), expectedValue: 4},
			},
		},
		// Test LRU behavior with varying accesses
		{
			name:     "TestLRU_VaryingAccesses",
			capacity: 3,
			actions: []cacheAction{
				{actionType: set, key: HString("1"), value: 1},
				{actionType: set, key: HString("2"), value: 2},
				{actionType: set, key: HString("3"), value: 3},
				{actionType: get, key: HString("1"), expectedValue: 1}, // Accessing key "1"
				{actionType: get, key: HString("2"), expectedValue: 2}, // Accessing key "2"
				{actionType: set, key: HString("4"), value: 4},         // Should evict key "3"
				{actionType: get, key: HString("3"), expectedValue: nil},
				{actionType: get, key: HString("1"), expectedValue: 1},
				{actionType: get, key: HString("2"), expectedValue: 2},
				{actionType: get, key: HString("4"), expectedValue: 4},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cache := NewMemoCache[HString, interface{}](tt.capacity)
			for _, action := range tt.actions {
				switch action.actionType {
				case set:
					cache.Set(action.key, action.value)
				case get:
					if got, _ := cache.Get(action.key); got != action.expectedValue {
						t.Errorf("Get() = %v, want %v", got, action.expectedValue)
					}
				}
			}
		})
	}
}

func FuzzCache(f *testing.F) {
	// Define some seed values for initial scenarios
	for _, seed := range [][]byte{
		[]byte("7\x010\x0000000020"),
		{0, 0, 0, 0}, // Set key 0 to 0
		{1, 0, 0, 1}, // Set key 0 to 1
		{2, 0},       // Get key 0
	} {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, in []byte) {
		if len(in) < 1 {
			t.Skip() // Skip the test if the input is less than 1 byte
		}

		cache := NewMemoCache[HInt, int](10) // Initialize a cache with the initial size

		expectedValues := make(map[HInt]int) // Map to store expected key-value pairs
		accessOrder := make([]HInt, 0)       // Slice to store the order of keys accessed

		for i := 0; i < len(in); {
			opCode := in[i] % 4 // Determine the operation: Set, Get, or Reset (added case for Reset)
			i++

			switch opCode {
			case 0, 1: // Set operation
				if i+3 > len(in) {
					t.Skip() // Not enough input to continue, so skip
				}

				key := HInt(binary.BigEndian.Uint16(in[i : i+2]))
				value := int(in[i+2])
				i += 3

				// If the key is already in accessOrder, we remove it and append it again later
				for index, accessedKey := range accessOrder {
					if accessedKey == key {
						accessOrder = append(accessOrder[:index], accessOrder[index+1:]...)
						break
					}
				}

				cache.Set(key, value) // Set the value in the cache
				expectedValues[key] = value
				accessOrder = append(accessOrder, key) // Add the key to the access order slice

				// If we exceeded the cache size, we need to evict the least recently used item
				if len(accessOrder) > cache.Capacity() {
					evictedKey := accessOrder[0]
					accessOrder = accessOrder[1:]
					delete(expectedValues, evictedKey) // Remove the evicted key from expected values
				}

			case 2: // Get operation
				if i >= len(in) {
					t.Skip() // Not enough input to continue, so skip
				}

				key := HInt(in[i])
				i++

				expectedValue, ok := expectedValues[key]
				if !ok {
					// If the key is not found, it means it was either evicted or never added
					expectedValue = 0 // The zero value, depends on your cache implementation
				} else {
					// If the key was accessed, move it to the end of the accessOrder to represent recent use
					for index, accessedKey := range accessOrder {
						if accessedKey == key {
							accessOrder = append(accessOrder[:index], accessOrder[index+1:]...)
							accessOrder = append(accessOrder, key)
							break
						}
					}
				}

				if got, _ := cache.Get(key); got != expectedValue {
					fmt.Fprintf(os.Stderr, "cache: capacity: %d, hashable: %v, cache: %v\n", cache.capacity, cache.hashableItems, cache.cache)
					t.Fatalf("Get(%v) = %v, want %v", key, got, expectedValue) // The values do not match
				}
			case 3: // Reset operation
				if i >= len(in) {
					t.Skip() // Not enough input to continue, so skip
				}

				newCacheSize := int(in[i]) // Read the new cache size from the input
				i++

				if newCacheSize == 0 {
					t.Skip() // If the size is zero, we skip this test
				}

				// Create a new cache with the specified size
				cache = NewMemoCache[HInt, int](newCacheSize)

				// clear and reinitialize the expected values
				expectedValues = make(map[HInt]int)
				accessOrder = make([]HInt, 0)
			}
		}
	})
}
