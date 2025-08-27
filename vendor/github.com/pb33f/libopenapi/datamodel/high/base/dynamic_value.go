// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"github.com/pb33f/libopenapi/datamodel/high"
	"gopkg.in/yaml.v3"
	"reflect"
)

// DynamicValue is used to hold multiple possible values for a schema property. There are two values, a left
// value (A) and a right value (B). The left value (A) is a 3.0 schema property value, the right value (B) is a 3.1
// schema value.
//
// OpenAPI 3.1 treats a Schema as a real JSON schema, which means some properties become incompatible, or others
// now support more than one primitive type or structure.
// The N value is a bit to make it each to know which value (A or B) is used, this prevents having to
// if/else on the value to determine which one is set.
type DynamicValue[A any, B any] struct {
	N      int // 0 == A, 1 == B
	A      A
	B      B
	inline bool
}

// IsA will return true if the 'A' or left value is set. (OpenAPI 3)
func (d *DynamicValue[A, B]) IsA() bool {
	return d.N == 0
}

// IsB will return true if the 'B' or right value is set (OpenAPI 3.1)
func (d *DynamicValue[A, B]) IsB() bool {
	return d.N == 1
}

func (d *DynamicValue[A, B]) Render() ([]byte, error) {
	d.inline = false
	return yaml.Marshal(d)
}

func (d *DynamicValue[A, B]) RenderInline() ([]byte, error) {
	d.inline = true
	return yaml.Marshal(d)
}

// MarshalYAML will create a ready to render YAML representation of the DynamicValue object.
func (d *DynamicValue[A, B]) MarshalYAML() (interface{}, error) {
	// this is a custom renderer, we can't use the NodeBuilder out of the gate.
	var n yaml.Node
	var err error
	var value any

	if d.IsA() {
		value = d.A
	}
	if d.IsB() {
		value = d.B
	}
	to := reflect.TypeOf(value)
	switch to.Kind() {
	case reflect.Ptr:
		if d.inline {
			if r, ok := value.(high.RenderableInline); ok {
				return r.MarshalYAMLInline()
			} else {
				_ = n.Encode(value)
			}
		} else {
			if r, ok := value.(high.Renderable); ok {
				return r.MarshalYAML()
			} else {
				_ = n.Encode(value)
			}
		}
	case reflect.Bool:
		_ = n.Encode(value.(bool))
	case reflect.Int:
		_ = n.Encode(value.(int))
	case reflect.String:
		_ = n.Encode(value.(string))
	case reflect.Int64:
		_ = n.Encode(value.(int64))
	case reflect.Float64:
		_ = n.Encode(value.(float64))
	case reflect.Float32:
		_ = n.Encode(value.(float32))
	case reflect.Int32:
		_ = n.Encode(value.(int32))

	}
	return &n, err
}

// MarshalYAMLInline will create a ready to render YAML representation of the DynamicValue object. The
// references will be inlined instead of kept as references.
func (d *DynamicValue[A, B]) MarshalYAMLInline() (interface{}, error) {
	d.inline = true
	return d.MarshalYAML()
}
