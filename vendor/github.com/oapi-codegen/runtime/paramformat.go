package runtime

import (
	"encoding/base64"
	"fmt"
	"reflect"
	"strings"
)

// isByteSlice reports whether t is []byte (or equivalently []uint8).
func isByteSlice(t reflect.Type) bool {
	return t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8
}

// base64Decode decodes s as base64.
//
// Per OpenAPI 3.0, format: byte uses RFC 4648 Section 4 (standard alphabet,
// padded). We use padding presence to select the right decoder, rather than
// blindly cascading (which can produce corrupt output when RawStdEncoding
// silently accepts padded input and treats '=' as data).
//
// The logic:
//  1. If s contains '=' padding → standard padded decoder (Std or URL based on alphabet).
//  2. If s contains URL-safe characters ('_' or '-') → RawURLEncoding.
//  3. Otherwise → RawStdEncoding (unpadded, standard alphabet).
func base64Decode(s string) ([]byte, error) {
	if s == "" {
		return []byte{}, nil
	}

	if strings.ContainsRune(s, '=') {
		// Padded input. Pick alphabet based on whether URL-safe chars are present.
		if strings.ContainsAny(s, "-_") {
			return base64Decode1(base64.URLEncoding, s)
		}
		return base64Decode1(base64.StdEncoding, s)
	}

	// Unpadded input. Pick alphabet based on whether URL-safe chars are present.
	if strings.ContainsAny(s, "-_") {
		return base64Decode1(base64.RawURLEncoding, s)
	}
	return base64Decode1(base64.RawStdEncoding, s)
}

func base64Decode1(enc *base64.Encoding, s string) ([]byte, error) {
	b, err := enc.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("failed to base64-decode string %q: %w", s, err)
	}
	return b, nil
}
