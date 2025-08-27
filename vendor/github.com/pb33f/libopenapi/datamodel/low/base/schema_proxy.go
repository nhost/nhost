// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"context"
	"crypto/sha256"
	"log/slog"
	"sync"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// SchemaProxy exists as a stub that will create a Schema once (and only once) the Schema() method is called.
//
// Why use a Proxy design?
//
// There are three reasons.
//
// 1. Circular References and Endless Loops.
//
// JSON Schema allows for references to be used. This means references can loop around and create infinite recursive
// structures, These 'Circular references' technically mean a schema can NEVER be resolved, not without breaking the
// loop somewhere along the chain.
//
// Polymorphism in the form of 'oneOf' and 'anyOf' in version 3+ only exacerbates the problem.
//
// These circular traps can be discovered using the resolver, however it's still not enough to stop endless loops and
// endless goroutine spawning. A proxy design means that resolving occurs on demand and runs down a single level only.
// preventing any run-away loops.
//
// 2. Performance
//
// Even without circular references, Polymorphism creates large additional resolving chains that take a long time
// and slow things down when building. By preventing recursion through every polymorphic item, building models is kept
// fast and snappy, which is desired for realtime processing of specs.
//
//   - Q: Yeah, but, why not just use state to avoiding re-visiting seen polymorphic nodes?
//   - A: It's slow, takes up memory and still has runaway potential in very, very long chains.
//
// 3. Short Circuit Errors.
//
// Schemas are where things can get messy, mainly because the Schema standard changes between versions, and
// it's not actually JSONSchema until 3.1, so lots of times a bad schema will break parsing. Errors are only found
// when a schema is needed, so the rest of the document is parsed and ready to use.
type SchemaProxy struct {
	low.Reference
	kn         *yaml.Node
	vn         *yaml.Node
	idx        *index.SpecIndex
	rendered   *Schema
	buildError error
	ctx        context.Context
	*low.NodeMap
}

// Build will prepare the SchemaProxy for rendering, it does not build the Schema, only sets up internal state.
// Key maybe nil if absent.
func (sp *SchemaProxy) Build(ctx context.Context, key, value *yaml.Node, idx *index.SpecIndex) error {
	sp.kn = key
	sp.vn = value
	sp.idx = idx
	sp.ctx = ctx
	if rf, _, r := utils.IsNodeRefValue(value); rf {
		sp.SetReference(r, value)
	}
	var m sync.Map
	sp.NodeMap = &low.NodeMap{Nodes: &m}
	return nil
}

// Schema will first check if this SchemaProxy has already rendered the schema, and return the pre-rendered version
// first.
//
// If this is the first run of Schema(), then the SchemaProxy will create a new Schema from the underlying
// yaml.Node. Once built out, the SchemaProxy will record that Schema as rendered and store it for later use,
// (this is what is we mean when we say 'pre-rendered').
//
// Schema() then returns the newly created Schema.
//
// If anything goes wrong during the build, then nothing is returned and the error that occurred can
// be retrieved by using GetBuildError()
func (sp *SchemaProxy) Schema() *Schema {
	if sp.rendered != nil {
		return sp.rendered
	}
	schema := new(Schema)
	utils.CheckForMergeNodes(sp.vn)
	err := schema.Build(sp.ctx, sp.vn, sp.idx)
	if err != nil {
		sp.buildError = err
		return nil
	}
	schema.ParentProxy = sp // https://github.com/pb33f/libopenapi/issues/29
	sp.rendered = schema

	// for all the nodes added, copy them over to the schema
	if sp.NodeMap != nil {
		sp.NodeMap.Nodes.Range(func(key, value any) bool {
			schema.AddNode(key.(int), value.(*yaml.Node))
			return true
		})
	}
	return schema
}

// GetBuildError returns the build error that was set when Schema() was called. If Schema() has not been run, or
// there were no errors during build, then nil will be returned.
func (sp *SchemaProxy) GetBuildError() error {
	return sp.buildError
}

func (sp *SchemaProxy) GetSchemaReferenceLocation() *index.NodeOrigin {
	if sp.idx != nil {
		origin := sp.idx.FindNodeOrigin(sp.vn)
		if origin != nil {
			return origin
		}
		if sp.idx.GetRolodex() != nil {
			origin = sp.idx.GetRolodex().FindNodeOrigin(sp.vn)
			return origin
		}
	}
	return nil
}

// GetKeyNode will return the yaml.Node pointer that is a key for value node.
func (sp *SchemaProxy) GetKeyNode() *yaml.Node {
	return sp.kn
}

// GetContext will return the context.Context object that was passed to the SchemaProxy during build.
func (sp *SchemaProxy) GetContext() context.Context {
	return sp.ctx
}

// GetValueNode will return the yaml.Node pointer used by the proxy to generate the Schema.
func (sp *SchemaProxy) GetValueNode() *yaml.Node {
	return sp.vn
}

// Hash will return a consistent SHA256 Hash of the SchemaProxy object (it will resolve it)
func (sp *SchemaProxy) Hash() [32]byte {
	if sp.rendered != nil {
		if !sp.IsReference() {
			return sp.rendered.Hash()
		}
	} else {
		if !sp.IsReference() {
			// only resolve this proxy if it's not a ref.
			sch := sp.Schema()
			sp.rendered = sch
			if sch != nil {
				return sch.Hash()
			}
			var logger *slog.Logger
			if sp.idx != nil {
				logger = sp.idx.GetLogger()
			}
			if logger != nil {
				logger.Warn("SchemaProxy.Hash() failed to resolve schema, returning empty hash", "error", sp.GetBuildError().Error())
			}
			return [32]byte{}
		}
	}
	// hash reference value only, do not resolve!
	return sha256.Sum256([]byte(sp.GetReference()))
}

// AddNode stores nodes in the underlying schema if rendered, otherwise holds in the proxy until build.
func (sp *SchemaProxy) AddNode(key int, node *yaml.Node) {
	if sp.rendered != nil {
		sp.rendered.AddNode(key, node)
	} else {
		sp.Nodes.Store(key, node)
	}
}

// GetIndex will return the index.SpecIndex pointer that was passed to the SchemaProxy during build.
func (sp *SchemaProxy) GetIndex() *index.SpecIndex {
	return sp.idx
}
