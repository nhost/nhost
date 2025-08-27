// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/v2"
	"github.com/pb33f/libopenapi/datamodel/low/v3"
	"reflect"
)

// SecuritySchemeChanges represents changes made between Swagger or OpenAPI SecurityScheme Objects.
type SecuritySchemeChanges struct {
	*PropertyChanges
	ExtensionChanges *ExtensionChanges `json:"extensions,omitempty" yaml:"extensions,omitempty"`

	// OpenAPI Version
	OAuthFlowChanges *OAuthFlowsChanges `json:"oAuthFlow,omitempty" yaml:"oAuthFlow,omitempty"`

	// Swagger Version
	ScopesChanges *ScopesChanges `json:"scopes,omitempty" yaml:"scopes,omitempty"`
}

// GetAllChanges returns a slice of all changes made between SecurityRequirement objects
func (ss *SecuritySchemeChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, ss.Changes...)
	if ss.OAuthFlowChanges != nil {
		changes = append(changes, ss.OAuthFlowChanges.GetAllChanges()...)
	}
	if ss.ScopesChanges != nil {
		changes = append(changes, ss.ScopesChanges.GetAllChanges()...)
	}
	if ss.ExtensionChanges != nil {
		changes = append(changes, ss.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges represents total changes found between two Swagger or OpenAPI SecurityScheme instances.
func (ss *SecuritySchemeChanges) TotalChanges() int {
	c := ss.PropertyChanges.TotalChanges()
	if ss.OAuthFlowChanges != nil {
		c += ss.OAuthFlowChanges.TotalChanges()
	}
	if ss.ScopesChanges != nil {
		c += ss.ScopesChanges.TotalChanges()
	}
	if ss.ExtensionChanges != nil {
		c += ss.ExtensionChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns total number of breaking changes between two SecurityScheme Objects.
func (ss *SecuritySchemeChanges) TotalBreakingChanges() int {
	c := ss.PropertyChanges.TotalBreakingChanges()
	if ss.OAuthFlowChanges != nil {
		c += ss.OAuthFlowChanges.TotalBreakingChanges()
	}
	if ss.ScopesChanges != nil {
		c += ss.ScopesChanges.TotalBreakingChanges()
	}
	return c
}

// CompareSecuritySchemesV2 is a Swagger type safe proxy for CompareSecuritySchemes
func CompareSecuritySchemesV2(l, r *v2.SecurityScheme) *SecuritySchemeChanges {
	return CompareSecuritySchemes(l, r)
}

// CompareSecuritySchemesV3 is an OpenAPI type safe proxt for CompareSecuritySchemes
func CompareSecuritySchemesV3(l, r *v3.SecurityScheme) *SecuritySchemeChanges {
	return CompareSecuritySchemes(l, r)
}

// CompareSecuritySchemes compares left and right Swagger or OpenAPI Security Scheme objects for changes.
// If anything is found, returns a pointer to *SecuritySchemeChanges or nil if nothing is found.
func CompareSecuritySchemes(l, r any) *SecuritySchemeChanges {

	var props []*PropertyCheck
	var changes []*Change

	sc := new(SecuritySchemeChanges)
	if reflect.TypeOf(&v2.SecurityScheme{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v2.SecurityScheme{}) == reflect.TypeOf(r) {

		lSS := l.(*v2.SecurityScheme)
		rSS := r.(*v2.SecurityScheme)

		if low.AreEqual(lSS, rSS) {
			return nil
		}
		addPropertyCheck(&props, lSS.Type.ValueNode, rSS.Type.ValueNode,
			lSS.Type.Value, rSS.Type.Value, &changes, v3.TypeLabel, true)

		addPropertyCheck(&props, lSS.Description.ValueNode, rSS.Description.ValueNode,
			lSS.Description.Value, rSS.Description.Value, &changes, v3.DescriptionLabel, false)

		addPropertyCheck(&props, lSS.Name.ValueNode, rSS.Name.ValueNode,
			lSS.Name.Value, rSS.Name.Value, &changes, v3.NameLabel, true)

		addPropertyCheck(&props, lSS.In.ValueNode, rSS.In.ValueNode,
			lSS.In.Value, rSS.In.Value, &changes, v3.InLabel, true)

		addPropertyCheck(&props, lSS.Flow.ValueNode, rSS.Flow.ValueNode,
			lSS.Flow.Value, rSS.Flow.Value, &changes, v3.FlowLabel, true)

		addPropertyCheck(&props, lSS.AuthorizationUrl.ValueNode, rSS.AuthorizationUrl.ValueNode,
			lSS.AuthorizationUrl.Value, rSS.AuthorizationUrl.Value, &changes, v3.AuthorizationUrlLabel, true)

		addPropertyCheck(&props, lSS.TokenUrl.ValueNode, rSS.TokenUrl.ValueNode,
			lSS.TokenUrl.Value, rSS.TokenUrl.Value, &changes, v3.TokenUrlLabel, true)

		if !lSS.Scopes.IsEmpty() && !rSS.Scopes.IsEmpty() {
			if !low.AreEqual(lSS.Scopes.Value, rSS.Scopes.Value) {
				sc.ScopesChanges = CompareScopes(lSS.Scopes.Value, rSS.Scopes.Value)
			}
		}
		if lSS.Scopes.IsEmpty() && !rSS.Scopes.IsEmpty() {
			CreateChange(&changes, ObjectAdded, v3.ScopesLabel,
				nil, rSS.Scopes.ValueNode, false, nil, rSS.Scopes.Value)
		}
		if !lSS.Scopes.IsEmpty() && rSS.Scopes.IsEmpty() {
			CreateChange(&changes, ObjectRemoved, v3.ScopesLabel,
				lSS.Scopes.ValueNode, nil, true, lSS.Scopes.Value, nil)
		}

		sc.ExtensionChanges = CompareExtensions(lSS.Extensions, rSS.Extensions)
	}

	if reflect.TypeOf(&v3.SecurityScheme{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v3.SecurityScheme{}) == reflect.TypeOf(r) {

		lSS := l.(*v3.SecurityScheme)
		rSS := r.(*v3.SecurityScheme)

		if low.AreEqual(lSS, rSS) {
			return nil
		}
		addPropertyCheck(&props, lSS.Type.ValueNode, rSS.Type.ValueNode,
			lSS.Type.Value, rSS.Type.Value, &changes, v3.TypeLabel, true)

		addPropertyCheck(&props, lSS.Description.ValueNode, rSS.Description.ValueNode,
			lSS.Description.Value, rSS.Description.Value, &changes, v3.DescriptionLabel, false)

		addPropertyCheck(&props, lSS.Name.ValueNode, rSS.Name.ValueNode,
			lSS.Name.Value, rSS.Name.Value, &changes, v3.NameLabel, true)

		addPropertyCheck(&props, lSS.In.ValueNode, rSS.In.ValueNode,
			lSS.In.Value, rSS.In.Value, &changes, v3.InLabel, true)

		addPropertyCheck(&props, lSS.Scheme.ValueNode, rSS.Scheme.ValueNode,
			lSS.Scheme.Value, rSS.Scheme.Value, &changes, v3.SchemeLabel, true)

		addPropertyCheck(&props, lSS.BearerFormat.ValueNode, rSS.BearerFormat.ValueNode,
			lSS.BearerFormat.Value, rSS.BearerFormat.Value, &changes, v3.SchemeLabel, false)

		addPropertyCheck(&props, lSS.OpenIdConnectUrl.ValueNode, rSS.OpenIdConnectUrl.ValueNode,
			lSS.OpenIdConnectUrl.Value, rSS.OpenIdConnectUrl.Value, &changes, v3.OpenIdConnectUrlLabel, false)

		if !lSS.Flows.IsEmpty() && !rSS.Flows.IsEmpty() {
			if !low.AreEqual(lSS.Flows.Value, rSS.Flows.Value) {
				sc.OAuthFlowChanges = CompareOAuthFlows(lSS.Flows.Value, rSS.Flows.Value)
			}
		}
		if lSS.Flows.IsEmpty() && !rSS.Flows.IsEmpty() {
			CreateChange(&changes, ObjectAdded, v3.FlowsLabel,
				nil, rSS.Flows.ValueNode, false, nil, rSS.Flows.Value)
		}
		if !lSS.Flows.IsEmpty() && rSS.Flows.IsEmpty() {
			CreateChange(&changes, ObjectRemoved, v3.ScopesLabel,
				lSS.Flows.ValueNode, nil, true, lSS.Flows.Value, nil)
		}
		sc.ExtensionChanges = CompareExtensions(lSS.Extensions, rSS.Extensions)
	}
	CheckProperties(props)
	sc.PropertyChanges = NewPropertyChanges(changes)
	return sc
}
