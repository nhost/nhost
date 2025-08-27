// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"context"
	"crypto/sha256"
	"slices"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// MediaType represents a low-level OpenAPI MediaType object.
//
// Each Media Type Object provides schema and examples for the media type identified by its key.
//   - https://spec.openapis.org/oas/v3.1.0#media-type-object
type MediaType struct {
	Schema     low.NodeReference[*base.SchemaProxy]
	Example    low.NodeReference[*yaml.Node]
	Examples   low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*base.Example]]]
	Encoding   low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Encoding]]]
	Extensions *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
	KeyNode    *yaml.Node
	RootNode   *yaml.Node
	index      *index.SpecIndex
	context    context.Context
	*low.Reference
	low.NodeMap
}

// GetIndex returns the index.SpecIndex instance attached to the MediaType object.
func (mt *MediaType) GetIndex() *index.SpecIndex {
	return mt.index
}

// GetContext returns the context.Context instance used when building the MediaType object.
func (mt *MediaType) GetContext() context.Context {
	return mt.context
}

// GetExtensions returns all MediaType extensions and satisfies the low.HasExtensions interface.
func (mt *MediaType) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return mt.Extensions
}

// FindExtension will attempt to locate an extension with the supplied name.
func (mt *MediaType) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, mt.Extensions)
}

// FindPropertyEncoding will attempt to locate an Encoding value with a specific name.
func (mt *MediaType) FindPropertyEncoding(eType string) *low.ValueReference[*Encoding] {
	return low.FindItemInOrderedMap[*Encoding](eType, mt.Encoding.Value)
}

// FindExample will attempt to locate an Example with a specific name.
func (mt *MediaType) FindExample(eType string) *low.ValueReference[*base.Example] {
	return low.FindItemInOrderedMap[*base.Example](eType, mt.Examples.Value)
}

// GetAllExamples will extract all examples from the MediaType instance.
func (mt *MediaType) GetAllExamples() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*base.Example]] {
	return mt.Examples.Value
}

// GetRootNode returns the root yaml node of the MediaType object.
func (mt *MediaType) GetRootNode() *yaml.Node {
	return mt.RootNode
}

// GetKeyNode returns the key yaml node of the MediaType object.
func (mt *MediaType) GetKeyNode() *yaml.Node {
	return mt.KeyNode
}

// Build will extract examples, extensions, schema and encoding from node.
func (mt *MediaType) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	mt.KeyNode = keyNode
	root = utils.NodeAlias(root)
	mt.RootNode = root
	utils.CheckForMergeNodes(root)
	mt.Reference = new(low.Reference)
	mt.Nodes = low.ExtractNodes(ctx, root)
	mt.Extensions = low.ExtractExtensions(root)
	mt.index = idx
	mt.context = ctx

	low.ExtractExtensionNodes(ctx, mt.Extensions, mt.Nodes)

	// handle example if set.
	_, expLabel, expNode := utils.FindKeyNodeFullTop(base.ExampleLabel, root.Content)
	if expNode != nil {
		mt.Example = low.NodeReference[*yaml.Node]{Value: expNode, KeyNode: expLabel, ValueNode: expNode}
		mt.Nodes.Store(expLabel.Line, expLabel)
		m := low.ExtractNodesRecursive(ctx, expNode)
		m.Range(func(key, value any) bool {
			mt.Nodes.Store(key, value)
			return true
		})
	}

	// handle schema
	sch, sErr := base.ExtractSchema(ctx, root, idx)
	if sErr != nil {
		return sErr
	}
	if sch != nil {
		mt.Schema = *sch
	}

	// handle examples if set.
	exps, expsL, expsN, eErr := low.ExtractMap[*base.Example](ctx, base.ExamplesLabel, root, idx)
	if eErr != nil {
		return eErr
	}
	if exps != nil && slices.Contains(root.Content, expsL) {
		mt.Nodes.Store(expsL.Line, expsL)
		for k, v := range exps.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
		mt.Examples = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*base.Example]]]{
			Value:     exps,
			KeyNode:   expsL,
			ValueNode: expsN,
		}

	}

	// handle encoding
	encs, encsL, encsN, encErr := low.ExtractMap[*Encoding](ctx, EncodingLabel, root, idx)
	if encErr != nil {
		return encErr
	}
	if encs != nil {
		mt.Encoding = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Encoding]]]{
			Value:     encs,
			KeyNode:   encsL,
			ValueNode: encsN,
		}
		mt.Nodes.Store(encsL.Line, encsL)
		for k, v := range encs.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the MediaType object
func (mt *MediaType) Hash() [32]byte {
	var f []string
	if mt.Schema.Value != nil {
		f = append(f, low.GenerateHashString(mt.Schema.Value))
	}
	if mt.Example.Value != nil && !mt.Example.Value.IsZero() {
		f = append(f, low.GenerateHashString(mt.Example.Value))
	}
	for v := range orderedmap.SortAlpha(mt.Examples.Value).ValuesFromOldest() {
		f = append(f, low.GenerateHashString(v.Value))
	}
	for v := range orderedmap.SortAlpha(mt.Encoding.Value).ValuesFromOldest() {
		f = append(f, low.GenerateHashString(v.Value))
	}
	f = append(f, low.HashExtensions(mt.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
