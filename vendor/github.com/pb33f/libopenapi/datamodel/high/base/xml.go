// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"github.com/pb33f/libopenapi/datamodel/high"
	low "github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// XML represents a high-level representation of an XML object defined by all versions of OpenAPI and backed by
// low-level XML object.
//
// A metadata object that allows for more fine-tuned XML model definitions.
//
// When using arrays, XML element names are not inferred (for singular/plural forms) and the name property SHOULD be
// used to add that information. See examples for expected behavior.
//
//	v2 - https://swagger.io/specification/v2/#xmlObject
//	v3 - https://swagger.io/specification/#xml-object
type XML struct {
	Name       string `json:"name,omitempty" yaml:"name,omitempty"`
	Namespace  string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Prefix     string `json:"prefix,omitempty" yaml:"prefix,omitempty"`
	Attribute  bool   `json:"attribute,omitempty" yaml:"attribute,omitempty"`
	Wrapped    bool   `json:"wrapped,omitempty" yaml:"wrapped,omitempty"`
	Extensions *orderedmap.Map[string, *yaml.Node]
	low        *low.XML
}

// NewXML creates a new high-level XML instance from a low-level one.
func NewXML(xml *low.XML) *XML {
	x := new(XML)
	x.low = xml
	x.Name = xml.Name.Value
	x.Namespace = xml.Namespace.Value
	x.Prefix = xml.Prefix.Value
	x.Attribute = xml.Attribute.Value
	x.Wrapped = xml.Wrapped.Value
	x.Extensions = high.ExtractExtensions(xml.Extensions)
	return x
}

// GoLow returns the low level XML reference used to create the high level one.
func (x *XML) GoLow() *low.XML {
	return x.low
}

// GoLowUntyped will return the low-level XML instance that was used to create the high-level one, with no type
func (x *XML) GoLowUntyped() any {
	return x.low
}

// Render will return a YAML representation of the XML object as a byte slice.
func (x *XML) Render() ([]byte, error) {
	return yaml.Marshal(x)
}

// MarshalYAML will create a ready to render YAML representation of the XML object.
func (x *XML) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(x, x.low)
	return nb.Render(), nil
}
