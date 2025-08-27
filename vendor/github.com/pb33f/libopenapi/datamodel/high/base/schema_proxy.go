// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package base

import (
	"errors"
	"fmt"
	"net/url"
	"sync"

	"path/filepath"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/high"
	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/datamodel/low/base"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// SchemaProxy exists as a stub that will create a Schema once (and only once) the Schema() method is called. An
// underlying low-level SchemaProxy backs this high-level one.
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
	schema     *low.NodeReference[*base.SchemaProxy]
	buildError error
	rendered   *Schema
	refStr     string
	lock       *sync.Mutex
}

// NewSchemaProxy creates a new high-level SchemaProxy from a low-level one.
func NewSchemaProxy(schema *low.NodeReference[*base.SchemaProxy]) *SchemaProxy {
	return &SchemaProxy{schema: schema, lock: &sync.Mutex{}}
}

// CreateSchemaProxy will create a new high-level SchemaProxy from a high-level Schema, this acts the same
// as if the SchemaProxy is pre-rendered.
func CreateSchemaProxy(schema *Schema) *SchemaProxy {
	return &SchemaProxy{rendered: schema, lock: &sync.Mutex{}}
}

// CreateSchemaProxyRef will create a new high-level SchemaProxy from a reference string, this is used only when
// building out new models from scratch that require a reference rather than a schema implementation.
func CreateSchemaProxyRef(ref string) *SchemaProxy {
	return &SchemaProxy{refStr: ref, lock: &sync.Mutex{}}
}

// GetValueNode returns the value node of the SchemaProxy.
func (sp *SchemaProxy) GetValueNode() *yaml.Node {
	if sp.schema != nil {
		return sp.schema.ValueNode
	}
	return nil
}

// Schema will create a new Schema instance using NewSchema from the low-level SchemaProxy backing this high-level one.
// If there is a problem building the Schema, then this method will return nil. Use GetBuildError to gain access
// to that building error.
//
// It's important to note that this method will return nil on a pointer created using NewSchemaProxy or CreateSchema* methods
// there is no low-level SchemaProxy backing it, and therefore no schema to build, so this will fail. Use BuildSchema
// instead for proxies created using NewSchemaProxy or CreateSchema* methods.
// https://github.com/pb33f/libopenapi/issues/403
func (sp *SchemaProxy) Schema() *Schema {
	if sp == nil || sp.lock == nil {
		return nil
	}

	sp.lock.Lock()
	defer sp.lock.Unlock()

	if sp.rendered != nil {
		return sp.rendered
	}

	if sp.schema == nil || sp.schema.Value == nil {
		return nil
	}

	//check the high-level cache first.
	idx := sp.schema.Value.GetIndex()
	if idx != nil && sp.schema.Value != nil {
		if sp.schema.Value.IsReference() && sp.schema.Value.GetReferenceNode() != nil && sp.schema.GetValueNode() != nil {
			loc := fmt.Sprintf("%s:%d:%d", idx.GetSpecAbsolutePath(), sp.schema.GetValueNode().Line, sp.schema.GetValueNode().Column)
			if seen, ok := idx.GetHighCache().Load(loc); ok {
				idx.HighCacheHit()
				// attribute the parent proxy to the cloned schema
				schema := (*seen.(*Schema))
				schema.ParentProxy = sp
				return &schema
			} else {
				idx.HighCacheMiss()
			}
		}
	}

	s := sp.schema.Value.Schema()
	if s == nil {
		sp.buildError = sp.schema.Value.GetBuildError()
		return nil
	}
	sch := NewSchema(s)

	if idx != nil {

		// only store the schema in the cache if is a reference!
		if sp.IsReference() && sp.GetReferenceNode() != nil && sp.schema != nil && sp.schema.GetValueNode() != nil {
			//if sp.schema.GetValueNode() != nil {
			loc := fmt.Sprintf("%s:%d:%d", idx.GetSpecAbsolutePath(), sp.schema.GetValueNode().Line, sp.schema.GetValueNode().Column)

			// caching is only performed on traditional $ref nodes with a reference and a value node, any 3.1 additional
			// will not be cached as libopenapi does not yet support them.
			if len(sp.GetReferenceNode().Content) == 2 {
				idx.GetHighCache().Store(loc, sch)
			}
		}
	}

	sch.ParentProxy = sp
	sp.rendered = sch
	return sch

}

// IsReference returns true if the SchemaProxy is a reference to another Schema.
func (sp *SchemaProxy) IsReference() bool {
	if sp == nil {
		return false
	}

	if sp.refStr != "" {
		return true
	}
	if sp.schema != nil {
		return sp.schema.Value.IsReference()
	}
	return false
}

// GetReference returns the location of the $ref if this SchemaProxy is a reference to another Schema.
func (sp *SchemaProxy) GetReference() string {
	if sp.refStr != "" {
		return sp.refStr
	}
	return sp.schema.GetValue().GetReference()
}

func (sp *SchemaProxy) GetSchemaKeyNode() *yaml.Node {
	if sp.schema != nil {
		return sp.GoLow().GetKeyNode()
	}
	return nil
}

