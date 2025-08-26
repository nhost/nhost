// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"crypto/sha256"
	"fmt"
	"sort"

	"gopkg.in/yaml.v3"

	"github.com/pb33f/libopenapi/datamodel/low/base"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/utils"
)

// ExampleChanges represent changes to an Example object, part of an OpenAPI specification.
type ExampleChanges struct {
	*PropertyChanges
	ExtensionChanges *ExtensionChanges `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Example objects
func (e *ExampleChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, e.Changes...)
	if e.ExtensionChanges != nil {
		changes = append(changes, e.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns the total number of changes made to Example
func (e *ExampleChanges) TotalChanges() int {
	l := e.PropertyChanges.TotalChanges()
	if e.ExtensionChanges != nil {
		l += e.ExtensionChanges.PropertyChanges.TotalChanges()
	}
	return l
}

// TotalBreakingChanges returns the total number of breaking changes made to Example
func (e *ExampleChanges) TotalBreakingChanges() int {
	l := e.PropertyChanges.TotalBreakingChanges()
	return l
}

// CompareExamples returns a pointer to ExampleChanges that contains all changes made between
// left and right Example instances.
func CompareExamples(l, r *base.Example) *ExampleChanges {

	ec := new(ExampleChanges)
	var changes []*Change
	var props []*PropertyCheck

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

	// Value
	if utils.IsNodeMap(l.Value.ValueNode) && utils.IsNodeMap(r.Value.ValueNode) {
		lKeys := make([]string, len(l.Value.ValueNode.Content)/2)
		rKeys := make([]string, len(r.Value.ValueNode.Content)/2)
		z := 0
		for k := range l.Value.ValueNode.Content {
			if k%2 == 0 {
				// if there is no value (value is another map or something else), render the node into yaml and hash it.
				// https://github.com/pb33f/libopenapi/issues/61
				val := l.Value.ValueNode.Content[k+1].Value
				if val == "" {
					yaml, _ := yaml.Marshal(l.Value.ValueNode.Content[k+1].Content)
					val = fmt.Sprint(sha256.Sum256(yaml))
				}
				lKeys[z] = fmt.Sprintf("%v-%v-%v",
					l.Value.ValueNode.Content[k].Value,
					l.Value.ValueNode.Content[k+1].Tag,
					fmt.Sprintf("%x", val))
				z++
			} else {
				continue
			}
		}
		z = 0
		for k := range r.Value.ValueNode.Content {
			if k%2 == 0 {
				// if there is no value (value is another map or something else), render the node into yaml and hash it.
				// https://github.com/pb33f/libopenapi/issues/61
				val := r.Value.ValueNode.Content[k+1].Value
				if val == "" {
					yaml, _ := yaml.Marshal(r.Value.ValueNode.Content[k+1].Content)
					val = fmt.Sprint(sha256.Sum256(yaml))
				}
				rKeys[z] = fmt.Sprintf("%v-%v-%v",
					r.Value.ValueNode.Content[k].Value,
					r.Value.ValueNode.Content[k+1].Tag,
					fmt.Sprintf("%x", val))
				z++
			} else {
				continue
			}
		}
		sort.Strings(lKeys)
		sort.Strings(rKeys)
		//if (len(lKeys) > len(rKeys)) || (len(rKeys) > len(lKeys)) {
		//    CreateChange(&changes, Modified, v3.ValueLabel,
		//        l.Value.GetValueNode(), r.Value.GetValueNode(), false, l.Value.GetValue(), r.Value.GetValue())
		//}
		for k := range lKeys {
			if k < len(rKeys) && lKeys[k] != rKeys[k] {

				if utils.IsNodeMap(l.Value.ValueNode) || utils.IsNodeArray(l.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(l.Value.ValueNode)
					l.Value.ValueNode.Value = string(rendered)
				}

				if utils.IsNodeMap(r.Value.ValueNode) || utils.IsNodeArray(r.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(r.Value.ValueNode)
					r.Value.ValueNode.Value = string(rendered)
				}

				CreateChange(&changes, Modified, v3.ValueLabel,
					l.Value.GetValueNode(), r.Value.GetValueNode(), false, l.Value.GetValue(), r.Value.GetValue())
				continue
			}
			if k >= len(rKeys) {

				if utils.IsNodeMap(l.Value.ValueNode) || utils.IsNodeArray(l.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(l.Value.ValueNode)
					l.Value.ValueNode.Value = string(rendered)
				}

				if utils.IsNodeMap(r.Value.ValueNode) || utils.IsNodeArray(r.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(r.Value.ValueNode)
					r.Value.ValueNode.Value = string(rendered)
				}

				CreateChange(&changes, PropertyRemoved, v3.ValueLabel,
					l.Value.ValueNode, r.Value.ValueNode, false, l.Value.Value, r.Value.Value)
			}
		}
		for k := range rKeys {
			if k >= len(lKeys) {

				if utils.IsNodeMap(l.Value.ValueNode) || utils.IsNodeArray(l.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(l.Value.ValueNode)
					l.Value.ValueNode.Value = string(rendered)
				}

				if utils.IsNodeMap(r.Value.ValueNode) || utils.IsNodeArray(r.Value.ValueNode) {
					// render down object
					rendered, _ := yaml.Marshal(r.Value.ValueNode)
					r.Value.ValueNode.Value = string(rendered)
				}

				CreateChange(&changes, PropertyAdded, v3.ValueLabel,
					l.Value.ValueNode, r.Value.ValueNode, false, l.Value.Value, r.Value.Value)
			}
		}
	} else {
		props = append(props, &PropertyCheck{
			LeftNode:  l.Value.ValueNode,
			RightNode: r.Value.ValueNode,
			Label:     v3.ValueLabel,
			Changes:   &changes,
			Breaking:  false,
			Original:  l,
			New:       r,
		})
	}
	// ExternalValue
	props = append(props, &PropertyCheck{
		LeftNode:  l.ExternalValue.ValueNode,
		RightNode: r.ExternalValue.ValueNode,
		Label:     v3.ExternalValue,
		Changes:   &changes,
		Breaking:  false,
		Original:  l,
		New:       r,
	})

	// check properties
	CheckProperties(props)

	// check extensions
	ec.ExtensionChanges = CheckExtensions(l, r)
	ec.PropertyChanges = NewPropertyChanges(changes)
	if ec.TotalChanges() <= 0 {
		return nil
	}
	return ec
}
