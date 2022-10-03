package graphql

import (
	"fmt"
	"reflect"
)

// Note: These custom types are kept for backwards compatability.  Native
// types for queries and responses are supported, with the exception of the ID.

type (
	// Boolean represents true or false values.
	// Deprecated.
	Boolean bool

	// Float represents signed double-precision fractional values as
	// specified by IEEE 754.
	// Deprecated.
	Float float64

	// Int represents non-fractional signed whole numeric values.
	// Int can represent values between -(2^31) and 2^31 - 1.
	// Deprecated.
	Int int32

	// String represents textual data as UTF-8 character sequences.
	// This type is most often used by GraphQL to represent free-form
	// human-readable text.
	// Deprecated.
	String string
)

// ID represents a unique identifier that is Base64 obfuscated. It
// is often used to refetch an object or as key for a cache. The ID
// type appears in a JSON response as a String; however, it is not
// intended to be human-readable. When expected as an input type,
// any string (such as "VXNlci0xMA==") or integer (such as 4) input
// value will be accepted as an ID.
type ID string

// NewBoolean is a helper to make a new *Boolean.
// Deprecated.
func NewBoolean(v Boolean) *Boolean { return &v }

// NewFloat is a helper to make a new *Float.
// Deprecated.
func NewFloat(v Float) *Float { return &v }

// NewID is a helper to make a new *ID.
func NewID(v interface{}) *ID {
	rv := ToID(v)
	return &rv
}

// ToID is a helper for if you need to get the string version of an integer or
// a string for the id.
func ToID(v interface{}) ID {
	var s string
	switch reflect.TypeOf(v).Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		s = fmt.Sprintf("%d", v)
		if s == "0" {
			s = ""
		}
	case reflect.String:
		s = v.(string)
	}
	return ID(s)
}

// NewInt is a helper to make a new *Int.
// Deprecated.
func NewInt(v Int) *Int { return &v }

// NewString is a helper to make a new *String.
// Deprecated.
func NewString(v String) *String { return &v }
