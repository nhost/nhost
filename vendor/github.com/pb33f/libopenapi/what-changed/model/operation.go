// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"reflect"
	"sort"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	v2 "github.com/pb33f/libopenapi/datamodel/low/v2"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"gopkg.in/yaml.v3"
)

// OperationChanges represent changes made between two Swagger or OpenAPI Operation objects.
type OperationChanges struct {
	*PropertyChanges
	ExternalDocChanges         *ExternalDocChanges           `json:"externalDoc,omitempty" yaml:"externalDoc,omitempty"`
	ParameterChanges           []*ParameterChanges           `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	ResponsesChanges           *ResponsesChanges             `json:"responses,omitempty" yaml:"responses,omitempty"`
	SecurityRequirementChanges []*SecurityRequirementChanges `json:"securityRequirements,omitempty" yaml:"securityRequirements,omitempty"`

	// OpenAPI 3+ only changes
	RequestBodyChanges *RequestBodyChanges         `json:"requestBodies,omitempty" yaml:"requestBodies,omitempty"`
	ServerChanges      []*ServerChanges            `json:"servers,omitempty" yaml:"servers,omitempty"`
	ExtensionChanges   *ExtensionChanges           `json:"extensions,omitempty" yaml:"extensions,omitempty"`
	CallbackChanges    map[string]*CallbackChanges `json:"callbacks,omitempty" yaml:"callbacks,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Operation objects
func (o *OperationChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, o.Changes...)
	if o.ExternalDocChanges != nil {
		changes = append(changes, o.ExternalDocChanges.GetAllChanges()...)
	}
	for k := range o.ParameterChanges {
		changes = append(changes, o.ParameterChanges[k].GetAllChanges()...)
	}
	if o.ResponsesChanges != nil {
		changes = append(changes, o.ResponsesChanges.GetAllChanges()...)
	}
	for k := range o.SecurityRequirementChanges {
		changes = append(changes, o.SecurityRequirementChanges[k].GetAllChanges()...)
	}
	if o.RequestBodyChanges != nil {
		changes = append(changes, o.RequestBodyChanges.GetAllChanges()...)
	}
	for k := range o.ServerChanges {
		changes = append(changes, o.ServerChanges[k].GetAllChanges()...)
	}
	for k := range o.CallbackChanges {
		changes = append(changes, o.CallbackChanges[k].GetAllChanges()...)
	}
	if o.ExtensionChanges != nil {
		changes = append(changes, o.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns the total number of changes made between two Swagger or OpenAPI Operation objects.
func (o *OperationChanges) TotalChanges() int {
	c := o.PropertyChanges.TotalChanges()
	if o.ExternalDocChanges != nil {
		c += o.ExternalDocChanges.TotalChanges()
	}
	for k := range o.ParameterChanges {
		c += o.ParameterChanges[k].TotalChanges()
	}
	if o.ResponsesChanges != nil {
		c += o.ResponsesChanges.TotalChanges()
	}
	for k := range o.SecurityRequirementChanges {
		c += o.SecurityRequirementChanges[k].TotalChanges()
	}
	if o.RequestBodyChanges != nil {
		c += o.RequestBodyChanges.TotalChanges()
	}
	for k := range o.ServerChanges {
		c += o.ServerChanges[k].TotalChanges()
	}
	for k := range o.CallbackChanges {
		c += o.CallbackChanges[k].TotalChanges()
	}
	if o.ExtensionChanges != nil {
		c += o.ExtensionChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns the total number of breaking changes made between two Swagger
// or OpenAPI Operation objects.
func (o *OperationChanges) TotalBreakingChanges() int {
	c := o.PropertyChanges.TotalBreakingChanges()
	if o.ExternalDocChanges != nil {
		c += o.ExternalDocChanges.TotalBreakingChanges()
	}
	for k := range o.ParameterChanges {
		c += o.ParameterChanges[k].TotalBreakingChanges()
	}
	if o.ResponsesChanges != nil {
		c += o.ResponsesChanges.TotalBreakingChanges()
	}
	for k := range o.SecurityRequirementChanges {
		c += o.SecurityRequirementChanges[k].TotalBreakingChanges()
	}
	for k := range o.CallbackChanges {
		c += o.CallbackChanges[k].TotalBreakingChanges()
	}
	if o.RequestBodyChanges != nil {
		c += o.RequestBodyChanges.TotalBreakingChanges()
	}
	for k := range o.ServerChanges {
		c += o.ServerChanges[k].TotalBreakingChanges()
	}
	return c
}

// check for properties shared between operations objects.
func addSharedOperationProperties(left, right low.SharedOperations, changes *[]*Change) []*PropertyCheck {
	var props []*PropertyCheck

	// tags
	if len(left.GetTags().Value) > 0 || len(right.GetTags().Value) > 0 {
		ExtractStringValueSliceChanges(left.GetTags().Value, right.GetTags().Value,
			changes, v3.TagsLabel, true)
	}

	// summary
	addPropertyCheck(&props, left.GetSummary().ValueNode, right.GetSummary().ValueNode,
		left.GetSummary(), right.GetSummary(), changes, v3.SummaryLabel, false)

	// description
	addPropertyCheck(&props, left.GetDescription().ValueNode, right.GetDescription().ValueNode,
		left.GetDescription(), right.GetDescription(), changes, v3.DescriptionLabel, false)

	// deprecated
	addPropertyCheck(&props, left.GetDeprecated().ValueNode, right.GetDeprecated().ValueNode,
		left.GetDeprecated(), right.GetDeprecated(), changes, v3.DeprecatedLabel, false)

	// operation id
	addPropertyCheck(&props, left.GetOperationId().ValueNode, right.GetOperationId().ValueNode,
		left.GetOperationId(), right.GetOperationId(), changes, v3.OperationIdLabel, true)

	return props
}

// check shared objects
func compareSharedOperationObjects(l, r low.SharedOperations, changes *[]*Change, opChanges *OperationChanges) {

	// external docs
	if !l.GetExternalDocs().IsEmpty() && !r.GetExternalDocs().IsEmpty() {
		lExtDoc := l.GetExternalDocs().Value.(*base.ExternalDoc)
		rExtDoc := r.GetExternalDocs().Value.(*base.ExternalDoc)
		if !low.AreEqual(lExtDoc, rExtDoc) {
			opChanges.ExternalDocChanges = CompareExternalDocs(lExtDoc, rExtDoc)
		}
	}
	if l.GetExternalDocs().IsEmpty() && !r.GetExternalDocs().IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.ExternalDocsLabel,
			nil, r.GetExternalDocs().ValueNode, false, nil,
			r.GetExternalDocs().Value)
	}
	if !l.GetExternalDocs().IsEmpty() && r.GetExternalDocs().IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.ExternalDocsLabel,
			l.GetExternalDocs().ValueNode, nil, false, l.GetExternalDocs().Value,
			nil)
	}

	// responses
	if !l.GetResponses().IsEmpty() && !r.GetResponses().IsEmpty() {
		opChanges.ResponsesChanges = CompareResponses(l.GetResponses().Value, r.GetResponses().Value)
	}
	if l.GetResponses().IsEmpty() && !r.GetResponses().IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.ResponsesLabel,
			nil, r.GetResponses().ValueNode, false, nil,
			r.GetResponses().Value)
	}
	if !l.GetResponses().IsEmpty() && r.GetResponses().IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.ResponsesLabel,
			l.GetResponses().ValueNode, nil, true, l.GetResponses().Value,
			nil)
	}
}

