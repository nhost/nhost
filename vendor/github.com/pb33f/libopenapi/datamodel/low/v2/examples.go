// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v2

import (
	"context"
	"crypto/sha256"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// Examples represents a low-level Swagger / OpenAPI 2 Example object.
// Allows sharing examples for operation responses
//   - https://swagger.io/specification/v2/#exampleObject
type Examples struct {
	Values *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
}

// FindExample attempts to locate an example value, using a key label.
func (e *Examples) FindExample(name string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(name, e.Values)
}

// Build will extract all examples and will attempt to unmarshal content into a map or slice based on type.
func (e *Examples) Build(_ context.Context, _, root *yaml.Node, _ *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	var keyNode, currNode *yaml.Node
	e.Values = orderedmap.New[low.KeyReference[string], low.ValueReference[*yaml.Node]]()
	for i := range root.Content {
		if i%2 == 0 {
			keyNode = root.Content[i]
			continue
		}
		currNode = root.Content[i]

		e.Values.Set(
			low.KeyReference[string]{
				Value:   keyNode.Value,
				KeyNode: keyNode,
			},
			low.ValueReference[*yaml.Node]{
				Value:     currNode,
				ValueNode: currNode,
			},
		)
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the Examples object
func (e *Examples) Hash() [32]byte {
	var f []string
	for v := range orderedmap.SortAlpha(e.Values).ValuesFromOldest() {
		f = append(f, low.GenerateHashString(v.Value))
	}
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
