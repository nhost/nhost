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
	"github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// Parameter represents a low-level Swagger / OpenAPI 2 Parameter object.
//
// A unique parameter is defined by a combination of a name and location.
//
// There are five possible parameter types.
//
// Path
//
//	Used together with Path Templating, where the parameter value is actually part of the operation's URL.
//	This does not include the host or base path of the API. For example, in /items/{itemId}, the path parameter is itemId.
//
// Query
//
//	Parameters that are appended to the URL. For example, in /items?id=###, the query parameter is id.
//
// Header
//
//	Custom headers that are expected as part of the request.
//
// Body
//
//	The payload that's appended to the HTTP request. Since there can only be one payload, there can only be one body parameter.
//	The name of the body parameter has no effect on the parameter itself and is used for documentation purposes only.
//	Since Form parameters are also in the payload, body and form parameters cannot exist together for the same operation.
//
// Form
//
//	Used to describe the payload of an HTTP request when either application/x-www-form-urlencoded, multipart/form-data
//	or both are used as the content type of the request (in Swagger's definition, the consumes property of an operation).
//	This is the only parameter type that can be used to send files, thus supporting the file type. Since form parameters
//	are sent in the payload, they cannot be declared together with a body parameter for the same operation. Form
//	parameters have a different format based on the content-type used (for further details,
//	consult http://www.w3.org/TR/html401/interact/forms.html#h-17.13.4):
//	  application/x-www-form-urlencoded - Similar to the format of Query parameters but as a payload. For example,
//	  foo=1&bar=swagger - both foo and bar are form parameters. This is normally used for simple parameters that are
//	                      being transferred.
//	  multipart/form-data - each parameter takes a section in the payload with an internal header. For example, for
//	                        the header Content-Disposition: form-data; name="submit-name" the name of the parameter is
//	                        submit-name. This type of form parameters is more commonly used for file transfers
//
// https://swagger.io/specification/v2/#parameterObject
type Parameter struct {
	Name             low.NodeReference[string]
	In               low.NodeReference[string]
	Type             low.NodeReference[string]
	Format           low.NodeReference[string]
	Description      low.NodeReference[string]
	Required         low.NodeReference[bool]
	AllowEmptyValue  low.NodeReference[bool]
	Schema           low.NodeReference[*base.SchemaProxy]
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

// FindExtension attempts to locate a extension value given a name.
func (p *Parameter) FindExtension(ext string) *low.ValueReference[*yaml.Node] {
	return low.FindItemInOrderedMap(ext, p.Extensions)
}

// GetExtensions returns all Parameter extensions and satisfies the low.HasExtensions interface.
func (p *Parameter) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return p.Extensions
}

// Build will extract out extensions, schema, items and default value
func (p *Parameter) Build(ctx context.Context, _, root *yaml.Node, idx *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	p.Extensions = low.ExtractExtensions(root)
	sch, sErr := base.ExtractSchema(ctx, root, idx)
	if sErr != nil {
		return sErr
	}
	if sch != nil {
		p.Schema = *sch
	}
	items, iErr := low.ExtractObject[*Items](ctx, ItemsLabel, root, idx)
	if iErr != nil {
		return iErr
	}
	p.Items = items

	_, ln, vn := utils.FindKeyNodeFull(DefaultLabel, root.Content)
	if vn != nil {
		p.Default = low.NodeReference[*yaml.Node]{
			Value:     vn,
			KeyNode:   ln,
			ValueNode: vn,
		}
		return nil
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the Parameter object
func (p *Parameter) Hash() [32]byte {
	var f []string
	if p.Name.Value != "" {
		f = append(f, p.Name.Value)
	}
	if p.In.Value != "" {
		f = append(f, p.In.Value)
	}
	if p.Type.Value != "" {
		f = append(f, p.Type.Value)
	}
	if p.Format.Value != "" {
		f = append(f, p.Format.Value)
	}
	if p.Description.Value != "" {
		f = append(f, p.Description.Value)
	}
	f = append(f, fmt.Sprint(p.Required.Value))
	f = append(f, fmt.Sprint(p.AllowEmptyValue.Value))
	if p.Schema.Value != nil {
		f = append(f, low.GenerateHashString(p.Schema.Value.Schema()))
	}
	if p.CollectionFormat.Value != "" {
		f = append(f, p.CollectionFormat.Value)
	}
	if p.Default.Value != nil && !p.Default.Value.IsZero() {
		f = append(f, low.GenerateHashString(p.Default.Value))
	}
	f = append(f, fmt.Sprint(p.Maximum.Value))
	f = append(f, fmt.Sprint(p.Minimum.Value))
	f = append(f, fmt.Sprint(p.ExclusiveMinimum.Value))
	f = append(f, fmt.Sprint(p.ExclusiveMaximum.Value))
	f = append(f, fmt.Sprint(p.MinLength.Value))
	f = append(f, fmt.Sprint(p.MaxLength.Value))
	f = append(f, fmt.Sprint(p.MinItems.Value))
	f = append(f, fmt.Sprint(p.MaxItems.Value))
	f = append(f, fmt.Sprint(p.MultipleOf.Value))
	f = append(f, fmt.Sprint(p.UniqueItems.Value))
	if p.Pattern.Value != "" {
		f = append(f, fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprint(p.Pattern.Value)))))
	}

	keys := make([]string, len(p.Enum.Value))
	z := 0
	for k := range p.Enum.Value {
		keys[z] = low.ValueToString(p.Enum.Value[k].Value)
		z++
	}
	sort.Strings(keys)
	f = append(f, keys...)

	f = append(f, low.HashExtensions(p.Extensions)...)
	if p.Items.Value != nil {
		f = append(f, fmt.Sprintf("%x", p.Items.Value.Hash()))
	}
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}

