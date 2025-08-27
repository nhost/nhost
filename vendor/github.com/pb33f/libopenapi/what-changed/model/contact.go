// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/datamodel/low/v3"
)

// ContactChanges Represent changes to a Contact object that is a child of Info, part of an OpenAPI document.
type ContactChanges struct {
	*PropertyChanges
}

// GetAllChanges returns a slice of all changes made between Callback objects
func (c *ContactChanges) GetAllChanges() []*Change {
	return c.Changes
}

// TotalChanges represents the total number of changes that have occurred to a Contact object
func (c *ContactChanges) TotalChanges() int {
	return c.PropertyChanges.TotalChanges()
}

// TotalBreakingChanges always returns 0 for Contact objects, they are non-binding.
func (c *ContactChanges) TotalBreakingChanges() int {
	return 0
}

// CompareContact will check a left (original) and right (new) Contact object for any changes. If there
// were any, a pointer to a ContactChanges object is returned, otherwise if nothing changed - the function
// returns nil.
func CompareContact(l, r *base.Contact) *ContactChanges {

	var changes []*Change
	var props []*PropertyCheck

	// check URL
	props = append(props, &PropertyCheck{
		LeftNode:  l.URL.ValueNode,
		RightNode: r.URL.ValueNode,
		Label:     v3.URLLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// check name
	props = append(props, &PropertyCheck{
		LeftNode:  l.Name.ValueNode,
		RightNode: r.Name.ValueNode,
		Label:     v3.NameLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// check email
	props = append(props, &PropertyCheck{
		LeftNode:  l.Email.ValueNode,
		RightNode: r.Email.ValueNode,
		Label:     v3.EmailLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// check everything.
	CheckProperties(props)

	dc := new(ContactChanges)
	dc.PropertyChanges = NewPropertyChanges(changes)
	if dc.TotalChanges() <= 0 {
		return nil
	}
	return dc
}
