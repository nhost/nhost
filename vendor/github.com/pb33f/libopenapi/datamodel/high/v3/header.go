// Copyright 2022-2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"github.com/pb33f/libopenapi/datamodel/high"
	highbase "github.com/pb33f/libopenapi/datamodel/high/base"
	"github.com/pb33f/libopenapi/datamodel/low"
	lowmodel "github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	lowv3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// Header represents a high-level OpenAPI 3+ Header object that is backed by a low-level one.
//   - https://spec.openapis.org/oas/v3.1.0#header-object
type Header struct {
	Description     string                                     `json:"description,omitempty" yaml:"description,omitempty"`
	Required        bool                                       `json:"required,omitempty" yaml:"required,omitempty"`
	Deprecated      bool                                       `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	AllowEmptyValue bool                                       `json:"allowEmptyValue,omitempty" yaml:"allowEmptyValue,omitempty"`
	Style           string                                     `json:"style,omitempty" yaml:"style,omitempty"`
	Explode         bool                                       `json:"explode,omitempty" yaml:"explode,omitempty"`
	AllowReserved   bool                                       `json:"allowReserved,omitempty" yaml:"allowReserved,omitempty"`
	Schema          *highbase.SchemaProxy                      `json:"schema,omitempty" yaml:"schema,omitempty"`
	Example         *yaml.Node                                 `json:"example,omitempty" yaml:"example,omitempty"`
	Examples        *orderedmap.Map[string, *highbase.Example] `json:"examples,omitempty" yaml:"examples,omitempty"`
	Content         *orderedmap.Map[string, *MediaType]        `json:"content,omitempty" yaml:"content,omitempty"`
	Extensions      *orderedmap.Map[string, *yaml.Node]        `json:"-" yaml:"-"`
	low             *lowv3.Header
}

// NewHeader creates a new high-level Header instance from a low-level one.
func NewHeader(header *lowv3.Header) *Header {
	h := new(Header)
	h.low = header
	h.Description = header.Description.Value
	h.Required = header.Required.Value
	h.Deprecated = header.Deprecated.Value
	h.AllowEmptyValue = header.AllowEmptyValue.Value
	h.Style = header.Style.Value
	h.Explode = header.Explode.Value
	h.AllowReserved = header.AllowReserved.Value
	if !header.Schema.IsEmpty() {
		h.Schema = highbase.NewSchemaProxy(&lowmodel.NodeReference[*base.SchemaProxy]{
			Value:     header.Schema.Value,
			KeyNode:   header.Schema.KeyNode,
			ValueNode: header.Schema.ValueNode,
		})
	}
	h.Content = ExtractContent(header.Content.Value)
	h.Example = header.Example.Value
	h.Examples = highbase.ExtractExamples(header.Examples.Value)
	h.Extensions = high.ExtractExtensions(header.Extensions)
	return h
}

// GoLow returns the low-level Header instance used to create the high-level one.
func (h *Header) GoLow() *lowv3.Header {
	return h.low
}

// GoLowUntyped will return the low-level Header instance that was used to create the high-level one, with no type
func (h *Header) GoLowUntyped() any {
	return h.low
}

// ExtractHeaders will extract a hard to navigate low-level Header map, into simple high-level one.
func ExtractHeaders(elements *orderedmap.Map[lowmodel.KeyReference[string], lowmodel.ValueReference[*lowv3.Header]]) *orderedmap.Map[string, *Header] {
	return low.FromReferenceMapWithFunc(elements, NewHeader)
}

// Render will return a YAML representation of the Header object as a byte slice.
func (h *Header) Render() ([]byte, error) {
	return yaml.Marshal(h)
}

// MarshalYAML will create a ready to render YAML representation of the Header object.
func (h *Header) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(h, h.low)
	return nb.Render(), nil
}
