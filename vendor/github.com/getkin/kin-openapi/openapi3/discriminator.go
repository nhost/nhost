package openapi3

import (
	"context"
	"encoding/json"
	"maps"
)

// Discriminator is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#discriminator-object
type Discriminator struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	PropertyName string                `json:"propertyName" yaml:"propertyName"` // required
	Mapping      map[string]MappingRef `json:"mapping,omitempty" yaml:"mapping,omitempty"`
}

// MappingRef is a ref to a Schema objects. Unlike SchemaRefs it is serialised
// as a plain string instead of an object with a $ref key, as such it also does
// not support extensions.
type MappingRef SchemaRef

func (mr *MappingRef) UnmarshalText(data []byte) error {
	mr.Ref = string(data)
	return nil
}

func (mr MappingRef) MarshalText() ([]byte, error) {
	return []byte(mr.Ref), nil
}

// MarshalJSON returns the JSON encoding of Discriminator.
func (discriminator Discriminator) MarshalJSON() ([]byte, error) {
	x, err := discriminator.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Discriminator.
func (discriminator Discriminator) MarshalYAML() (any, error) {
	m := make(map[string]any, 2+len(discriminator.Extensions))
	maps.Copy(m, discriminator.Extensions)
	m["propertyName"] = discriminator.PropertyName
	if x := discriminator.Mapping; len(x) != 0 {
		m["mapping"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Discriminator to a copy of data.
func (discriminator *Discriminator) UnmarshalJSON(data []byte) error {
	type DiscriminatorBis Discriminator
	var x DiscriminatorBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, "propertyName")
	delete(x.Extensions, "mapping")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*discriminator = Discriminator(x)
	return nil
}

// Validate returns an error if Discriminator does not comply with the OpenAPI spec.
func (discriminator *Discriminator) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	return validateExtensions(ctx, discriminator.Extensions, discriminator.Origin)
}
