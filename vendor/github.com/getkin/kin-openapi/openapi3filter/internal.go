package openapi3filter

import (
	"reflect"
	"strings"
)

func parseMediaType(contentType string) string {
	i := strings.IndexByte(contentType, ';')
	if i < 0 {
		return contentType
	}
	return contentType[:i]
}

func isNilValue(value interface{}) bool {
	if value == nil {
		return true
	}
	switch reflect.TypeOf(value).Kind() {
	case reflect.Ptr, reflect.Map, reflect.Array, reflect.Chan, reflect.Slice:
		return reflect.ValueOf(value).IsNil()
	}
	return false
}
