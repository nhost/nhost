// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"github.com/pb33f/libopenapi/datamodel/high"
	"github.com/pb33f/libopenapi/datamodel/low"
	lowv3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// Response represents a high-level OpenAPI 3+ Response object that is backed by a low-level one.
//
// Describes a single response from an API Operation, including design-time, static links to
// operations based on the response.
//   - https://spec.openapis.org/oas/v3.1.0#response-object
type Response struct {
	Description string                              `json:"description" yaml:"description"`
	Headers     *orderedmap.Map[string, *Header]    `json:"headers,omitempty" yaml:"headers,omitempty"`
	Content     *orderedmap.Map[string, *MediaType] `json:"content,omitempty" yaml:"content,omitempty"`
	Links       *orderedmap.Map[string, *Link]      `json:"links,omitempty" yaml:"links,omitempty"`
	Extensions  *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low         *lowv3.Response
}

// NewResponse creates a new high-level Response object that is backed by a low-level one.
func NewResponse(response *lowv3.Response) *Response {
	r := new(Response)
	r.low = response
	r.Description = response.Description.Value
	if !response.Headers.IsEmpty() {
		r.Headers = ExtractHeaders(response.Headers.Value)
	}
	r.Extensions = high.ExtractExtensions(response.Extensions)
	if !response.Content.IsEmpty() {
		r.Content = ExtractContent(response.Content.Value)
	}
	if !response.Links.IsEmpty() {
		r.Links = low.FromReferenceMapWithFunc(response.Links.Value, NewLink)
	}
	return r
}

// GoLow returns the low-level Response object that was used to create the high-level one.
func (r *Response) GoLow() *lowv3.Response {
	return r.low
}

// GoLowUntyped will return the low-level Response instance that was used to create the high-level one, with no type
func (r *Response) GoLowUntyped() any {
	return r.low
}

// Render will return a YAML representation of the Response object as a byte slice.
func (r *Response) Render() ([]byte, error) {
	return yaml.Marshal(r)
}

func (r *Response) RenderInline() ([]byte, error) {
	d, _ := r.MarshalYAMLInline()
	return yaml.Marshal(d)
}

// MarshalYAML will create a ready to render YAML representation of the Response object.
func (r *Response) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(r, r.low)
	return nb.Render(), nil
}

func (r *Response) MarshalYAMLInline() (interface{}, error) {
	nb := high.NewNodeBuilder(r, r.low)
	nb.Resolve = true
	return nb.Render(), nil
}
