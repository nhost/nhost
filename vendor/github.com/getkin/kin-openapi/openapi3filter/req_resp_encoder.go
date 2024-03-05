package openapi3filter

import (
	"encoding/json"
	"fmt"
)

func encodeBody(body interface{}, mediaType string) ([]byte, error) {
	encoder, ok := bodyEncoders[mediaType]
	if !ok {
		return nil, &ParseError{
			Kind:   KindUnsupportedFormat,
			Reason: fmt.Sprintf("%s %q", prefixUnsupportedCT, mediaType),
		}
	}
	return encoder(body)
}

type BodyEncoder func(body interface{}) ([]byte, error)

var bodyEncoders = map[string]BodyEncoder{
	"application/json": json.Marshal,
}

func RegisterBodyEncoder(contentType string, encoder BodyEncoder) {
	if contentType == "" {
		panic("contentType is empty")
	}
	if encoder == nil {
		panic("encoder is not defined")
	}
	bodyEncoders[contentType] = encoder
}

// This call is not thread-safe: body encoders should not be created/destroyed by multiple goroutines.
func UnregisterBodyEncoder(contentType string) {
	if contentType == "" {
		panic("contentType is empty")
	}
	delete(bodyEncoders, contentType)
}

// RegisteredBodyEncoder returns the registered body encoder for the given content type.
//
// If no encoder was registered for the given content type, nil is returned.
// This call is not thread-safe: body encoders should not be created/destroyed by multiple goroutines.
func RegisteredBodyEncoder(contentType string) BodyEncoder {
	return bodyEncoders[contentType]
}
