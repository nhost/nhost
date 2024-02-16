package openapi3

import (
	"context"
	"encoding/json"
)

// Discriminator is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#discriminator-object
type Discriminator struct {
	Extensions map[string]interface{} `json:"-" yaml:"-"`

	PropertyName string            `json:"propertyName" yaml:"propertyName"` // required
	Mapping      map[string]string `json:"mapping,omitempty" yaml:"mapping,omitempty"`
}

// MarshalJSON returns the JSON encoding of Discriminator.
func (discriminator Discriminator) MarshalJSON() ([]byte, error) {
	m := make(map[string]interface{}, 2+len(discriminator.Extensions))
	for k, v := range discriminator.Extensions {
		m[k] = v
	}
	m["propertyName"] = discriminator.PropertyName
	if x := discriminator.Mapping; len(x) != 0 {
		m["mapping"] = x
	}
	return json.Marshal(m)
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

	return validateExtensions(ctx, discriminator.Extensions)
}
