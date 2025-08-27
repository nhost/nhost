// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

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

// Encoding represents a low-level OpenAPI 3+ Encoding object
//   - https://spec.openapis.org/oas/v3.1.0#encoding-object
type Encoding struct {
	ContentType   low.NodeReference[string]
	Headers       low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Header]]]
	Style         low.NodeReference[string]
	Explode       low.NodeReference[bool]
	AllowReserved low.NodeReference[bool]
	KeyNode       *yaml.Node
	RootNode      *yaml.Node
	index         *index.SpecIndex
	context       context.Context
	*low.Reference
	low.NodeMap
}

// GetIndex returns the index.SpecIndex instance attached to the Encoding object
func (en *Encoding) GetIndex() *index.SpecIndex {
	return en.index
}

// GetContext returns the context.Context instance used when building the Encoding object
func (en *Encoding) GetContext() context.Context {
	return en.context
}

// FindHeader attempts to locate a Header with the supplied name
func (en *Encoding) FindHeader(hType string) *low.ValueReference[*Header] {
	return low.FindItemInOrderedMap[*Header](hType, en.Headers.Value)
}

// GetRootNode returns the root yaml node of the Encoding object
func (en *Encoding) GetRootNode() *yaml.Node {
	return en.RootNode
}

// GetKeyNode returns the key yaml node of the Encoding object
func (en *Encoding) GetKeyNode() *yaml.Node {
	return en.KeyNode
}

// Hash will return a consistent SHA256 Hash of the Encoding object
func (en *Encoding) Hash() [32]byte {
	var f []string
	if en.ContentType.Value != "" {
		f = append(f, en.ContentType.Value)
	}
	for k, v := range orderedmap.SortAlpha(en.Headers.Value).FromOldest() {
		f = append(f, fmt.Sprintf("%s-%x", k.Value, v.Value.Hash()))
	}
	if en.Style.Value != "" {
		f = append(f, en.Style.Value)
	}
	f = append(f, fmt.Sprint(sha256.Sum256([]byte(fmt.Sprint(en.Explode.Value)))))
	f = append(f, fmt.Sprint(sha256.Sum256([]byte(fmt.Sprint(en.AllowReserved.Value)))))
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// Build will extract all Header objects from supplied node.
func (en *Encoding) Build(ctx context.Context, keyNode, root *yaml.Node, idx *index.SpecIndex) error {
	en.KeyNode = keyNode
	root = utils.NodeAlias(root)
	en.RootNode = root
	utils.CheckForMergeNodes(root)
	en.Nodes = low.ExtractNodes(ctx, root)
	en.Reference = new(low.Reference)
	en.index = idx
	en.context = ctx

	headers, hL, hN, err := low.ExtractMap[*Header](ctx, HeadersLabel, root, idx)
	if err != nil {
		return err
	}
	if headers != nil {
		en.Headers = low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*Header]]]{
			Value:     headers,
			KeyNode:   hL,
			ValueNode: hN,
		}
		en.Nodes.Store(hL.Line, hL)
		for k, v := range headers.FromOldest() {
			v.Value.Nodes.Store(k.KeyNode.Line, k.KeyNode)
		}
	}
	return nil
}
