package openapi3

import (
	"context"
	"encoding/json"
	"maps"
)

//go:generate go run refsgenerator.go

// Ref represents the common fields of an OpenAPI Reference Object.
// Summary and Description are supported by OpenAPI 3.1 and later.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.2.md#reference-object
type Ref struct {
	Ref         string         `json:"$ref" yaml:"$ref"`
	Summary     *string        `json:"summary,omitempty" yaml:"summary,omitempty"`
	Description *string        `json:"description,omitempty" yaml:"description,omitempty"`
	Extensions  map[string]any `json:"-" yaml:"-"`
	Origin      *Origin        `json:"-" yaml:"-"`
}

// MarshalYAML returns the YAML encoding of Ref.
func (x Ref) MarshalYAML() (any, error) {
	m := make(map[string]any, 1+len(x.Extensions))
	maps.Copy(m, x.Extensions)
	if x := x.Ref; x != "" {
		m["$ref"] = x
	}
	if x.Summary != nil {
		m["summary"] = *x.Summary
	}
	if x.Description != nil {
		m["description"] = *x.Description
	}
	return m, nil
}

// MarshalJSON returns the JSON encoding of Ref.
func (x Ref) MarshalJSON() ([]byte, error) {
	y, err := x.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(y)
}

// Validate returns an error if Extensions does not comply with the OpenAPI spec.
func (e *Ref) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	return validateExtensions(ctx, e.Extensions, e.Origin)
}