// CompareOperations compares a left and right Swagger or OpenAPI Operation object. If changes are found, returns
// a pointer to an OperationChanges instance, or nil if nothing is found.
func CompareOperations(l, r any) *OperationChanges {

	var changes []*Change
	var props []*PropertyCheck

	oc := new(OperationChanges)

	// Swagger
	if reflect.TypeOf(&v2.Operation{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v2.Operation{}) == reflect.TypeOf(r) {

		lOperation := l.(*v2.Operation)
		rOperation := r.(*v2.Operation)

		// perform hash check to avoid further processing
		if low.AreEqual(lOperation, rOperation) {
			return nil
		}

		props = append(props, addSharedOperationProperties(lOperation, rOperation, &changes)...)

		compareSharedOperationObjects(lOperation, rOperation, &changes, oc)

		// parameters
		lParamsUntyped := lOperation.GetParameters()
		rParamsUntyped := rOperation.GetParameters()
		if !lParamsUntyped.IsEmpty() && !rParamsUntyped.IsEmpty() {
			lParams := lParamsUntyped.Value.([]low.ValueReference[*v2.Parameter])
			rParams := rParamsUntyped.Value.([]low.ValueReference[*v2.Parameter])

			lv := make(map[string]*v2.Parameter, len(lParams))
			rv := make(map[string]*v2.Parameter, len(rParams))

			for i := range lParams {
				s := lParams[i].Value.Name.Value
				lv[s] = lParams[i].Value
			}
			for i := range rParams {
				s := rParams[i].Value.Name.Value
				rv[s] = rParams[i].Value
			}

			var paramChanges []*ParameterChanges
			for n := range lv {
				if _, ok := rv[n]; ok {
					if !low.AreEqual(lv[n], rv[n]) {
						ch := CompareParameters(lv[n], rv[n])
						if ch != nil {
							paramChanges = append(paramChanges, ch)
						}
					}
					continue
				}
				CreateChange(&changes, ObjectRemoved, v3.ParametersLabel,
					lv[n].Name.ValueNode, nil, true, lv[n].Name.Value,
					nil)

			}
			for n := range rv {
				if _, ok := lv[n]; !ok {
					CreateChange(&changes, ObjectAdded, v3.ParametersLabel,
						nil, rv[n].Name.ValueNode, true, nil,
						rv[n].Name.Value)
				}
			}
			oc.ParameterChanges = paramChanges
		}
		if !lParamsUntyped.IsEmpty() && rParamsUntyped.IsEmpty() {
			CreateChange(&changes, PropertyRemoved, v3.ParametersLabel,
				lParamsUntyped.ValueNode, nil, true, lParamsUntyped.Value,
				nil)
		}
		if lParamsUntyped.IsEmpty() && !rParamsUntyped.IsEmpty() {
			rParams := rParamsUntyped.Value.([]low.ValueReference[*v2.Parameter])
			breaking := false
			for i := range rParams {
				if rParams[i].Value.Required.Value {
					breaking = true
				}
			}
			CreateChange(&changes, PropertyAdded, v3.ParametersLabel,
				nil, rParamsUntyped.ValueNode, breaking, nil,
				rParamsUntyped.Value)
		}

		// security
		if !lOperation.Security.IsEmpty() || !rOperation.Security.IsEmpty() {
			checkSecurity(lOperation.Security, rOperation.Security, &changes, oc)
		}

		// produces
		if len(lOperation.Produces.Value) > 0 || len(rOperation.Produces.Value) > 0 {
			ExtractStringValueSliceChanges(lOperation.Produces.Value, rOperation.Produces.Value,
				&changes, v3.ProducesLabel, true)
		}

		// consumes
		if len(lOperation.Consumes.Value) > 0 || len(rOperation.Consumes.Value) > 0 {
			ExtractStringValueSliceChanges(lOperation.Consumes.Value, rOperation.Consumes.Value,
				&changes, v3.ConsumesLabel, true)
		}

		// schemes
		if len(lOperation.Schemes.Value) > 0 || len(rOperation.Schemes.Value) > 0 {
			ExtractStringValueSliceChanges(lOperation.Schemes.Value, rOperation.Schemes.Value,
				&changes, v3.SchemesLabel, true)
		}

		oc.ExtensionChanges = CompareExtensions(lOperation.Extensions, rOperation.Extensions)
	}

	// OpenAPI
	if reflect.TypeOf(&v3.Operation{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v3.Operation{}) == reflect.TypeOf(r) {

		lOperation := l.(*v3.Operation)
		rOperation := r.(*v3.Operation)

		// perform hash check to avoid further processing
		if low.AreEqual(lOperation, rOperation) {
			return nil
		}

		props = append(props, addSharedOperationProperties(lOperation, rOperation, &changes)...)
		compareSharedOperationObjects(lOperation, rOperation, &changes, oc)

		// parameters
		lParamsUntyped := lOperation.GetParameters()
		rParamsUntyped := rOperation.GetParameters()
		if !lParamsUntyped.IsEmpty() && !rParamsUntyped.IsEmpty() {
			lParams := lParamsUntyped.Value.([]low.ValueReference[*v3.Parameter])
			rParams := rParamsUntyped.Value.([]low.ValueReference[*v3.Parameter])

			lv := make(map[string]*v3.Parameter, len(lParams))
			rv := make(map[string]*v3.Parameter, len(rParams))

			for i := range lParams {
				s := lParams[i].Value.Name.Value
				lv[s] = lParams[i].Value
			}
			for i := range rParams {
				s := rParams[i].Value.Name.Value
				rv[s] = rParams[i].Value
			}

			var paramChanges []*ParameterChanges
			for n := range lv {
				if _, ok := rv[n]; ok {
					if !low.AreEqual(lv[n], rv[n]) {
						ch := CompareParameters(lv[n], rv[n])
						if ch != nil {
							paramChanges = append(paramChanges, ch)
						}
					}
					continue
				}
				CreateChange(&changes, ObjectRemoved, v3.ParametersLabel,
					lv[n].Name.ValueNode, nil, true, lv[n].Name.Value,
					nil)

			}
			for n := range rv {
				if _, ok := lv[n]; !ok {
					CreateChange(&changes, ObjectAdded, v3.ParametersLabel,
						nil, rv[n].Name.ValueNode, true, nil,
						rv[n].Name.Value)
				}
			}
			oc.ParameterChanges = paramChanges
		}
		if !lParamsUntyped.IsEmpty() && rParamsUntyped.IsEmpty() {
			CreateChange(&changes, PropertyRemoved, v3.ParametersLabel,
				lParamsUntyped.ValueNode, nil, true, lParamsUntyped.Value,
				nil)
		}
		if lParamsUntyped.IsEmpty() && !rParamsUntyped.IsEmpty() {
			rParams := rParamsUntyped.Value.([]low.ValueReference[*v3.Parameter])
			breaking := false
			for i := range rParams {
				if rParams[i].Value.Required.Value {
					breaking = true
				}
			}
			CreateChange(&changes, PropertyAdded, v3.ParametersLabel,
				nil, rParamsUntyped.ValueNode, breaking, nil,
				rParamsUntyped.Value)
		}

		// security
		if !lOperation.Security.IsEmpty() || !rOperation.Security.IsEmpty() {
			checkSecurity(lOperation.Security, rOperation.Security, &changes, oc)
		}

		// request body
		if !lOperation.RequestBody.IsEmpty() && !rOperation.RequestBody.IsEmpty() {
			if !low.AreEqual(lOperation.RequestBody.Value, rOperation.RequestBody.Value) {
				oc.RequestBodyChanges = CompareRequestBodies(lOperation.RequestBody.Value, rOperation.RequestBody.Value)
			}
		}
		if !lOperation.RequestBody.IsEmpty() && rOperation.RequestBody.IsEmpty() {
			CreateChange(&changes, PropertyRemoved, v3.RequestBodyLabel,
				lOperation.RequestBody.ValueNode, nil, true, lOperation.RequestBody.Value,
				nil)
		}
		if lOperation.RequestBody.IsEmpty() && !rOperation.RequestBody.IsEmpty() {
			CreateChange(&changes, PropertyAdded, v3.RequestBodyLabel,
				nil, rOperation.RequestBody.ValueNode, true, nil,
				rOperation.RequestBody.Value)
		}

		// callbacks
		if !lOperation.GetCallbacks().IsEmpty() && !rOperation.GetCallbacks().IsEmpty() {
			oc.CallbackChanges = CheckMapForChanges(lOperation.Callbacks.Value, rOperation.Callbacks.Value, &changes,
				v3.CallbacksLabel, CompareCallback)
		}
		if !lOperation.GetCallbacks().IsEmpty() && rOperation.GetCallbacks().IsEmpty() {
			CreateChange(&changes, PropertyRemoved, v3.CallbacksLabel,
				lOperation.Callbacks.ValueNode, nil, true, lOperation.Callbacks.Value,
				nil)
		}
		if lOperation.Callbacks.IsEmpty() && !rOperation.Callbacks.IsEmpty() {
			CreateChange(&changes, PropertyAdded, v3.CallbacksLabel,
				nil, rOperation.Callbacks.ValueNode, false, nil,
				rOperation.Callbacks.Value)
		}

		// servers
		oc.ServerChanges = checkServers(lOperation.Servers, rOperation.Servers)
		oc.ExtensionChanges = CompareExtensions(lOperation.Extensions, rOperation.Extensions)

	}
	CheckProperties(props)
	oc.PropertyChanges = NewPropertyChanges(changes)
	return oc
}

// check servers property
func checkServers(lServers, rServers low.NodeReference[[]low.ValueReference[*v3.Server]]) []*ServerChanges {

	var serverChanges []*ServerChanges

	if !lServers.IsEmpty() && !rServers.IsEmpty() {

		lv := make(map[string]low.ValueReference[*v3.Server], len(lServers.Value))
		rv := make(map[string]low.ValueReference[*v3.Server], len(rServers.Value))

		for i := range lServers.Value {
			var s string
			if !lServers.Value[i].Value.URL.IsEmpty() {
				s = lServers.Value[i].Value.URL.Value
			} else {
				s = low.GenerateHashString(lServers.Value[i].Value)
			}
			lv[s] = lServers.Value[i]
		}
		for i := range rServers.Value {
			var s string
			if !rServers.Value[i].Value.URL.IsEmpty() {
				s = rServers.Value[i].Value.URL.Value
			} else {
				s = low.GenerateHashString(rServers.Value[i].Value)
			}
			rv[s] = rServers.Value[i]
		}

		for k := range lv {

			var changes []*Change

			if _, ok := rv[k]; ok {
				if !low.AreEqual(lv[k].Value, rv[k].Value) {
					serverChanges = append(serverChanges, CompareServers(lv[k].Value, rv[k].Value))
				}
				continue
			}
			lv[k].ValueNode.Value = lv[k].Value.URL.Value
			CreateChange(&changes, ObjectRemoved, v3.ServersLabel,
				lv[k].ValueNode, nil, true, lv[k].Value.URL.Value,
				nil)
			sc := new(ServerChanges)
			sc.PropertyChanges = NewPropertyChanges(changes)
			serverChanges = append(serverChanges, sc)

		}

		for k := range rv {

			if _, ok := lv[k]; !ok {

				var changes []*Change
				rv[k].ValueNode.Value = rv[k].Value.URL.Value
				CreateChange(&changes, ObjectAdded, v3.ServersLabel,
					nil, rv[k].ValueNode, false, nil,
					rv[k].Value.URL.Value)

				sc := new(ServerChanges)
				sc.PropertyChanges = NewPropertyChanges(changes)
				serverChanges = append(serverChanges, sc)
			}

		}
	}
	var changes []*Change
	sc := new(ServerChanges)
	if !lServers.IsEmpty() && rServers.IsEmpty() {
		CreateChange(&changes, PropertyRemoved, v3.ServersLabel,
			lServers.ValueNode, nil, true, lServers.Value,
			nil)
	}
	if lServers.IsEmpty() && !rServers.IsEmpty() {
		CreateChange(&changes, PropertyAdded, v3.ServersLabel,
			nil, rServers.ValueNode, false, nil,
			rServers.Value)
	}
	sc.PropertyChanges = NewPropertyChanges(changes)
	if len(changes) > 0 {
		serverChanges = append(serverChanges, sc)
	}
	if len(serverChanges) <= 0 {
		return nil
	}
	return serverChanges
}

// check security property.
func checkSecurity(lSecurity, rSecurity low.NodeReference[[]low.ValueReference[*base.SecurityRequirement]],
	changes *[]*Change, oc any) {

	lv := make(map[string]*base.SecurityRequirement, len(lSecurity.Value))
	rv := make(map[string]*base.SecurityRequirement, len(rSecurity.Value))
	lvn := make(map[string]*yaml.Node, len(lSecurity.Value))
	rvn := make(map[string]*yaml.Node, len(rSecurity.Value))

	for i := range lSecurity.Value {
		keys := lSecurity.Value[i].Value.GetKeys()
		sort.Strings(keys)
		s := strings.Join(keys, "|")
		lv[s] = lSecurity.Value[i].Value
		lvn[s] = lSecurity.Value[i].ValueNode

	}
	for i := range rSecurity.Value {
		keys := rSecurity.Value[i].Value.GetKeys()
		sort.Strings(keys)
		s := strings.Join(keys, "|")
		rv[s] = rSecurity.Value[i].Value
		rvn[s] = rSecurity.Value[i].ValueNode
	}

	var secChanges []*SecurityRequirementChanges
	for n := range lv {
		if _, ok := rv[n]; ok {
			if !low.AreEqual(lv[n], rv[n]) {
				ch := CompareSecurityRequirement(lv[n], rv[n])
				if ch != nil {
					secChanges = append(secChanges, ch)
				}
			}
			continue
		}
		lvn[n].Value = strings.Join(lv[n].GetKeys(), ", ")
		CreateChange(changes, ObjectRemoved, v3.SecurityLabel,
			lvn[n], nil, true, lv[n],
			nil)

	}
	for n := range rv {
		if _, ok := lv[n]; !ok {
			rvn[n].Value = strings.Join(rv[n].GetKeys(), ", ")
			CreateChange(changes, ObjectAdded, v3.SecurityLabel,
				nil, rvn[n], false, nil,
				rv[n])
		}
	}

	// handle different change types.
	if reflect.TypeOf(&OperationChanges{}) == reflect.TypeOf(oc) {
		oc.(*OperationChanges).SecurityRequirementChanges = secChanges
	}
	if reflect.TypeOf(&DocumentChanges{}) == reflect.TypeOf(oc) {
		oc.(*DocumentChanges).SecurityRequirementChanges = secChanges
	}
}
