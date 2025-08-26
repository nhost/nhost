// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

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

// Example represents a low-level Example object as defined by OpenAPI 3+
//
//	v3 - https://spec.openapis.org/oas/v3.1.0#example-object
type Example struct {
	Summary       low.NodeReference[string]
	Description   low.NodeReference[string]
	Value         low.NodeReference[*yaml.Node]
	ExternalValue low.NodeReference[string]
	Extensions    *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
	KeyNode       *yaml.Node
	RootNode      *yaml.Node
	index         *index.SpecIndex
	context       context.Context
	*low.Reference
	low.NodeMap
}

// FindExtension returns a ValueReference containing the extension value, if found.
func (ex *Example) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap[*yaml.Node](ext, ex.Extensions)
}

// GetRootNode will return the root yaml node of the Example object
func (ex *Example) GetRootNode() *yaml.Node {
	return ex.RootNode
}

// GetKeyNode will return the key yaml node of the Example object
func (ex *Example) GetKeyNode() *yaml.Node {
	return ex.KeyNode
}

// Hash will return a consistent SHA256 Hash of the Discriminator object
func (ex *Example) Hash() [32]byte {
	var f []string
	if ex.Summary.Value != "" {
		f = append(f, ex.Summary.Value)
	}
	if ex.Description.Value != "" {
		f = append(f, ex.Description.Value)
	}
	if ex.Value.Value != nil && !ex.Value.Value.IsZero() {
		// this could be anything!
		b, _ := yaml.Marshal(ex.Value.Value)
		f = append(f, fmt.Sprintf("%x", sha256.Sum256(b)))
	}
	if ex.ExternalValue.Value != "" {
		f = append(f, ex.ExternalValue.Value)
	}
	f = append(f, low.HashExtensions(ex.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// Build extracts extensions and example value
func (ex *Example) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	ex.KeyNode = keyNode
	ex.Reference = new(low.Reference)
	if ok, _, ref := utils.IsNodeRefValue(root); ok {
		ex.SetReference(ref, root)
	}
	root = utils.NodeAlias(root)
	ex.RootNode = root
	utils.CheckForMergeNodes(root)
	ex.Nodes = low.ExtractNodes(ctx, root)
	ex.Extensions = low.ExtractExtensions(root)
	ex.context = ctx
	ex.index = idx

	_, ln, vn := utils.FindKeyNodeFull(ValueLabel, root.Content)

	if vn != nil {
		ex.Value = low.NodeReference[*yaml.Node]{
			Value:     vn,
			KeyNode:   ln,
			ValueNode: vn,
		}

		// extract nodes for all value nodes down the tree.
		expChildNodes := low.ExtractNodesRecursive(ctx, vn)
		expChildNodes.Range(func(k, v interface{}) bool {
			if arr, ko := v.([]*yaml.Node); ko {
				ex.Nodes.Store(k, arr)
			}
			return true
		})
		return nil
	}
	return nil
}

// GetExtensions will return Example extensions to satisfy the HasExtensions interface.
func (ex *Example) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return ex.Extensions
}

// GetIndex will return the index.SpecIndex instance attached to the Example object
func (ex *Example) GetIndex() *index.SpecIndex {
	return ex.index
}

// GetContext will return the context.Context instance used when building the Example object
func (ex *Example) GetContext() context.Context {
	return ex.context
}
