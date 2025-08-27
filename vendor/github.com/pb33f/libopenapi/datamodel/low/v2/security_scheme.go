// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v2

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

// SecurityScheme is a low-level representation of a Swagger / OpenAPI 2 SecurityScheme object.
//
// SecurityScheme allows the definition of a security scheme that can be used by the operations. Supported schemes are
// basic authentication, an API key (either as a header or as a query parameter) and OAuth2's common flows
// (implicit, password, application and access code)
//   - https://swagger.io/specification/v2/#securityDefinitionsObject
type SecurityScheme struct {
	Type             low.NodeReference[string]
	Description      low.NodeReference[string]
	Name             low.NodeReference[string]
	In               low.NodeReference[string]
	Flow             low.NodeReference[string]
	AuthorizationUrl low.NodeReference[string]
	TokenUrl         low.NodeReference[string]
	Scopes           low.NodeReference[*Scopes]
	Extensions       *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
}

// GetExtensions returns all SecurityScheme extensions and satisfies the low.HasExtensions interface.
func (ss *SecurityScheme) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return ss.Extensions
}

// Build will extract extensions and scopes from the node.
func (ss *SecurityScheme) Build(ctx context.Context, _, root *yaml.Node, idx *index.SpecIndex) error {
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	ss.Extensions = low.ExtractExtensions(root)

	scopes, sErr := low.ExtractObject[*Scopes](ctx, ScopesLabel, root, idx)
	if sErr != nil {
		return sErr
	}
	ss.Scopes = scopes
	return nil
}

// Hash will return a consistent SHA256 Hash of the SecurityScheme object
func (ss *SecurityScheme) Hash() [32]byte {
	var f []string
	if !ss.Type.IsEmpty() {
		f = append(f, ss.Type.Value)
	}
	if !ss.Description.IsEmpty() {
		f = append(f, ss.Description.Value)
	}
	if !ss.Name.IsEmpty() {
		f = append(f, ss.Name.Value)
	}
	if !ss.In.IsEmpty() {
		f = append(f, ss.In.Value)
	}
	if !ss.Flow.IsEmpty() {
		f = append(f, ss.Flow.Value)
	}
	if !ss.AuthorizationUrl.IsEmpty() {
		f = append(f, ss.AuthorizationUrl.Value)
	}
	if !ss.TokenUrl.IsEmpty() {
		f = append(f, ss.TokenUrl.Value)
	}
	if !ss.Scopes.IsEmpty() {
		f = append(f, low.GenerateHashString(ss.Scopes.Value))
	}
	f = append(f, low.HashExtensions(ss.Extensions)...)
	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
