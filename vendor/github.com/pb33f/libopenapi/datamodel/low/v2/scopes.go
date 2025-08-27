// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v2

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// Scopes is a low-level representation of a Swagger / OpenAPI 2 OAuth2 Scopes object.
//
// Scopes lists the available scopes for an OAuth2 security scheme.
//   - https://swagger.io/specification/v2/#scopesObject
type Scopes struct {
	Values     *orderedmap.Map[low.KeyReference[string], low.ValueReference[string]]
	Extensions *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
}

// GetExtensions returns all Scopes extensions and satisfies the low.HasExtensions interface.
func (s *Scopes) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return s.Extensions
}

// FindScope will attempt to locate a scope string using a key.
func (s *Scopes) FindScope(scope string) *low.ValueReference[string] {
	return low.FindItemInOrderedMap[string](scope, s.Values)
}

// Build will extract scope values and extensions from node.
func (s *Scopes) Build(_ context.Context, _, root *yaml.Node, _ *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	s.Extensions = low.ExtractExtensions(root)
	valueMap := orderedmap.New[low.KeyReference[string], low.ValueReference[string]]()
	if utils.IsNodeMap(root) {
		for k := range root.Content {
			if k%2 == 0 {
				if strings.Contains(root.Content[k].Value, "x-") {
					continue
				}
				valueMap.Set(
					low.KeyReference[string]{
						Value:   root.Content[k].Value,
						KeyNode: root.Content[k],
					},
					low.ValueReference[string]{
						Value:     root.Content[k+1].Value,
						ValueNode: root.Content[k+1],
					},
				)
			}
		}
		s.Values = valueMap
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the Scopes object
func (s *Scopes) Hash() [32]byte {
	var f []string
	for k, v := range orderedmap.SortAlpha(s.Values).FromOldest() {
		f = append(f, fmt.Sprintf("%s-%s", k.Value, v.Value))
	}
	f = append(f, low.HashExtensions(s.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
