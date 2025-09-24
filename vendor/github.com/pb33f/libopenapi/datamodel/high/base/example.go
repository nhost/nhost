// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"encoding/json"

	"github.com/pb33f/libopenapi/datamodel/high"
	"github.com/pb33f/libopenapi/datamodel/low"
	lowBase "github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// Example represents a high-level Example object as defined by OpenAPI 3+
//
//	v3 - https://spec.openapis.org/oas/v3.1.0#example-object
type Example struct {
	Summary       string                              `json:"summary,omitempty" yaml:"summary,omitempty"`
	Description   string                              `json:"description,omitempty" yaml:"description,omitempty"`
	Value         *yaml.Node                          `json:"value,omitempty" yaml:"value,omitempty"`
	ExternalValue string                              `json:"externalValue,omitempty" yaml:"externalValue,omitempty"`
	Extensions    *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low           *lowBase.Example
}

// NewExample will create a new instance of an Example, using a low-level Example.
func NewExample(example *lowBase.Example) *Example {
	e := new(Example)
	e.low = example
	e.Summary = example.Summary.Value
	e.Description = example.Description.Value
	e.Value = example.Value.Value
	e.ExternalValue = example.ExternalValue.Value
	e.Extensions = high.ExtractExtensions(example.Extensions)
	return e
}

// GoLow will return the low-level Example used to build the high level one.
func (e *Example) GoLow() *lowBase.Example {
	if e == nil {
		return nil
	}
	return e.low
}

// GoLowUntyped will return the low-level Example instance that was used to create the high-level one, with no type
func (e *Example) GoLowUntyped() any {
	if e == nil {
		return nil
	}
	return e.low
}

// Render will return a YAML representation of the Example object as a byte slice.
func (e *Example) Render() ([]byte, error) {
	return yaml.Marshal(e)
}

// MarshalYAML will create a ready to render YAML representation of the Example object.
func (e *Example) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(e, e.low)
	return nb.Render(), nil
}

// MarshalJSON will marshal this into a JSON byte slice
func (e *Example) MarshalJSON() ([]byte, error) {
	var g map[string]any
	nb := high.NewNodeBuilder(e, e.low)
	r := nb.Render()
	r.Decode(&g)
	return json.Marshal(g)
}

// ExtractExamples will convert a low-level example map, into a high level one that is simple to navigate.
// no fidelity is lost, everything is still available via GoLow()
func ExtractExamples(elements *orderedmap.Map[low.KeyReference[string], low.ValueReference[*lowBase.Example]]) *orderedmap.Map[string, *Example] {
	return low.FromReferenceMapWithFunc(elements, NewExample)
}
