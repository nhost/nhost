package openapi3filter

import (
	"bytes"
	"io"
	"net/http"
)

type ResponseValidationInput struct {
	RequestValidationInput *RequestValidationInput
	Status                 int
	Header                 http.Header
	Body                   io.ReadCloser
	Options                *Options
}

func (input *ResponseValidationInput) SetBodyBytes(value []byte) *ResponseValidationInput {
	input.Body = io.NopCloser(bytes.NewReader(value))
	return input
}

var JSONPrefixes = []string{
	")]}',\n",
}

// TrimJSONPrefix trims one of the possible prefixes
func TrimJSONPrefix(data []byte) []byte {
search:
	for _, prefix := range JSONPrefixes {
		if len(data) < len(prefix) {
			continue
		}
		for i, b := range data[:len(prefix)] {
			if b != prefix[i] {
				continue search
			}
		}
		return data[len(prefix):]
	}
	return data
}
