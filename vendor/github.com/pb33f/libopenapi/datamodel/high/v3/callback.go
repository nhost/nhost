// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"sort"

	"github.com/pb33f/libopenapi/datamodel/high"
	"github.com/pb33f/libopenapi/datamodel/low"
	lowv3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// Callback represents a high-level Callback object for OpenAPI 3+.
//
// A map of possible out-of band callbacks related to the parent operation. Each value in the map is a
// PathItem Object that describes a set of requests that may be initiated by the API provider and the expected
// responses. The key value used to identify the path item object is an expression, evaluated at runtime,
// that identifies a URL to use for the callback operation.
//   - https://spec.openapis.org/oas/v3.1.0#callback-object
type Callback struct {
	Expression *orderedmap.Map[string, *PathItem]  `json:"-" yaml:"-"`
	Extensions *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low        *lowv3.Callback
}

// NewCallback creates a new high-level callback from a low-level one.
func NewCallback(lowCallback *lowv3.Callback) *Callback {
	n := new(Callback)
	n.low = lowCallback
	n.Expression = low.FromReferenceMapWithFunc(lowCallback.Expression, NewPathItem)
	n.Extensions = high.ExtractExtensions(lowCallback.Extensions)
	return n
}

// GoLow returns the low-level Callback instance used to create the high-level one.
func (c *Callback) GoLow() *lowv3.Callback {
	return c.low
}

// GoLowUntyped will return the low-level Callback instance that was used to create the high-level one, with no type
func (c *Callback) GoLowUntyped() any {
	return c.low
}

// Render will return a YAML representation of the Callback object as a byte slice.
func (c *Callback) Render() ([]byte, error) {
	return yaml.Marshal(c)
}

// RenderInline will return an YAML representation of the Callback object as a byte slice with references resolved.
func (c *Callback) RenderInline() ([]byte, error) {
	d, _ := c.MarshalYAMLInline()
	return yaml.Marshal(d)
}

// MarshalYAML will create a ready to render YAML representation of the Paths object.
func (c *Callback) MarshalYAML() (interface{}, error) {
	// map keys correctly.
	m := utils.CreateEmptyMapNode()
	type pathItem struct {
		pi       *PathItem
		path     string
		line     int
		style    yaml.Style
		rendered *yaml.Node
	}
	var mapped []*pathItem

	for k, pi := range c.Expression.FromOldest() {
		ln := 9999 // default to a high value to weight new content to the bottom.
		var style yaml.Style
		if c.low != nil {
			lpi := c.low.FindExpression(k)
			if lpi != nil {
				ln = lpi.ValueNode.Line
			}

			for lk := range c.low.Expression.KeysFromOldest() {
				if lk.Value == k {
					style = lk.KeyNode.Style
					break
				}
			}
		}
		mapped = append(mapped, &pathItem{pi, k, ln, style, nil})
	}

	nb := high.NewNodeBuilder(c, c.low)
	extNode := nb.Render()
	if extNode != nil && extNode.Content != nil {
		var label string
		for u := range extNode.Content {
			if u%2 == 0 {
				label = extNode.Content[u].Value
				continue
			}
			mapped = append(mapped, &pathItem{
				nil, label,
				extNode.Content[u].Line, 0, extNode.Content[u],
			})
		}
	}

	sort.Slice(mapped, func(i, j int) bool {
		return mapped[i].line < mapped[j].line
	})
	for _, mp := range mapped {
		if mp.pi != nil {
			rendered, _ := mp.pi.MarshalYAML()

			kn := utils.CreateStringNode(mp.path)
			kn.Style = mp.style

			m.Content = append(m.Content, kn)
			m.Content = append(m.Content, rendered.(*yaml.Node))
		}
		if mp.rendered != nil {
			m.Content = append(m.Content, utils.CreateStringNode(mp.path))
			m.Content = append(m.Content, mp.rendered)
		}
	}

	return m, nil
}

func (c *Callback) MarshalYAMLInline() (interface{}, error) {
	// map keys correctly.
	m := utils.CreateEmptyMapNode()
	type pathItem struct {
		pi       *PathItem
		path     string
		line     int
		style    yaml.Style
		rendered *yaml.Node
	}
	var mapped []*pathItem

	for k, pi := range c.Expression.FromOldest() {
		ln := 9999 // default to a high value to weight new content to the bottom.
		var style yaml.Style
		if c.low != nil {
			lpi := c.low.FindExpression(k)
			if lpi != nil {
				ln = lpi.ValueNode.Line
			}

			for lk := range c.low.Expression.KeysFromOldest() {
				if lk.Value == k {
					style = lk.KeyNode.Style
					break
				}
			}
		}
		mapped = append(mapped, &pathItem{pi, k, ln, style, nil})
	}

	nb := high.NewNodeBuilder(c, c.low)
	nb.Resolve = true
	extNode := nb.Render()
	if extNode != nil && extNode.Content != nil {
		var label string
		for u := range extNode.Content {
			if u%2 == 0 {
				label = extNode.Content[u].Value
				continue
			}
			mapped = append(mapped, &pathItem{
				nil, label,
				extNode.Content[u].Line, 0, extNode.Content[u],
			})
		}
	}

	sort.Slice(mapped, func(i, j int) bool {
		return mapped[i].line < mapped[j].line
	})
	for _, mp := range mapped {
		if mp.pi != nil {
			rendered, _ := mp.pi.MarshalYAMLInline()

			kn := utils.CreateStringNode(mp.path)
			kn.Style = mp.style

			m.Content = append(m.Content, kn)
			m.Content = append(m.Content, rendered.(*yaml.Node))
		}
		if mp.rendered != nil {
			m.Content = append(m.Content, utils.CreateStringNode(mp.path))
			m.Content = append(m.Content, mp.rendered)
		}
	}

	return m, nil
}
