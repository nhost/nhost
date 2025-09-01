// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
)

// CallbackChanges represents all changes made between two Callback OpenAPI objects.
type CallbackChanges struct {
	*PropertyChanges
	ExpressionChanges map[string]*PathItemChanges `json:"expressions,omitempty" yaml:"expressions,omitempty"`
	ExtensionChanges  *ExtensionChanges           `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// TotalChanges returns a total count of all changes made between Callback objects
func (c *CallbackChanges) TotalChanges() int {
	d := c.PropertyChanges.TotalChanges()
	for k := range c.ExpressionChanges {
		d += c.ExpressionChanges[k].TotalChanges()
	}
	if c.ExtensionChanges != nil {
		d += c.ExtensionChanges.TotalChanges()
	}
	return d
}

// GetAllChanges returns a slice of all changes made between Callback objects
func (c *CallbackChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, c.Changes...)
	for k := range c.ExpressionChanges {
		changes = append(changes, c.ExpressionChanges[k].GetAllChanges()...)
	}
	if c.ExtensionChanges != nil {
		changes = append(changes, c.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalBreakingChanges returns a total count of all changes made between Callback objects
func (c *CallbackChanges) TotalBreakingChanges() int {
	d := c.PropertyChanges.TotalBreakingChanges()
	for k := range c.ExpressionChanges {
		d += c.ExpressionChanges[k].TotalBreakingChanges()
	}
	if c.ExtensionChanges != nil {
		d += c.ExtensionChanges.TotalBreakingChanges()
	}
	return d
}

// CompareCallback will compare two Callback objects and return a pointer to CallbackChanges with all the things
// that have changed between them.
func CompareCallback(l, r *v3.Callback) *CallbackChanges {
	cc := new(CallbackChanges)
	var changes []*Change

	lHashes := make(map[string]string)
	rHashes := make(map[string]string)

	lValues := make(map[string]low.ValueReference[*v3.PathItem])
	rValues := make(map[string]low.ValueReference[*v3.PathItem])

	for k, v := range l.Expression.FromOldest() {
		lHashes[k.Value] = low.GenerateHashString(v.Value)
		lValues[k.Value] = v
	}

	for k, v := range r.Expression.FromOldest() {
		rHashes[k.Value] = low.GenerateHashString(v.Value)
		rValues[k.Value] = v
	}

	expChanges := make(map[string]*PathItemChanges)

	// check left path item hashes
	for k := range lHashes {
		rhash := rHashes[k]
		if rhash == "" {
			CreateChange(&changes, ObjectRemoved, k,
				lValues[k].GetValueNode(), nil, true,
				lValues[k].GetValue(), nil)
			continue
		}
		if lHashes[k] == rHashes[k] {
			continue
		}
		// run comparison.
		expChanges[k] = ComparePathItems(lValues[k].Value, rValues[k].Value)
	}

	// check right path item hashes
	for k := range rHashes {
		lhash := lHashes[k]
		if lhash == "" {
			CreateChange(&changes, ObjectAdded, k,
				nil, rValues[k].GetValueNode(), false,
				nil, rValues[k].GetValue())
			continue
		}
	}
	cc.ExpressionChanges = expChanges
	cc.ExtensionChanges = CompareExtensions(l.Extensions, r.Extensions)
	cc.PropertyChanges = NewPropertyChanges(changes)
	if cc.TotalChanges() <= 0 {
		return nil
	}
	return cc
}
