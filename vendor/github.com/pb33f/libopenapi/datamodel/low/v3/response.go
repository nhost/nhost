// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

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

// Response represents a high-level OpenAPI 3+ Response object that is backed by a low-level one.
//
// Describes a single response from an API Operation, including design-time, static links to
// operations based on the response.
//   - https://spec.openapis.org/oas/v3.1.0#response-object
type Response struct {
	Description low.NodeReference[string]
	Headers     low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Header]]]
	Content     low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*MediaType]]]
	Extensions  *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
	Links       low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Link]]]
	KeyNode     *yaml.Node
	RootNode    *yaml.Node
	index       *index.SpecIndex
	context     context.Context
	*low.Reference
	low.NodeMap
}

// GetIndex returns the index.SpecIndex instance attached to the Response object.
func (r *Response) GetIndex() *index.SpecIndex {
	return r.index
}

// GetContext returns the context.Context instance used when building the Response object.
func (r *Response) GetContext() context.Context {
	return r.context
}

// GetRootNode returns the root yaml node of the Response object.
func (r *Response) GetRootNode() *yaml.Node {
	return r.RootNode
}

// GetKeyNode returns the key yaml node of the Response object.
func (r *Response) GetKeyNode() *yaml.Node {
	return r.KeyNode
}

// FindExtension will attempt to locate an extension using the supplied key
func (r *Response) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, r.Extensions)
}

// GetExtensions returns all OAuthFlow extensions and satisfies the low.HasExtensions interface.
func (r *Response) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return r.Extensions
}

// FindContent will attempt to locate a MediaType instance using the supplied key.
func (r *Response) FindContent(cType string) *low.ValueReference[*MediaType] {
	return low.FindItemInOrderedMap[*MediaType](cType, r.Content.Value)
}

// FindHeader will attempt to locate a Header instance using the supplied key.
func (r *Response) FindHeader(hType string) *low.ValueReference[*Header] {
	return low.FindItemInOrderedMap[*Header](hType, r.Headers.Value)
}

// FindLink will attempt to locate a Link instance using the supplied key.
func (r *Response) FindLink(hType string) *low.ValueReference[*Link] {
	return low.FindItemInOrderedMap[*Link](hType, r.Links.Value)
}

// Build will extract headers, extensions, content and links from node.
func (r *Response) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	r.KeyNode = keyNode
	r.Reference = new(low.Reference)
	if ok, _, ref := utils.IsNodeRefValue(root); ok {
		r.SetReference(ref, root)
	}
	root = utils.NodeAlias(root)
	r.RootNode = root
	utils.CheckForMergeNodes(root)
	r.Nodes = low.ExtractNodes(ctx, root)
	r.Extensions = low.ExtractExtensions(root)
	r.index = idx
	r.context = ctx

	low.ExtractExtensionNodes(ctx, r.Extensions, r.Nodes)

	// extract headers
	headers, lN, kN, err := low.ExtractMapExtensions[*Header](ctx, HeadersLabel, root, idx, true)
	if err != nil {
		return err
	}
	if headers != nil {
		r.Headers = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Header]]]{
			Value:     headers,
			KeyNode:   lN,
			ValueNode: kN,
		}
		r.Nodes.Store(lN.Line, lN)
		for k, v := range headers.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
	}

	con, clN, cN, cErr := low.ExtractMap[*MediaType](ctx, ContentLabel, root, idx)
	if cErr != nil {
		return cErr
	}
	if con != nil {
		r.Content = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*MediaType]]]{
			Value:     con,
			KeyNode:   clN,
			ValueNode: cN,
		}
		r.Nodes.Store(clN.Line, clN)
		for k, v := range con.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
	}

	// handle links if set
	links, linkLabel, linkValue, lErr := low.ExtractMap[*Link](ctx, LinksLabel, root, idx)
	if lErr != nil {
		return lErr
	}
	if links != nil {
		r.Links = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Link]]]{
			Value:     links,
			KeyNode:   linkLabel,
			ValueNode: linkValue,
		}
		r.Nodes.Store(linkLabel.Line, linkLabel)
		for k, v := range links.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the Response object
func (r *Response) Hash() [32]byte {
	var f []string
	if r.Description.Value != "" {
		f = append(f, r.Description.Value)
	}
	f = low.AppendMapHashes(f, r.Headers.Value)
	f = low.AppendMapHashes(f, r.Content.Value)
	f = low.AppendMapHashes(f, r.Links.Value)
	f = append(f, low.HashExtensions(r.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
