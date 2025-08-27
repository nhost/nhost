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

// Items is a low-level representation of a Swagger / OpenAPI 2 Items object.
//
// Items is a limited subset of JSON-Schema's items object. It is used by parameter definitions that are not
// located in "body". Items, is actually identical to a Header, except it does not have description.
//   - https://swagger.io/specification/v2/#itemsObject
type Items struct {
	Type             low.NodeReference[string]
	Format           low.NodeReference[string]
	CollectionFormat low.NodeReference[string]
	Items            low.NodeReference[*Items]
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
func (i *Items) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, i.Extensions)
}

// GetExtensions returns all Items extensions and satisfies the low.HasExtensions interface.
func (i *Items) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return i.Extensions
}

// Hash will return a consistent SHA256 Hash of the Items object
func (i *Items) Hash() [32]byte {
	var f []string
	if i.Type.Value != "" {
		f = append(f, i.Type.Value)
	}
	if i.Format.Value != "" {
		f = append(f, i.Format.Value)
	}
	if i.CollectionFormat.Value != "" {
		f = append(f, i.CollectionFormat.Value)
	}
	if i.Default.Value != nil && !i.Default.Value.IsZero() {
		f = append(f, low.GenerateHashString(i.Default.Value))
	}
	f = append(f, fmt.Sprint(i.Maximum.Value))
	f = append(f, fmt.Sprint(i.Minimum.Value))
	f = append(f, fmt.Sprint(i.ExclusiveMinimum.Value))
	f = append(f, fmt.Sprint(i.ExclusiveMaximum.Value))
	f = append(f, fmt.Sprint(i.MinLength.Value))
	f = append(f, fmt.Sprint(i.MaxLength.Value))
	f = append(f, fmt.Sprint(i.MinItems.Value))
	f = append(f, fmt.Sprint(i.MaxItems.Value))
	f = append(f, fmt.Sprint(i.MultipleOf.Value))
	f = append(f, fmt.Sprint(i.UniqueItems.Value))
	if i.Pattern.Value != "" {
		f = append(f, fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprint(i.Pattern.Value)))))
	}
	keys := make([]string, len(i.Enum.Value))
	z := 0
	for k := range i.Enum.Value {
		keys[z] = low.ValueToString(i.Enum.Value[k].Value)
		z++
	}
	sort.Strings(keys)
	f = append(f, keys...)

	if i.Items.Value != nil {
		f = append(f, low.GenerateHashString(i.Items.Value))
	}
	f = append(f, low.HashExtensions(i.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// Build will build out items and default value.
func (i *Items) Build(ctx context.Context, _, root *yaml.Node, idx *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	i.Extensions = low.ExtractExtensions(root)
	items, iErr := low.ExtractObject[*Items](ctx, ItemsLabel, root, idx)
	if iErr != nil {
		return iErr
	}
	i.Items = items

	_, ln, vn := utils.FindKeyNodeFull(DefaultLabel, root.Content)
	if vn != nil {
		i.Default = low.NodeReference[*yaml.Node]{
			Value:     vn,
			KeyNode:   ln,
			ValueNode: vn,
		}
		return nil
	}
	return nil
}

// IsHeader compliance methods

func (i *Items) GetType() *low.NodeReference[string] {
	return &i.Type
}

func (i *Items) GetFormat() *low.NodeReference[string] {
	return &i.Format
}

func (i *Items) GetItems() *low.NodeReference[any] {
	k := low.NodeReference[any]{
		KeyNode:   i.Items.KeyNode,
		ValueNode: i.Items.ValueNode,
		Value:     i.Items.Value,
	}
	return &k
}

func (i *Items) GetCollectionFormat() *low.NodeReference[string] {
	return &i.CollectionFormat
}

func (i *Items) GetDescription() *low.NodeReference[string] {
	return nil // not implemented, but required to align with header contract
}

func (i *Items) GetDefault() *low.NodeReference[*yaml.Node] {
	return &i.Default
}

func (i *Items) GetMaximum() *low.NodeReference[int] {
	return &i.Maximum
}

func (i *Items) GetExclusiveMaximum() *low.NodeReference[bool] {
	return &i.ExclusiveMaximum
}

func (i *Items) GetMinimum() *low.NodeReference[int] {
	return &i.Minimum
}

func (i *Items) GetExclusiveMinimum() *low.NodeReference[bool] {
	return &i.ExclusiveMinimum
}

func (i *Items) GetMaxLength() *low.NodeReference[int] {
	return &i.MaxLength
}

func (i *Items) GetMinLength() *low.NodeReference[int] {
	return &i.MinLength
}

func (i *Items) GetPattern() *low.NodeReference[string] {
	return &i.Pattern
}

func (i *Items) GetMaxItems() *low.NodeReference[int] {
	return &i.MaxItems
}

func (i *Items) GetMinItems() *low.NodeReference[int] {
	return &i.MinItems
}

func (i *Items) GetUniqueItems() *low.NodeReference[bool] {
	return &i.UniqueItems
}

func (i *Items) GetEnum() *low.NodeReference[[]low.ValueReference[*yaml.Node]] {
	return &i.Enum
}

func (i *Items) GetMultipleOf() *low.NodeReference[int] {
	return &i.MultipleOf
}
