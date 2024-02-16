package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/go-openapi/jsonpointer"
	"github.com/perimeterx/marshmallow"
)

// CallbackRef represents either a Callback or a $ref to a Callback.
// When serializing and both fields are set, Ref is preferred over Value.
type CallbackRef struct {
	Ref   string
	Value *Callback
	extra []string
}

var _ jsonpointer.JSONPointable = (*CallbackRef)(nil)

func (x *CallbackRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of CallbackRef.
func (x CallbackRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of CallbackRef.
func (x CallbackRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return json.Marshal(x.Value)
}

// UnmarshalJSON sets CallbackRef to a copy of data.
func (x *CallbackRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if CallbackRef does not comply with the OpenAPI spec.
func (x *CallbackRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *CallbackRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// ExampleRef represents either a Example or a $ref to a Example.
// When serializing and both fields are set, Ref is preferred over Value.
type ExampleRef struct {
	Ref   string
	Value *Example
	extra []string
}

var _ jsonpointer.JSONPointable = (*ExampleRef)(nil)

func (x *ExampleRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of ExampleRef.
func (x ExampleRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of ExampleRef.
func (x ExampleRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets ExampleRef to a copy of data.
func (x *ExampleRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if ExampleRef does not comply with the OpenAPI spec.
func (x *ExampleRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *ExampleRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// HeaderRef represents either a Header or a $ref to a Header.
// When serializing and both fields are set, Ref is preferred over Value.
type HeaderRef struct {
	Ref   string
	Value *Header
	extra []string
}

var _ jsonpointer.JSONPointable = (*HeaderRef)(nil)

func (x *HeaderRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of HeaderRef.
func (x HeaderRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of HeaderRef.
func (x HeaderRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets HeaderRef to a copy of data.
func (x *HeaderRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if HeaderRef does not comply with the OpenAPI spec.
func (x *HeaderRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *HeaderRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// LinkRef represents either a Link or a $ref to a Link.
// When serializing and both fields are set, Ref is preferred over Value.
type LinkRef struct {
	Ref   string
	Value *Link
	extra []string
}

var _ jsonpointer.JSONPointable = (*LinkRef)(nil)

func (x *LinkRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of LinkRef.
func (x LinkRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of LinkRef.
func (x LinkRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets LinkRef to a copy of data.
func (x *LinkRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if LinkRef does not comply with the OpenAPI spec.
func (x *LinkRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *LinkRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// ParameterRef represents either a Parameter or a $ref to a Parameter.
// When serializing and both fields are set, Ref is preferred over Value.
type ParameterRef struct {
	Ref   string
	Value *Parameter
	extra []string
}

var _ jsonpointer.JSONPointable = (*ParameterRef)(nil)

func (x *ParameterRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of ParameterRef.
func (x ParameterRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of ParameterRef.
func (x ParameterRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets ParameterRef to a copy of data.
func (x *ParameterRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if ParameterRef does not comply with the OpenAPI spec.
func (x *ParameterRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *ParameterRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// RequestBodyRef represents either a RequestBody or a $ref to a RequestBody.
// When serializing and both fields are set, Ref is preferred over Value.
type RequestBodyRef struct {
	Ref   string
	Value *RequestBody
	extra []string
}

var _ jsonpointer.JSONPointable = (*RequestBodyRef)(nil)

func (x *RequestBodyRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of RequestBodyRef.
func (x RequestBodyRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of RequestBodyRef.
func (x RequestBodyRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets RequestBodyRef to a copy of data.
func (x *RequestBodyRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if RequestBodyRef does not comply with the OpenAPI spec.
func (x *RequestBodyRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *RequestBodyRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// ResponseRef represents either a Response or a $ref to a Response.
// When serializing and both fields are set, Ref is preferred over Value.
type ResponseRef struct {
	Ref   string
	Value *Response
	extra []string
}

var _ jsonpointer.JSONPointable = (*ResponseRef)(nil)

func (x *ResponseRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of ResponseRef.
func (x ResponseRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of ResponseRef.
func (x ResponseRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets ResponseRef to a copy of data.
func (x *ResponseRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if ResponseRef does not comply with the OpenAPI spec.
func (x *ResponseRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *ResponseRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// SchemaRef represents either a Schema or a $ref to a Schema.
// When serializing and both fields are set, Ref is preferred over Value.
type SchemaRef struct {
	Ref   string
	Value *Schema
	extra []string
}

var _ jsonpointer.JSONPointable = (*SchemaRef)(nil)

func (x *SchemaRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of SchemaRef.
func (x SchemaRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of SchemaRef.
func (x SchemaRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets SchemaRef to a copy of data.
func (x *SchemaRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if SchemaRef does not comply with the OpenAPI spec.
func (x *SchemaRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *SchemaRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}

// SecuritySchemeRef represents either a SecurityScheme or a $ref to a SecurityScheme.
// When serializing and both fields are set, Ref is preferred over Value.
type SecuritySchemeRef struct {
	Ref   string
	Value *SecurityScheme
	extra []string
}

var _ jsonpointer.JSONPointable = (*SecuritySchemeRef)(nil)

func (x *SecuritySchemeRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// MarshalYAML returns the YAML encoding of SecuritySchemeRef.
func (x SecuritySchemeRef) MarshalYAML() (interface{}, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value, nil
}

// MarshalJSON returns the JSON encoding of SecuritySchemeRef.
func (x SecuritySchemeRef) MarshalJSON() ([]byte, error) {
	if ref := x.Ref; ref != "" {
		return json.Marshal(Ref{Ref: ref})
	}
	return x.Value.MarshalJSON()
}

// UnmarshalJSON sets SecuritySchemeRef to a copy of data.
func (x *SecuritySchemeRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// Validate returns an error if SecuritySchemeRef does not comply with the OpenAPI spec.
func (x *SecuritySchemeRef) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	if extra := x.extra; len(extra) != 0 {
		extras := make([]string, 0, len(extra))
		allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed
		for _, ex := range extra {
			if allowed != nil {
				if _, ok := allowed[ex]; ok {
					continue
				}
			}
			extras = append(extras, ex)
		}
		if len(extras) != 0 {
			return fmt.Errorf("extra sibling fields: %+v", extras)
		}
	}
	if v := x.Value; v != nil {
		return v.Validate(ctx)
	}
	return foundUnresolvedRef(x.Ref)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *SecuritySchemeRef) JSONLookup(token string) (interface{}, error) {
	if token == "$ref" {
		return x.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}
