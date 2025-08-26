// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/v3"
)

// ServerVariableChanges represents changes found between two OpenAPI ServerVariable Objects
type ServerVariableChanges struct {
	*PropertyChanges
}

// GetAllChanges returns a slice of all changes made between SecurityRequirement objects
func (s *ServerVariableChanges) GetAllChanges() []*Change {
	return s.Changes
}

// CompareServerVariables compares a left and right OpenAPI ServerVariable object for changes.
// If anything is found, returns a pointer to a ServerVariableChanges instance, otherwise returns nil.
func CompareServerVariables(l, r *v3.ServerVariable) *ServerVariableChanges {
	if low.AreEqual(l, r) {
		return nil
	}

	var props []*PropertyCheck
	var changes []*Change

	lValues := make(map[string]low.NodeReference[string])
	rValues := make(map[string]low.NodeReference[string])
	for i := range l.Enum {
		lValues[l.Enum[i].Value] = l.Enum[i]
	}
	for i := range r.Enum {
		rValues[r.Enum[i].Value] = r.Enum[i]
	}
	for k := range lValues {
		if _, ok := rValues[k]; !ok {
			CreateChange(&changes, ObjectRemoved, v3.EnumLabel,
				lValues[k].ValueNode, nil, true,
				lValues[k].Value, nil)
			continue
		}
	}
	for k := range rValues {
		if _, ok := lValues[k]; !ok {
			CreateChange(&changes, ObjectAdded, v3.EnumLabel,
				lValues[k].ValueNode, rValues[k].ValueNode, false,
				lValues[k].Value, rValues[k].Value)
		}
	}

	// default
	props = append(props, &PropertyCheck{
		LeftNode:  l.Default.ValueNode,
		RightNode: r.Default.ValueNode,
		Label:     v3.DefaultLabel,
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

	// check everything.
	CheckProperties(props)
	sc := new(ServerVariableChanges)
	sc.PropertyChanges = NewPropertyChanges(changes)
	return sc
}
