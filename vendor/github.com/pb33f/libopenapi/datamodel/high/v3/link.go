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

// Link represents a high-level OpenAPI 3+ Link object that is backed by a low-level one.
//
// The Link object represents a possible design-time link for a response. The presence of a link does not guarantee the
// caller’s ability to successfully invoke it, rather it provides a known relationship and traversal mechanism between
// responses and other operations.
//
// Unlike dynamic links (i.e. links provided in the response payload), the OAS linking mechanism does not require
// link information in the runtime response.
//
// For computing links, and providing instructions to execute them, a runtime expression is used for accessing values
// in an operation and using them as parameters while invoking the linked operation.
//   - https://spec.openapis.org/oas/v3.1.0#link-object
type Link struct {
	OperationRef string                              `json:"operationRef,omitempty" yaml:"operationRef,omitempty"`
	OperationId  string                              `json:"operationId,omitempty" yaml:"operationId,omitempty"`
	Parameters   *orderedmap.Map[string, string]     `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	RequestBody  string                              `json:"requestBody,omitempty" yaml:"requestBody,omitempty"`
	Description  string                              `json:"description,omitempty" yaml:"description,omitempty"`
	Server       *Server                             `json:"server,omitempty" yaml:"server,omitempty"`
	Extensions   *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low          *lowv3.Link
}

// NewLink will create a new high-level Link instance from a low-level one.
func NewLink(link *lowv3.Link) *Link {
	l := new(Link)
	l.low = link
	l.OperationRef = link.OperationRef.Value
	l.OperationId = link.OperationId.Value
	l.Parameters = low.FromReferenceMap(link.Parameters.Value)
	l.RequestBody = link.RequestBody.Value
	l.Description = link.Description.Value
	if link.Server.Value != nil {
		l.Server = NewServer(link.Server.Value)
	}
	l.Extensions = high.ExtractExtensions(link.Extensions)
	return l
}

// GoLow will return the low-level Link instance used to create the high-level one.
func (l *Link) GoLow() *lowv3.Link {
	return l.low
}

// GoLowUntyped will return the low-level Link instance that was used to create the high-level one, with no type
func (l *Link) GoLowUntyped() any {
	return l.low
}

// Render will return a YAML representation of the Link object as a byte slice.
func (l *Link) Render() ([]byte, error) {
	return yaml.Marshal(l)
}

// MarshalYAML will create a ready to render YAML representation of the Link object.
func (l *Link) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(l, l.low)
	return nb.Render(), nil
}
