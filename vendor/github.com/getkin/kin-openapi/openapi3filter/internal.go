package openapi3filter

import (
	"reflect"
	"strings"
)

func parseMediaType(contentType string) string {
	before, _, ok := strings.Cut(contentType, ";")
	if !ok {
		return contentType
	}
	return before
}

func isNilValue(value any) bool {
	if value == nil {
		return true
	}
	switch reflect.TypeOf(value).Kind() {
	case reflect.Pointer, reflect.Map, reflect.Array, reflect.Chan, reflect.Slice:
		return reflect.ValueOf(value).IsNil()
	}
	return false
}
