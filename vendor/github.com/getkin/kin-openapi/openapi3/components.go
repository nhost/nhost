package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	"github.com/go-openapi/jsonpointer"
)

type Callbacks map[string]*CallbackRef             // Callbacks represents components' named callbacks
type Examples map[string]*ExampleRef               // Examples represents components' named examples
type Headers map[string]*HeaderRef                 // Headers represents components' named headers
type Links map[string]*LinkRef                     // Links represents components' named links
type ParametersMap map[string]*ParameterRef        // ParametersMap represents components' named parameters
type RequestBodies map[string]*RequestBodyRef      // RequestBodies represents components' named request bodies
type ResponseBodies map[string]*ResponseRef        // ResponseBodies represents components' named response bodies
type Schemas map[string]*SchemaRef                 // Schemas represents components' named schemas
type SecuritySchemes map[string]*SecuritySchemeRef // SecuritySchemes represents components' named security schemes

// Components is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
type Components struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	Schemas         Schemas         `json:"schemas,omitempty" yaml:"schemas,omitempty"`
	Parameters      ParametersMap   `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Headers         Headers         `json:"headers,omitempty" yaml:"headers,omitempty"`
	RequestBodies   RequestBodies   `json:"requestBodies,omitempty" yaml:"requestBodies,omitempty"`
	Responses       ResponseBodies  `json:"responses,omitempty" yaml:"responses,omitempty"`
	SecuritySchemes SecuritySchemes `json:"securitySchemes,omitempty" yaml:"securitySchemes,omitempty"`
	Examples        Examples        `json:"examples,omitempty" yaml:"examples,omitempty"`
	Links           Links           `json:"links,omitempty" yaml:"links,omitempty"`
	Callbacks       Callbacks       `json:"callbacks,omitempty" yaml:"callbacks,omitempty"`
}

func NewComponents() Components {
	return Components{}
}

// MarshalJSON returns the JSON encoding of Components.
func (components Components) MarshalJSON() ([]byte, error) {
	x, err := components.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Components.
func (components Components) MarshalYAML() (any, error) {
	m := make(map[string]any, 9+len(components.Extensions))
	maps.Copy(m, components.Extensions)
	if x := components.Schemas; len(x) != 0 {
		m["schemas"] = x
	}
	if x := components.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	if x := components.Headers; len(x) != 0 {
		m["headers"] = x
	}
	if x := components.RequestBodies; len(x) != 0 {
		m["requestBodies"] = x
	}
	if x := components.Responses; len(x) != 0 {
		m["responses"] = x
	}
	if x := components.SecuritySchemes; len(x) != 0 {
		m["securitySchemes"] = x
	}
	if x := components.Examples; len(x) != 0 {
		m["examples"] = x
	}
	if x := components.Links; len(x) != 0 {
		m["links"] = x
	}
	if x := components.Callbacks; len(x) != 0 {
		m["callbacks"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Components to a copy of data.
func (components *Components) UnmarshalJSON(data []byte) error {
	type ComponentsBis Components
	var x ComponentsBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "schemas")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "headers")
	delete(x.Extensions, "requestBodies")
	delete(x.Extensions, "responses")
	delete(x.Extensions, "securitySchemes")
	delete(x.Extensions, "examples")
	delete(x.Extensions, "links")
	delete(x.Extensions, "callbacks")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*components = Components(x)
	return nil
}

// Validate returns an error if Components does not comply with the OpenAPI spec.
func (components *Components) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	validateMap := func(label string, names []string, validate func(k string) error) error {
		for _, k := range names {
			if idErr := ValidateIdentifier(k); idErr != nil {
				if err := me.emit(&ComponentValidationError{Section: label, Name: k, Cause: idErr}); err != nil {
					return err
				}
				// Skip validating the component's value when its name is
				// invalid: any leaf error from validate(k) would surface as
				// "<bad-name>: <leaf-error>" and has no resolution path
				// until the name is fixed. The continue keeps the noise
				// per component bounded to a single, actionable finding.
				continue
			}
			wrap := func(e error) error { return &ComponentValidationError{Section: label, Name: k, Cause: e} }
			if err := me.emitWrapped(wrap, validate(k)); err != nil {
				return err
			}
		}
		return nil
	}

	if err := validateMap("schema", componentNames(components.Schemas), func(k string) error {
		return components.Schemas[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("parameter", componentNames(components.Parameters), func(k string) error {
		return components.Parameters[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("request body", componentNames(components.RequestBodies), func(k string) error {
		return components.RequestBodies[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("response", componentNames(components.Responses), func(k string) error {
		return components.Responses[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("header", componentNames(components.Headers), func(k string) error {
		return components.Headers[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("security scheme", componentNames(components.SecuritySchemes), func(k string) error {
		return components.SecuritySchemes[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("example", componentNames(components.Examples), func(k string) error {
		return components.Examples[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("link", componentNames(components.Links), func(k string) error {
		return components.Links[k].Validate(ctx)
	}); err != nil {
		return err
	}

	if err := validateMap("callback", componentNames(components.Callbacks), func(k string) error {
		return components.Callbacks[k].Validate(ctx)
	}); err != nil {
		return err
	}

	return me.finalize(validateExtensions(ctx, components.Extensions, components.Origin))
}

var _ jsonpointer.JSONPointable = (*Schemas)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Schemas) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no schema %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*ParametersMap)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m ParametersMap) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no parameter %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Headers)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Headers) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no header %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*RequestBodyRef)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m RequestBodies) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no request body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*ResponseRef)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m ResponseBodies) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no response body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*SecuritySchemes)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m SecuritySchemes) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no security scheme body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Examples)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Examples) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no example body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Links)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Links) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no link body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Callbacks)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Callbacks) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no callback body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}
