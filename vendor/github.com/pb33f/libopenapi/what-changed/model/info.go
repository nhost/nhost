// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low/base"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
)

// InfoChanges represents the number of changes to an Info object. Part of an OpenAPI document
type InfoChanges struct {
	*PropertyChanges
	ContactChanges   *ContactChanges   `json:"contact,omitempty" yaml:"contact,omitempty"`
	LicenseChanges   *LicenseChanges   `json:"license,omitempty" yaml:"license,omitempty"`
	ExtensionChanges *ExtensionChanges `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Info objects
func (i *InfoChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, i.Changes...)
	if i.ContactChanges != nil {
		changes = append(changes, i.ContactChanges.GetAllChanges()...)
	}
	if i.LicenseChanges != nil {
		changes = append(changes, i.LicenseChanges.GetAllChanges()...)
	}
	if i.ExtensionChanges != nil {
		changes = append(changes, i.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges represents the total number of changes made to an Info object.
func (i *InfoChanges) TotalChanges() int {
	t := i.PropertyChanges.TotalChanges()
	if i.ContactChanges != nil {
		t += i.ContactChanges.TotalChanges()
	}
	if i.LicenseChanges != nil {
		t += i.LicenseChanges.TotalChanges()
	}
	if i.ExtensionChanges != nil {
		t += i.ExtensionChanges.TotalChanges()
	}
	return t
}

// TotalBreakingChanges always returns 0 for Info objects, they are non-binding.
func (i *InfoChanges) TotalBreakingChanges() int {
	return 0
}

// CompareInfo will compare a left (original) and a right (new) Info object. Any changes
// will be returned in a pointer to InfoChanges, otherwise if nothing is found, then nil is
// returned instead.
func CompareInfo(l, r *base.Info) *InfoChanges {
	var changes []*Change
	var props []*PropertyCheck

	// Title
	props = append(props, &PropertyCheck{
		LeftNode:  l.Title.ValueNode,
		RightNode: r.Title.ValueNode,
		Label:     v3.TitleLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// Summary
	props = append(props, &PropertyCheck{
		LeftNode:  l.Summary.ValueNode,
		RightNode: r.Summary.ValueNode,
		Label:     v3.SummaryLabel,
		Changes:   &changes,
		Breaking:  false,
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

	// TermsOfService
	props = append(props, &PropertyCheck{
		LeftNode:  l.TermsOfService.ValueNode,
		RightNode: r.TermsOfService.ValueNode,
		Label:     v3.TermsOfServiceLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// Version
	props = append(props, &PropertyCheck{
		LeftNode:  l.Version.ValueNode,
		RightNode: r.Version.ValueNode,
		Label:     v3.VersionLabel,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// check properties
	CheckProperties(props)

	i := new(InfoChanges)

	// compare contact.
	if l.Contact.Value != nil && r.Contact.Value != nil {
		i.ContactChanges = CompareContact(l.Contact.Value, r.Contact.Value)
	} else {
		if l.Contact.Value == nil && r.Contact.Value != nil {
			CreateChange(&changes, ObjectAdded, v3.ContactLabel,
				nil, r.Contact.ValueNode, false, nil, r.Contact.Value)
		}
		if l.Contact.Value != nil && r.Contact.Value == nil {
			CreateChange(&changes, ObjectRemoved, v3.ContactLabel,
				l.Contact.ValueNode, nil, false, l.Contact.Value, nil)
		}
	}

	// compare license.
	if l.License.Value != nil && r.License.Value != nil {
		i.LicenseChanges = CompareLicense(l.License.Value, r.License.Value)
	} else {
		if l.License.Value == nil && r.License.Value != nil {
			CreateChange(&changes, ObjectAdded, v3.LicenseLabel,
				nil, r.License.ValueNode, false, nil, r.License.Value)
		}
		if l.License.Value != nil && r.License.Value == nil {
			CreateChange(&changes, ObjectRemoved, v3.LicenseLabel,
				l.License.ValueNode, nil, false, r.License.Value, nil)
		}
	}

	// check extensions.
	i.ExtensionChanges = CompareExtensions(l.Extensions, r.Extensions)

	i.PropertyChanges = NewPropertyChanges(changes)
	if i.TotalChanges() <= 0 {
		return nil
	}
	return i
}
