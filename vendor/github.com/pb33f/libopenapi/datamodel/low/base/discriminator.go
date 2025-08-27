// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"crypto/sha256"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/orderedmap"
)

// Discriminator is only used by OpenAPI 3+ documents, it represents a polymorphic discriminator used for schemas
//
// When request bodies or response payloads may be one of a number of different schemas, a discriminator object can be
// used to aid in serialization, deserialization, and validation. The discriminator is a specific object in a schema
// which is used to inform the consumer of the document of an alternative schema based on the value associated with it.
//
// When using the discriminator, inline schemas will not be considered.
//
//	v3 - https://spec.openapis.org/oas/v3.1.0#discriminator-object
type Discriminator struct {
	PropertyName low.NodeReference[string]
	Mapping      low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[string]]]
	KeyNode      *yaml.Node
	RootNode     *yaml.Node
	low.Reference
	low.NodeMap
}

// GetRootNode will return the root yaml node of the Discriminator object
func (d *Discriminator) GetRootNode() *yaml.Node {
	return d.RootNode
}

// GetKeyNode will return the key yaml node of the Discriminator object
func (d *Discriminator) GetKeyNode() *yaml.Node {
	return d.KeyNode
}

// FindMappingValue will return a ValueReference containing the string mapping value
func (d *Discriminator) FindMappingValue(key string) *low.ValueReference[string] {
	for k, v := range d.Mapping.Value.FromOldest() {
		if k.Value == key {
			return &v
		}
	}
	return nil
}

// Hash will return a consistent SHA256 Hash of the Discriminator object
func (d *Discriminator) Hash() [32]byte {
	// calculate a hash from every property.
	var f []string
	if d.PropertyName.Value != "" {
		f = append(f, d.PropertyName.Value)
	}

	for v := range orderedmap.SortAlpha(d.Mapping.Value).ValuesFromOldest() {
		f = append(f, v.Value)
	}

	return sha256.Sum256([]byte(strings.Join(f, "|")))
}
