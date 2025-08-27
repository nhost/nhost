// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
)

// LinkChanges represent changes made between two OpenAPI Link Objects.
type LinkChanges struct {
	*PropertyChanges
	ExtensionChanges *ExtensionChanges `json:"extensions,omitempty" yaml:"extensions,omitempty"`
	ServerChanges    *ServerChanges    `json:"server,omitempty" yaml:"server,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Link objects
func (l *LinkChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, l.Changes...)
	if l.ServerChanges != nil {
		changes = append(changes, l.ServerChanges.GetAllChanges()...)
	}
	if l.ExtensionChanges != nil {
		changes = append(changes, l.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns the total changes made between OpenAPI Link objects
func (l *LinkChanges) TotalChanges() int {
	c := l.PropertyChanges.TotalChanges()
	if l.ExtensionChanges != nil {
		c += l.ExtensionChanges.TotalChanges()
	}
	if l.ServerChanges != nil {
		c += l.ServerChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns the number of breaking changes made between two OpenAPI Link Objects
func (l *LinkChanges) TotalBreakingChanges() int {
	c := l.PropertyChanges.TotalBreakingChanges()
	if l.ServerChanges != nil {
		c += l.ServerChanges.TotalBreakingChanges()
	}
	return c
}

// CompareLinks checks a left and right OpenAPI Link for any changes. If they are found, returns a pointer to
// LinkChanges, and returns nil if nothing is found.
func CompareLinks(l, r *v3.Link) *LinkChanges {
	if low.AreEqual(l, r) {
		return nil
	}

	var props []*PropertyCheck
	var changes []*Change

	// operation ref
	props = append(props, &PropertyCheck{
		LeftNode:  l.OperationRef.ValueNode,
		RightNode: r.OperationRef.ValueNode,
		Label:     v3.OperationRefLabel,
		Changes:   &changes,
		Breaking:  true,
		Original:  l,
		New:       r,
	})

	// operation id
	props = append(props, &PropertyCheck{
		LeftNode:  l.OperationId.ValueNode,
		RightNode: r.OperationId.ValueNode,
		Label:     v3.OperationIdLabel,
		Changes:   &changes,
		Breaking:  true,
		Original:  l,
		New:       r,
	})

	// request body
	props = append(props, &PropertyCheck{
		LeftNode:  l.RequestBody.ValueNode,
		RightNode: r.RequestBody.ValueNode,
		Label:     v3.RequestBodyLabel,
		Changes:   &changes,
		Breaking:  true,
		Original:  l,
		New:       r,
	})

	// description
	props = append(props, &PropertyCheck{
		LeftNode:  l.Description.ValueNode,
		RightNode: r.Description.ValueNode,
		Label:     v3.DescriptionLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	CheckProperties(props)
	lc := new(LinkChanges)
	lc.ExtensionChanges = CompareExtensions(l.Extensions, r.Extensions)

	// server
	if !l.Server.IsEmpty() && !r.Server.IsEmpty() {
		if !low.AreEqual(l.Server.Value, r.Server.Value) {
			lc.ServerChanges = CompareServers(l.Server.Value, r.Server.Value)
		}
	}
	if !l.Server.IsEmpty() && r.Server.IsEmpty() {
		CreateChange(&changes, PropertyRemoved, v3.ServerLabel,
			l.Server.ValueNode, nil, true,
			l.Server.Value, nil)
	}
	if l.Server.IsEmpty() && !r.Server.IsEmpty() {
		CreateChange(&changes, PropertyAdded, v3.ServerLabel,
			nil, r.Server.ValueNode, true,
			nil, r.Server.Value)
	}

	// parameters
	lValues := make(map[string]low.ValueReference[string])
	rValues := make(map[string]low.ValueReference[string])
	for k, v := range l.Parameters.Value.FromOldest() {
		lValues[k.Value] = v
	}
	for k, v := range r.Parameters.Value.FromOldest() {
		rValues[k.Value] = v
	}
	for k := range lValues {
		if _, ok := rValues[k]; !ok {
			CreateChange(&changes, ObjectRemoved, v3.ParametersLabel,
				lValues[k].ValueNode, nil, true,
				k, nil)
			continue
		}
		if lValues[k].Value != rValues[k].Value {
			CreateChange(&changes, Modified, v3.ParametersLabel,
				lValues[k].ValueNode, rValues[k].ValueNode, true,
				k, k)
		}

	}
	for k := range rValues {
		if _, ok := lValues[k]; !ok {
			CreateChange(&changes, ObjectAdded, v3.ParametersLabel,
				nil, rValues[k].ValueNode, true,
				nil, k)
		}
	}

	lc.PropertyChanges = NewPropertyChanges(changes)
	return lc
}