func (sp *SchemaProxy) GetReferenceNode() *yaml.Node {
	if sp.refStr != "" {
		return utils.CreateRefNode(sp.refStr)
	}
	return sp.schema.GetValue().GetReferenceNode()
}

// GetReferenceOrigin returns a pointer to the index.NodeOrigin of the $ref if this SchemaProxy is a reference to another Schema.
// returns nil if the origin cannot be found (which, means there is a bug, and we need to fix it).
func (sp *SchemaProxy) GetReferenceOrigin() *index.NodeOrigin {
	if sp.schema != nil {
		return sp.schema.Value.GetSchemaReferenceLocation()
	}
	return nil
}

// BuildSchema operates the same way as Schema, except it will return any error along with the *Schema. Unlike the Schema
// method, this will work on a proxy created by the NewSchemaProxy or CreateSchema* methods.
//
// It differs from Schema in that it does not require a low-level SchemaProxy to be present,
// and will build the schema from the high-level one.
func (sp *SchemaProxy) BuildSchema() (*Schema, error) {
	if sp.rendered != nil {
		return sp.rendered, sp.buildError
	}
	schema := sp.Schema()
	er := sp.buildError
	return schema, er
}

// GetBuildError returns any error that was thrown when calling Schema()
func (sp *SchemaProxy) GetBuildError() error {
	return sp.buildError
}

func (sp *SchemaProxy) GoLow() *base.SchemaProxy {
	if sp.schema == nil {
		return nil
	}
	return sp.schema.Value
}

func (sp *SchemaProxy) GoLowUntyped() any {
	if sp.schema == nil {
		return nil
	}
	return sp.schema.Value
}

// Render will return a YAML representation of the Schema object as a byte slice.
func (sp *SchemaProxy) Render() ([]byte, error) {
	return yaml.Marshal(sp)
}

// MarshalYAML will create a ready to render YAML representation of the SchemaProxy object.
func (sp *SchemaProxy) MarshalYAML() (interface{}, error) {
	var s *Schema
	var err error
	// if this schema isn't a reference, then build it out.
	if !sp.IsReference() {
		s, err = sp.BuildSchema()
		if err != nil {
			return nil, err
		}
		nb := high.NewNodeBuilder(s, s.low)
		return nb.Render(), nil
	} else {
		refNode := sp.GetReferenceNode()
		if refNode != nil {
			return refNode, nil
		}

		// do not build out a reference, just marshal the reference.
		return utils.CreateRefNode(sp.GetReference()), nil
	}
}

// MarshalYAMLInline will create a ready to render YAML representation of the SchemaProxy object. The
// $ref values will be inlined instead of kept as is. All circular references will be ignored, regardless
// of the type of circular reference, they are all bad when rendering.
func (sp *SchemaProxy) MarshalYAMLInline() (interface{}, error) {
	var s *Schema
	var err error
	s, err = sp.BuildSchema()

	if s != nil && s.GoLow() != nil && s.GoLow().Index != nil {
		circ := s.GoLow().Index.GetCircularReferences()

		// extract the ignored and safe circular references
		ignored := s.GoLow().Index.GetRolodex().GetIgnoredCircularReferences()
		safe := s.GoLow().Index.GetRolodex().GetSafeCircularReferences()
		circ = append(circ, ignored...)
		circ = append(circ, safe...)
		for _, c := range circ {
			if sp.IsReference() {
				if sp.GetReference() == c.LoopPoint.Definition {
					// nope
					return sp.GetReferenceNode(),
						fmt.Errorf("cannot render circular reference: %s", c.LoopPoint.Definition)
				}
				basePath := sp.GoLow().GetIndex().GetSpecAbsolutePath()

				if !filepath.IsAbs(basePath) && !strings.HasPrefix(basePath, "http") {
					basePath, _ = filepath.Abs(basePath)
				}

				if basePath == c.LoopPoint.FullDefinition {
					// we loop on our-self
					return sp.GetReferenceNode(), nil
				}
				a := utils.ReplaceWindowsDriveWithLinuxPath(strings.Replace(c.LoopPoint.FullDefinition, basePath, "", 1))
				b := sp.GetReference()
				if strings.HasPrefix(b, "./") {
					b = strings.Replace(b, "./", "/", 1) // strip any leading ./ from the reference
				}
				// if loading things in remotely and references are relative.
				if strings.HasPrefix(a, "http") {
					purl, _ := url.Parse(a)
					if purl != nil {
						specPath := filepath.Dir(purl.Path)
						host := fmt.Sprintf("%s://%s", purl.Scheme, purl.Host)
						a = strings.Replace(a, host, "", 1)
						a = strings.Replace(a, specPath, "", 1)
					}
				}
				if a == b {
					// nope
					return sp.GetReferenceNode(), nil
				}
			}
		}
	}

	if err != nil {
		return nil, err
	}
	if s != nil {
		nb := high.NewNodeBuilder(s, s.low)
		nb.Resolve = true
		return nb.Render(), nil
	}
	return nil, errors.New("unable to render schema")
}
