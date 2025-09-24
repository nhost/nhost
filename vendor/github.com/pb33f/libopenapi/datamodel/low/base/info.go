// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"context"
	"crypto/sha256"
	"strings"

	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"gopkg.in/yaml.v3"
)

// Info represents a low-level Info object as defined by both OpenAPI 2 and OpenAPI 3.
//
// The object provides metadata about the API. The metadata MAY be used by the clients if needed, and MAY be presented
// in editing or documentation generation tools for convenience.
//
//	v2 - https://swagger.io/specification/v2/#infoObject
//	v3 - https://spec.openapis.org/oas/v3.1.0#info-object
type Info struct {
	Title          low.NodeReference[string]
	Summary        low.NodeReference[string]
	Description    low.NodeReference[string]
	TermsOfService low.NodeReference[string]
	Contact        low.NodeReference[*Contact]
	License        low.NodeReference[*License]
	Version        low.NodeReference[string]
	Extensions     *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
	KeyNode        *yaml.Node
	RootNode       *yaml.Node
	index          *index.SpecIndex
	context        context.Context
	*low.Reference
	low.NodeMap
}

// FindExtension attempts to locate an extension with the supplied key
func (i *Info) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, i.Extensions)
}

// GetRootNode will return the root yaml node of the Info object
func (i *Info) GetRootNode() *yaml.Node {
	return i.RootNode
}

// GetKeyNode will return the key yaml node of the Info object
func (i *Info) GetKeyNode() *yaml.Node {
	return i.KeyNode
}

// GetExtensions returns all extensions for Info
func (i *Info) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return i.Extensions
}

// Build will extract out the Contact and Info objects from the supplied root node.
func (i *Info) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	i.KeyNode = keyNode
	root = utils.NodeAlias(root)
	i.RootNode = root
	utils.CheckForMergeNodes(root)
	i.Reference = new(low.Reference)
	i.Nodes = low.ExtractNodes(ctx, root)
	i.Extensions = low.ExtractExtensions(root)
	i.index = idx
	i.context = ctx

	// extract contact
	contact, _ := low.ExtractObject[*Contact](ctx, ContactLabel, root, idx)
	i.Contact = contact

	// extract license
	lic, _ := low.ExtractObject[*License](ctx, LicenseLabel, root, idx)
	i.License = lic
	return nil
}

// GetIndex will return the index.SpecIndex instance attached to the Info object
func (i *Info) GetIndex() *index.SpecIndex {
	return i.index
}

// GetContext will return the context.Context instance used when building the Info object
func (i *Info) GetContext() context.Context {
	return i.context
}

// Hash will return a consistent SHA256 Hash of the Info object
func (i *Info) Hash() [32]byte {
	var f []string

	if !i.Title.IsEmpty() {
		f = append(f, i.Title.Value)
	}
	if !i.Summary.IsEmpty() {
		f = append(f, i.Summary.Value)
	}
	if !i.Description.IsEmpty() {
		f = append(f, i.Description.Value)
	}
	if !i.TermsOfService.IsEmpty() {
		f = append(f, i.TermsOfService.Value)
	}
	if !i.Contact.IsEmpty() {
		f = append(f, low.GenerateHashString(i.Contact.Value))
	}
	if !i.License.IsEmpty() {
		f = append(f, low.GenerateHashString(i.License.Value))
	}
	if !i.Version.IsEmpty() {
		f = append(f, i.Version.Value)
	}
	f = append(f, low.HashExtensions(i.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
