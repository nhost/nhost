// Copyright 2022-2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"github.com/pb33f/libopenapi/datamodel/high"
	low "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// RequestBody represents a high-level OpenAPI 3+ RequestBody object, backed by a low-level one.
//   - https://spec.openapis.org/oas/v3.1.0#request-body-object
type RequestBody struct {
	Description string                              `json:"description,omitempty" yaml:"description,omitempty"`
	Content     *orderedmap.Map[string, *MediaType] `json:"content,omitempty" yaml:"content,omitempty"`
	Required    *bool                               `json:"required,omitempty" yaml:"required,renderZero,omitempty"`
	Extensions  *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low         *low.RequestBody
}

// NewRequestBody will create a new high-level RequestBody instance, from a low-level one.
func NewRequestBody(rb *low.RequestBody) *RequestBody {
	r := new(RequestBody)
	r.low = rb
	r.Description = rb.Description.Value
	if !rb.Required.IsEmpty() {
		r.Required = &rb.Required.Value
	}
	r.Extensions = high.ExtractExtensions(rb.Extensions)
	r.Content = ExtractContent(rb.Content.Value)
	return r
}

// GoLow returns the low-level RequestBody instance used to create the high-level one.
func (r *RequestBody) GoLow() *low.RequestBody {
	return r.low
}

// GoLowUntyped will return the low-level RequestBody instance that was used to create the high-level one, with no type
func (r *RequestBody) GoLowUntyped() any {
	return r.low
}

// Render will return a YAML representation of the RequestBody object as a byte slice.
func (r *RequestBody) Render() ([]byte, error) {
	return yaml.Marshal(r)
}

func (r *RequestBody) RenderInline() ([]byte, error) {
	d, _ := r.MarshalYAMLInline()
	return yaml.Marshal(d)
}

// MarshalYAML will create a ready to render YAML representation of the RequestBody object.
func (r *RequestBody) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(r, r.low)
	return nb.Render(), nil
}

func (r *RequestBody) MarshalYAMLInline() (interface{}, error) {
	nb := high.NewNodeBuilder(r, r.low)
	nb.Resolve = true
	return nb.Render(), nil
}
