package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
)

// ExternalDocs is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#external-documentation-object
type ExternalDocs struct {
	Extensions map[string]interface{} `json:"-" yaml:"-"`

	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
}

// MarshalJSON returns the JSON encoding of ExternalDocs.
func (e ExternalDocs) MarshalJSON() ([]byte, error) {
	m := make(map[string]interface{}, 2+len(e.Extensions))
	for k, v := range e.Extensions {
		m[k] = v
	}
	if x := e.Description; x != "" {
		m["description"] = x
	}
	if x := e.URL; x != "" {
		m["url"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets ExternalDocs to a copy of data.
func (e *ExternalDocs) UnmarshalJSON(data []byte) error {
	type ExternalDocsBis ExternalDocs
	var x ExternalDocsBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "description")
	delete(x.Extensions, "url")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*e = ExternalDocs(x)
	return nil
}

// Validate returns an error if ExternalDocs does not comply with the OpenAPI spec.
func (e *ExternalDocs) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if e.URL == "" {
		return errors.New("url is required")
	}
	if _, err := url.Parse(e.URL); err != nil {
		return fmt.Errorf("url is incorrect: %w", err)
	}

	return validateExtensions(ctx, e.Extensions)
}
