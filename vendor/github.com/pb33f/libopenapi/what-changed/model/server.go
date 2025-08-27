// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/v3"
)

// ServerChanges represents changes found between two OpenAPI Server Objects
type ServerChanges struct {
	*PropertyChanges
	Server                *v3.Server
	ServerVariableChanges map[string]*ServerVariableChanges `json:"serverVariables,omitempty" yaml:"serverVariables,omitempty"`
	ExtensionChanges      *ExtensionChanges                 `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// GetAllChanges returns a slice of all changes made between SecurityRequirement objects
func (s *ServerChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, s.Changes...)
	for k := range s.ServerVariableChanges {
		changes = append(changes, s.ServerVariableChanges[k].GetAllChanges()...)
	}
	if s.ExtensionChanges != nil {
		changes = append(changes, s.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns total changes found between two OpenAPI Server Objects
func (s *ServerChanges) TotalChanges() int {
	c := s.PropertyChanges.TotalChanges()
	for k := range s.ServerVariableChanges {
		c += s.ServerVariableChanges[k].TotalChanges()
	}
	if s.ExtensionChanges != nil {
		c += s.ExtensionChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns the total number of breaking changes found between two OpenAPI Server objects.
func (s *ServerChanges) TotalBreakingChanges() int {
	c := s.PropertyChanges.TotalBreakingChanges()
	for k := range s.ServerVariableChanges {
		c += s.ServerVariableChanges[k].TotalBreakingChanges()
	}
	return c
}

// CompareServers compares two OpenAPI Server objects for any changes. If anything is found, returns a pointer
// to a ServerChanges instance, or returns nil if nothing is found.
func CompareServers(l, r *v3.Server) *ServerChanges {
	if low.AreEqual(l, r) {
		return nil
	}
	var changes []*Change
	var props []*PropertyCheck

	// URL
	props = append(props, &PropertyCheck{
		LeftNode:  l.URL.ValueNode,
		RightNode: r.URL.ValueNode,
		Label:     v3.URLLabel,
		Changes:   &changes,
		Breaking:  true,
		Original:  l,
		New:       r,
	})
	// Description
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
	sc := new(ServerChanges)
	sc.PropertyChanges = NewPropertyChanges(changes)
	sc.ServerVariableChanges = CheckMapForChanges(l.Variables.Value, r.Variables.Value,
		&changes, v3.VariablesLabel, CompareServerVariables)

	sc.ExtensionChanges = CompareExtensions(l.Extensions, r.Extensions)
	sc.Server = r
	return sc
}
