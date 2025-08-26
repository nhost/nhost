// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"reflect"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	v2 "github.com/pb33f/libopenapi/datamodel/low/v2"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// ParameterChanges represents changes found between Swagger or OpenAPI Parameter objects.
type ParameterChanges struct {
	*PropertyChanges
	SchemaChanges    *SchemaChanges    `json:"schemas,omitempty" yaml:"schemas,omitempty"`
	ExtensionChanges *ExtensionChanges `json:"extensions,omitempty" yaml:"extensions,omitempty"`

	// Swagger supports Items.
	ItemsChanges *ItemsChanges `json:"items,omitempty" yaml:"items,omitempty"`

	// OpenAPI supports examples and content types.
	ExamplesChanges map[string]*ExampleChanges   `json:"examples,omitempty" yaml:"examples,omitempty"`
	ContentChanges  map[string]*MediaTypeChanges `json:"content,omitempty" yaml:"content,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Parameter objects
func (p *ParameterChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, p.Changes...)
	if p.SchemaChanges != nil {
		changes = append(changes, p.SchemaChanges.GetAllChanges()...)
	}
	for i := range p.ExamplesChanges {
		changes = append(changes, p.ExamplesChanges[i].GetAllChanges()...)
	}
	if p.ItemsChanges != nil {
		changes = append(changes, p.ItemsChanges.GetAllChanges()...)
	}
	if p.ExtensionChanges != nil {
		changes = append(changes, p.ExtensionChanges.GetAllChanges()...)
	}
	for i := range p.ContentChanges {
		changes = append(changes, p.ContentChanges[i].GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns a count of everything that changed
func (p *ParameterChanges) TotalChanges() int {
	c := p.PropertyChanges.TotalChanges()
	if p.SchemaChanges != nil {
		c += p.SchemaChanges.TotalChanges()
	}
	for i := range p.ExamplesChanges {
		c += p.ExamplesChanges[i].TotalChanges()
	}
	if p.ItemsChanges != nil {
		c += p.ItemsChanges.TotalChanges()
	}
	if p.ExtensionChanges != nil {
		c += p.ExtensionChanges.TotalChanges()
	}
	for i := range p.ContentChanges {
		c += p.ContentChanges[i].TotalChanges()
	}
	return c
}

// TotalBreakingChanges always returns 0 for ExternalDoc objects, they are non-binding.
func (p *ParameterChanges) TotalBreakingChanges() int {
	c := p.PropertyChanges.TotalBreakingChanges()
	if p.SchemaChanges != nil {
		c += p.SchemaChanges.TotalBreakingChanges()
	}
	if p.ItemsChanges != nil {
		c += p.ItemsChanges.TotalBreakingChanges()
	}
	for i := range p.ContentChanges {
		c += p.ContentChanges[i].TotalBreakingChanges()
	}
	return c
}

func addPropertyCheck(props *[]*PropertyCheck,
	lvn, rvn *yaml.Node, lv, rv any, changes *[]*Change, label string, breaking bool) {
	*props = append(*props, &PropertyCheck{
		LeftNode:  lvn,
		RightNode: rvn,
		Label:     label,
		Changes:   changes,
		Breaking:  breaking,
		Original:  lv,
		New:       rv,
	})
}

func addOpenAPIParameterProperties(left, right low.OpenAPIParameter, changes *[]*Change) []*PropertyCheck {
	var props []*PropertyCheck

	// style
	addPropertyCheck(&props, left.GetStyle().ValueNode, right.GetStyle().ValueNode,
		left.GetStyle(), right.GetStyle(), changes, v3.StyleLabel, false)

	// allow reserved
	addPropertyCheck(&props, left.GetAllowReserved().ValueNode, right.GetAllowReserved().ValueNode,
		left.GetAllowReserved(), right.GetAllowReserved(), changes, v3.AllowReservedLabel, true)

	// explode
	addPropertyCheck(&props, left.GetExplode().ValueNode, right.GetExplode().ValueNode,
		left.GetExplode(), right.GetExplode(), changes, v3.ExplodeLabel, false)

	// deprecated
	addPropertyCheck(&props, left.GetDeprecated().ValueNode, right.GetDeprecated().ValueNode,
		left.GetDeprecated(), right.GetDeprecated(), changes, v3.DeprecatedLabel, false)

	// example
	addPropertyCheck(&props, left.GetExample().ValueNode, right.GetExample().ValueNode,
		left.GetExample(), right.GetExample(), changes, v3.ExampleLabel, false)

	return props
}

func addSwaggerParameterProperties(left, right low.SwaggerParameter, changes *[]*Change) []*PropertyCheck {
	var props []*PropertyCheck

	// type
	addPropertyCheck(&props, left.GetType().ValueNode, right.GetType().ValueNode,
		left.GetType(), right.GetType(), changes, v3.TypeLabel, true)

	// format
	addPropertyCheck(&props, left.GetFormat().ValueNode, right.GetFormat().ValueNode,
		left.GetFormat(), right.GetFormat(), changes, v3.FormatLabel, true)

	// collection format
	addPropertyCheck(&props, left.GetCollectionFormat().ValueNode, right.GetCollectionFormat().ValueNode,
		left.GetCollectionFormat(), right.GetCollectionFormat(), changes, v3.CollectionFormatLabel, true)

	// maximum
	addPropertyCheck(&props, left.GetMaximum().ValueNode, right.GetMaximum().ValueNode,
		left.GetMaximum(), right.GetMaximum(), changes, v3.MaximumLabel, true)

	// minimum
	addPropertyCheck(&props, left.GetMinimum().ValueNode, right.GetMinimum().ValueNode,
		left.GetMinimum(), right.GetMinimum(), changes, v3.MinimumLabel, true)

	// exclusive maximum
	addPropertyCheck(&props, left.GetExclusiveMaximum().ValueNode, right.GetExclusiveMaximum().ValueNode,
		left.GetExclusiveMaximum(), right.GetExclusiveMaximum(), changes, v3.ExclusiveMaximumLabel, true)

	// exclusive minimum
	addPropertyCheck(&props, left.GetExclusiveMinimum().ValueNode, right.GetExclusiveMinimum().ValueNode,
		left.GetExclusiveMinimum(), right.GetExclusiveMinimum(), changes, v3.ExclusiveMinimumLabel, true)

	// max length
	addPropertyCheck(&props, left.GetMaxLength().ValueNode, right.GetMaxLength().ValueNode,
		left.GetMaxLength(), right.GetMaxLength(), changes, v3.MaxLengthLabel, true)

	// min length
	addPropertyCheck(&props, left.GetMinLength().ValueNode, right.GetMinLength().ValueNode,
		left.GetMinLength(), right.GetMinLength(), changes, v3.MinLengthLabel, true)

	// pattern
	addPropertyCheck(&props, left.GetPattern().ValueNode, right.GetPattern().ValueNode,
		left.GetPattern(), right.GetPattern(), changes, v3.PatternLabel, true)

	// max items
	addPropertyCheck(&props, left.GetMaxItems().ValueNode, right.GetMaxItems().ValueNode,
		left.GetMaxItems(), right.GetMaxItems(), changes, v3.MaxItemsLabel, true)

	// min items
	addPropertyCheck(&props, left.GetMinItems().ValueNode, right.GetMinItems().ValueNode,
		left.GetMinItems(), right.GetMinItems(), changes, v3.MinItemsLabel, true)

	// unique items
	addPropertyCheck(&props, left.GetUniqueItems().ValueNode, right.GetUniqueItems().ValueNode,
		left.GetUniqueItems(), right.GetUniqueItems(), changes, v3.UniqueItemsLabel, true)

	// default
	addPropertyCheck(&props, left.GetDefault().ValueNode, right.GetDefault().ValueNode,
		left.GetDefault(), right.GetDefault(), changes, v3.DefaultLabel, true)

	// multiple of
	addPropertyCheck(&props, left.GetMultipleOf().ValueNode, right.GetMultipleOf().ValueNode,
		left.GetMultipleOf(), right.GetMultipleOf(), changes, v3.MultipleOfLabel, true)

	return props
}

func addCommonParameterProperties(left, right low.SharedParameters, changes *[]*Change) []*PropertyCheck {
	var props []*PropertyCheck

	addPropertyCheck(&props, left.GetName().ValueNode, right.GetName().ValueNode,
		left.GetName(), right.GetName(), changes, v3.NameLabel, true)

	// in
	addPropertyCheck(&props, left.GetIn().ValueNode, right.GetIn().ValueNode,
		left.GetIn(), right.GetIn(), changes, v3.InLabel, true)

	// description
	addPropertyCheck(&props, left.GetDescription().ValueNode, right.GetDescription().ValueNode,
		left.GetDescription(), right.GetDescription(), changes, v3.DescriptionLabel, false)

	// required
	addPropertyCheck(&props, left.GetRequired().ValueNode, right.GetRequired().ValueNode,
		left.GetRequired(), right.GetRequired(), changes, v3.RequiredLabel, true)

	// allow empty value
	addPropertyCheck(&props, left.GetAllowEmptyValue().ValueNode, right.GetAllowEmptyValue().ValueNode,
		left.GetAllowEmptyValue(), right.GetAllowEmptyValue(), changes, v3.AllowEmptyValueLabel, true)

	return props
}

// CompareParametersV3 is an OpenAPI type safe proxy for CompareParameters
func CompareParametersV3(l, r *v3.Parameter) *ParameterChanges {
	return CompareParameters(l, r)
}

// CompareParameters compares a left and right Swagger or OpenAPI Parameter object for any changes. If found returns
// a pointer to ParameterChanges. If nothing is found, returns nil.
func CompareParameters(l, r any) *ParameterChanges {
	var changes []*Change
	var props []*PropertyCheck

	pc := new(ParameterChanges)
	var lSchema *base.SchemaProxy
	var rSchema *base.SchemaProxy
	var lext, rext *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]

	if reflect.TypeOf(&v2.Parameter{}) == reflect.TypeOf(l) && reflect.TypeOf(&v2.Parameter{}) == reflect.TypeOf(r) {
		lParam := l.(*v2.Parameter)
		rParam := r.(*v2.Parameter)

		// perform hash check to avoid further processing
		if low.AreEqual(lParam, rParam) {
			return nil
		}

		props = append(props, addSwaggerParameterProperties(lParam, rParam, &changes)...)
		props = append(props, addCommonParameterProperties(lParam, rParam, &changes)...)

		// extract schema
		if lParam != nil {
			lSchema = lParam.Schema.Value
			lext = lParam.Extensions
		}
		if rParam != nil {
			rext = rParam.Extensions
			rSchema = rParam.Schema.Value
		}

		// items
		if !lParam.Items.IsEmpty() && !rParam.Items.IsEmpty() {
			if lParam.Items.Value.Hash() != rParam.Items.Value.Hash() {
				pc.ItemsChanges = CompareItems(lParam.Items.Value, rParam.Items.Value)
			}
		}
		if lParam.Items.IsEmpty() && !rParam.Items.IsEmpty() {
			CreateChange(&changes, ObjectAdded, v3.ItemsLabel,
				nil, rParam.Items.ValueNode, true, nil,
				rParam.Items.Value)
		}
		if !lParam.Items.IsEmpty() && rParam.Items.IsEmpty() {
			CreateChange(&changes, ObjectRemoved, v3.ItemsLabel,
				lParam.Items.ValueNode, nil, true, lParam.Items.Value,
				nil)
		}

		// enum
		if len(lParam.Enum.Value) > 0 || len(rParam.Enum.Value) > 0 {
			ExtractRawValueSliceChanges(lParam.Enum.Value, rParam.Enum.Value, &changes, v3.EnumLabel, true)
		}
	}

	// OpenAPI
	if reflect.TypeOf(&v3.Parameter{}) == reflect.TypeOf(l) && reflect.TypeOf(&v3.Parameter{}) == reflect.TypeOf(r) {

		lParam := l.(*v3.Parameter)
		rParam := r.(*v3.Parameter)

		// perform hash check to avoid further processing
		if low.AreEqual(lParam, rParam) {
			return nil
		}

		props = append(props, addOpenAPIParameterProperties(lParam, rParam, &changes)...)
		props = append(props, addCommonParameterProperties(lParam, rParam, &changes)...)
		if lParam != nil {
			lext = lParam.Extensions
			lSchema = lParam.Schema.Value
		}
		if rParam != nil {
			rext = rParam.Extensions
			rSchema = rParam.Schema.Value
		}

		// example
		checkParameterExample(lParam.Example, rParam.Example, changes)

		// examples
		pc.ExamplesChanges = CheckMapForChanges(lParam.Examples.Value, rParam.Examples.Value,
			&changes, v3.ExamplesLabel, CompareExamples)

		// content
		pc.ContentChanges = CheckMapForChanges(lParam.Content.Value, rParam.Content.Value,
			&changes, v3.ContentLabel, CompareMediaTypes)
	}
	CheckProperties(props)

	if lSchema != nil && rSchema != nil {
		pc.SchemaChanges = CompareSchemas(lSchema, rSchema)
	}
	if lSchema != nil && rSchema == nil {
		CreateChange(&changes, ObjectRemoved, v3.SchemaLabel,
			lSchema.GetValueNode(), nil, true, lSchema,
			nil)
	}

	if lSchema == nil && rSchema != nil {
		CreateChange(&changes, ObjectAdded, v3.SchemaLabel,
			nil, rSchema.GetValueNode(), true, nil,
			rSchema)
	}

	pc.PropertyChanges = NewPropertyChanges(changes)
	pc.ExtensionChanges = CompareExtensions(lext, rext)
	return pc
}

func checkParameterExample(expLeft, expRight low.NodeReference[*yaml.Node], changes []*Change) {
	if !expLeft.IsEmpty() && !expRight.IsEmpty() {
		if low.GenerateHashString(expLeft.GetValue()) != low.GenerateHashString(expRight.GetValue()) {
			CreateChange(&changes, Modified, v3.ExampleLabel,
				expLeft.GetValueNode(), expRight.GetValueNode(), false,
				expLeft.GetValue(), expRight.GetValue())
		}
	}
	if expLeft.Value == nil && expRight.Value != nil {
		CreateChange(&changes, PropertyAdded, v3.ExampleLabel,
			nil, expRight.GetValueNode(), false,
			nil, expRight.GetValue())

	}
	if expLeft.Value != nil && expRight.Value == nil {
		CreateChange(&changes, PropertyRemoved, v3.ExampleLabel,
			expLeft.GetValueNode(), nil, false,
			expLeft.GetValue(), nil)

	}
}
