// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// SecurityRequirementChanges represents changes found between two SecurityRequirement Objects.
type SecurityRequirementChanges struct {
	*PropertyChanges
}

// GetAllChanges returns a slice of all changes made between SecurityRequirement objects
func (s *SecurityRequirementChanges) GetAllChanges() []*Change {
	return s.Changes
}

// TotalChanges returns the total number of changes between two SecurityRequirement Objects.
func (s *SecurityRequirementChanges) TotalChanges() int {
	return s.PropertyChanges.TotalChanges()
}

// TotalBreakingChanges returns the total number of breaking changes between two SecurityRequirement Objects.
func (s *SecurityRequirementChanges) TotalBreakingChanges() int {
	return s.PropertyChanges.TotalBreakingChanges()
}

// CompareSecurityRequirement compares left and right SecurityRequirement objects for changes. If anything
// is found, then a pointer to SecurityRequirementChanges is returned, otherwise nil.
func CompareSecurityRequirement(l, r *base.SecurityRequirement) *SecurityRequirementChanges {
	var changes []*Change
	sc := new(SecurityRequirementChanges)

	if low.AreEqual(l, r) {
		return nil
	}
	checkSecurityRequirement(l.Requirements.Value, r.Requirements.Value, &changes)
	sc.PropertyChanges = NewPropertyChanges(changes)
	return sc
}

func removedSecurityRequirement(vn *yaml.Node, name string, changes *[]*Change) {
	CreateChange(changes, ObjectRemoved, v3.SecurityLabel,
		vn, nil, true, name, nil)
}

func addedSecurityRequirement(vn *yaml.Node, name string, changes *[]*Change) {
	CreateChange(changes, ObjectAdded, v3.SecurityLabel,
		nil, vn, false, nil, name)
}

// tricky to do this correctly, this is my solution.
func checkSecurityRequirement(lSec, rSec *orderedmap.Map[low.KeyReference[string], low.ValueReference[[]low.ValueReference[string]]],
	changes *[]*Change,
) {
	lKeys := make([]string, orderedmap.Len(lSec))
	rKeys := make([]string, orderedmap.Len(rSec))
	lValues := make(map[string]low.ValueReference[[]low.ValueReference[string]])
	rValues := make(map[string]low.ValueReference[[]low.ValueReference[string]])
	var n, z int
	for k, v := range lSec.FromOldest() {
		lKeys[n] = k.Value
		lValues[k.Value] = v
		n++
	}
	for k, v := range rSec.FromOldest() {
		rKeys[z] = k.Value
		rValues[k.Value] = v
		z++
	}

	for z = range lKeys {
		if z < len(rKeys) {
			if _, ok := rValues[lKeys[z]]; !ok {
				removedSecurityRequirement(lValues[lKeys[z]].ValueNode, lKeys[z], changes)
				continue
			}

			lValue := lValues[lKeys[z]].Value
			rValue := rValues[lKeys[z]].Value

			// check if actual values match up
			lRoleKeys := make([]string, len(lValue))
			rRoleKeys := make([]string, len(rValue))
			lRoleValues := make(map[string]low.ValueReference[string])
			rRoleValues := make(map[string]low.ValueReference[string])
			var t, k int
			for i := range lValue {
				lRoleKeys[t] = lValue[i].Value
				lRoleValues[lValue[i].Value] = lValue[i]
				t++
			}
			for i := range rValue {
				rRoleKeys[k] = rValue[i].Value
				rRoleValues[rValue[i].Value] = rValue[i]
				k++
			}

			for t = range lRoleKeys {
				if t < len(rRoleKeys) {
					if _, ok := rRoleValues[lRoleKeys[t]]; !ok {
						removedSecurityRequirement(lRoleValues[lRoleKeys[t]].ValueNode, lRoleKeys[t], changes)
						continue
					}
				}
				if t >= len(rRoleKeys) {
					if _, ok := rRoleValues[lRoleKeys[t]]; !ok {
						removedSecurityRequirement(lRoleValues[lRoleKeys[t]].ValueNode, lRoleKeys[t], changes)
					}
				}
			}
			for t = range rRoleKeys {
				if t < len(lRoleKeys) {
					if _, ok := lRoleValues[rRoleKeys[t]]; !ok {
						addedSecurityRequirement(rRoleValues[rRoleKeys[t]].ValueNode, rRoleKeys[t], changes)
						continue
					}
				}
				if t >= len(lRoleKeys) {
					addedSecurityRequirement(rRoleValues[rRoleKeys[t]].ValueNode, rRoleKeys[t], changes)
				}
			}

		}
		if z >= len(rKeys) {
			if _, ok := rValues[lKeys[z]]; !ok {
				removedSecurityRequirement(lValues[lKeys[z]].ValueNode, lKeys[z], changes)
			}
		}
	}
	for z = range rKeys {
		if z < len(lKeys) {
			if _, ok := lValues[rKeys[z]]; !ok {
				addedSecurityRequirement(rValues[rKeys[z]].ValueNode, rKeys[z], changes)
				continue
			}
		}
		if z >= len(lKeys) {
			if _, ok := lValues[rKeys[z]]; !ok {
				addedSecurityRequirement(rValues[rKeys[z]].ValueNode, rKeys[z], changes)
			}
		}
	}
}