// Getters used by what-changed feature to satisfy the SwaggerParameter interface.

func (p *Parameter) GetName() *low.NodeReference[string] {
	return &p.Name
}

func (p *Parameter) GetIn() *low.NodeReference[string] {
	return &p.In
}

func (p *Parameter) GetType() *low.NodeReference[string] {
	return &p.Type
}

func (p *Parameter) GetDescription() *low.NodeReference[string] {
	return &p.Description
}

func (p *Parameter) GetRequired() *low.NodeReference[bool] {
	return &p.Required
}

func (p *Parameter) GetAllowEmptyValue() *low.NodeReference[bool] {
	return &p.AllowEmptyValue
}

func (p *Parameter) GetSchema() *low.NodeReference[any] {
	i := low.NodeReference[any]{
		KeyNode:   p.Schema.KeyNode,
		ValueNode: p.Schema.ValueNode,
		Value:     p.Schema.Value,
	}
	return &i
}

func (p *Parameter) GetFormat() *low.NodeReference[string] {
	return &p.Format
}

func (p *Parameter) GetItems() *low.NodeReference[any] {
	i := low.NodeReference[any]{
		KeyNode:   p.Items.KeyNode,
		ValueNode: p.Items.ValueNode,
		Value:     p.Items.Value,
	}
	return &i
}

func (p *Parameter) GetCollectionFormat() *low.NodeReference[string] {
	return &p.CollectionFormat
}

func (p *Parameter) GetDefault() *low.NodeReference[*yaml.Node] {
	return &p.Default
}

func (p *Parameter) GetMaximum() *low.NodeReference[int] {
	return &p.Maximum
}

func (p *Parameter) GetExclusiveMaximum() *low.NodeReference[bool] {
	return &p.ExclusiveMaximum
}

func (p *Parameter) GetMinimum() *low.NodeReference[int] {
	return &p.Minimum
}

func (p *Parameter) GetExclusiveMinimum() *low.NodeReference[bool] {
	return &p.ExclusiveMinimum
}

func (p *Parameter) GetMaxLength() *low.NodeReference[int] {
	return &p.MaxLength
}

func (p *Parameter) GetMinLength() *low.NodeReference[int] {
	return &p.MinLength
}

func (p *Parameter) GetPattern() *low.NodeReference[string] {
	return &p.Pattern
}

func (p *Parameter) GetMaxItems() *low.NodeReference[int] {
	return &p.MaxItems
}

func (p *Parameter) GetMinItems() *low.NodeReference[int] {
	return &p.MinItems
}

func (p *Parameter) GetUniqueItems() *low.NodeReference[bool] {
	return &p.UniqueItems
}

func (p *Parameter) GetEnum() *low.NodeReference[[]low.ValueReference[*yaml.Node]] {
	return &p.Enum
}

func (p *Parameter) GetMultipleOf() *low.NodeReference[int] {
	return &p.MultipleOf
}
