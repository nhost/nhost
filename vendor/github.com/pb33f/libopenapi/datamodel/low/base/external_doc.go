// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

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

// ExternalDoc represents a low-level External Documentation object as defined by OpenAPI 2 and 3
//
// Allows referencing an external resource for extended documentation.
//
//	v2 - https://swagger.io/specification/v2/#externalDocumentationObject
//	v3 - https://spec.openapis.org/oas/v3.1.0#external-documentation-object
type ExternalDoc struct {
	Description low.NodeReference[string]
	URL         low.NodeReference[string]
	Extensions  *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
	KeyNode     *yaml.Node
	RootNode    *yaml.Node
	index       *index.SpecIndex
	context     context.Context
	*low.Reference
	low.NodeMap
}

// FindExtension returns a ValueReference containing the extension value, if found.
func (ex *ExternalDoc) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap[*yaml.Node](ext, ex.Extensions)
}

// GetRootNode will return the root yaml node of the ExternalDoc object
func (ex *ExternalDoc) GetRootNode() *yaml.Node {
	return ex.RootNode
}

// GetKeyNode will return the key yaml node of the ExternalDoc object
func (ex *ExternalDoc) GetKeyNode() *yaml.Node {
	return ex.KeyNode
}

// Build will extract extensions from the ExternalDoc instance.
func (ex *ExternalDoc) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	ex.KeyNode = keyNode
	root = utils.NodeAlias(root)
	ex.RootNode = root
	utils.CheckForMergeNodes(root)
	ex.Reference = new(low.Reference)
	ex.Nodes = low.ExtractNodes(ctx, root)
	ex.Extensions = low.ExtractExtensions(root)
	ex.context = ctx
	ex.index = idx
	return nil
}

// GetExtensions returns all ExternalDoc extensions and satisfies the low.HasExtensions interface.
func (ex *ExternalDoc) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return ex.Extensions
}

func (ex *ExternalDoc) Hash() [32]byte {
	// calculate a hash from every property.
	f := []string{
		ex.Description.Value,
		ex.URL.Value,
	}
	f = append(f, low.HashExtensions(ex.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// GetIndex returns the index.SpecIndex instance attached to the ExternalDoc object
func (ex *ExternalDoc) GetIndex() *index.SpecIndex {
	return ex.index
}

// GetContext returns the context.Context instance used when building the ExternalDoc object
func (ex *ExternalDoc) GetContext() context.Context {
	return ex.context
}
