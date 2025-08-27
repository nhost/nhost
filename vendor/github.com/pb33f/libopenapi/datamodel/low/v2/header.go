// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v2

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// Header Represents a low-level Swagger / OpenAPI 2 Header object.
//
// A Header is essentially identical to a Parameter, except it does not contain 'name' or 'in' properties.
//   - https://swagger.io/specification/v2/#headerObject
type Header struct {
	Type             low.NodeReference[string]
	Format           low.NodeReference[string]
	Description      low.NodeReference[string]
	Items            low.NodeReference[*Items]
	CollectionFormat low.NodeReference[string]
	Default          low.NodeReference[*yaml.Node]
	Maximum          low.NodeReference[int]
	ExclusiveMaximum low.NodeReference[bool]
	Minimum          low.NodeReference[int]
	ExclusiveMinimum low.NodeReference[bool]
	MaxLength        low.NodeReference[int]
	MinLength        low.NodeReference[int]
	Pattern          low.NodeReference[string]
	MaxItems         low.NodeReference[int]
	MinItems         low.NodeReference[int]
	UniqueItems      low.NodeReference[bool]
	Enum             low.NodeReference[[]low.ValueReference[*yaml.Node]]
	MultipleOf       low.NodeReference[int]
	Extensions       *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
}

// FindExtension will attempt to locate an extension value using a name lookup.
func (h *Header) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, h.Extensions)
}

// GetExtensions returns all Header extensions and satisfies the low.HasExtensions interface.
func (h *Header) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return h.Extensions
}

// Build will build out items, extensions and default value from the supplied node.
func (h *Header) Build(ctx context.Context, _, root *yaml.Node, idx *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	h.Extensions = low.ExtractExtensions(root)
	items, err := low.ExtractObject[*Items](ctx, ItemsLabel, root, idx)
	if err != nil {
		return err
	}
	h.Items = items

	_, ln, vn := utils.FindKeyNodeFull(DefaultLabel, root.Content)
	if vn != nil {
		h.Default = low.NodeReference[*yaml.Node]{
			Value:     vn,
			KeyNode:   ln,
			ValueNode: vn,
		}
		return nil
	}

	return nil
}

// Hash will return a consistent SHA256 Hash of the Header object
func (h *Header) Hash() [32]byte {
	var f []string
	if h.Description.Value != "" {
		f = append(f, h.Description.Value)
	}
	if h.Type.Value != "" {
		f = append(f, h.Type.Value)
	}
	if h.Format.Value != "" {
		f = append(f, h.Format.Value)
	}
	if h.CollectionFormat.Value != "" {
		f = append(f, h.CollectionFormat.Value)
	}
	if h.Default.Value != nil && !h.Default.Value.IsZero() {
		f = append(f, low.GenerateHashString(h.Default.Value))
	}
	f = append(f, fmt.Sprint(h.Maximum.Value))
	f = append(f, fmt.Sprint(h.Minimum.Value))
	f = append(f, fmt.Sprint(h.ExclusiveMinimum.Value))
	f = append(f, fmt.Sprint(h.ExclusiveMaximum.Value))
	f = append(f, fmt.Sprint(h.MinLength.Value))
	f = append(f, fmt.Sprint(h.MaxLength.Value))
	f = append(f, fmt.Sprint(h.MinItems.Value))
	f = append(f, fmt.Sprint(h.MaxItems.Value))
	f = append(f, fmt.Sprint(h.MultipleOf.Value))
	f = append(f, fmt.Sprint(h.UniqueItems.Value))
	if h.Pattern.Value != "" {
		f = append(f, fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprint(h.Pattern.Value)))))
	}
	f = append(f, low.HashExtensions(h.Extensions)...)

	keys := make([]string, len(h.Enum.Value))
	z := 0
	for k := range h.Enum.Value {
		keys[z] = low.ValueToString(h.Enum.Value[k].Value)
		z++
	}
	sort.Strings(keys)
	f = append(f, keys...)

	if h.Items.Value != nil {
		f = append(f, low.GenerateHashString(h.Items.Value))
	}
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// Getter methods to satisfy SwaggerHeader interface.

func (h *Header) GetType() *low.NodeReference[string] {
	return &h.Type
}

func (h *Header) GetDescription() *low.NodeReference[string] {
	return &h.Description
}

func (h *Header) GetFormat() *low.NodeReference[string] {
	return &h.Format
}

func (h *Header) GetItems() *low.NodeReference[any] {
	i := low.NodeReference[any]{
		KeyNode:   h.Items.KeyNode,
		ValueNode: h.Items.ValueNode,
		Value:     h.Items.Value,
	}
	return &i
}

func (h *Header) GetCollectionFormat() *low.NodeReference[string] {
	return &h.CollectionFormat
}

func (h *Header) GetDefault() *low.NodeReference[*yaml.Node] {
	return &h.Default
}

func (h *Header) GetMaximum() *low.NodeReference[int] {
	return &h.Maximum
}

func (h *Header) GetExclusiveMaximum() *low.NodeReference[bool] {
	return &h.ExclusiveMaximum
}

func (h *Header) GetMinimum() *low.NodeReference[int] {
	return &h.Minimum
}

func (h *Header) GetExclusiveMinimum() *low.NodeReference[bool] {
	return &h.ExclusiveMinimum
}

func (h *Header) GetMaxLength() *low.NodeReference[int] {
	return &h.MaxLength
}

func (h *Header) GetMinLength() *low.NodeReference[int] {
	return &h.MinLength
}

func (h *Header) GetPattern() *low.NodeReference[string] {
	return &h.Pattern
}

func (h *Header) GetMaxItems() *low.NodeReference[int] {
	return &h.MaxItems
}

func (h *Header) GetMinItems() *low.NodeReference[int] {
	return &h.MinItems
}

func (h *Header) GetUniqueItems() *low.NodeReference[bool] {
	return &h.UniqueItems
}

func (h *Header) GetEnum() *low.NodeReference[[]low.ValueReference[*yaml.Node]] {
	return &h.Enum
}

func (h *Header) GetMultipleOf() *low.NodeReference[int] {
	return &h.MultipleOf
}
