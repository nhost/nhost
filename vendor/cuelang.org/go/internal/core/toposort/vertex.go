// Copyright 2024 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package toposort

// Ultimately we need to build a graph of field names. Those field
// names can come from different constructions, such as:
//
// 1. Within a struct
//
//	x: {z: _, y: _}
//
// When considering x, there should be a edge from z to y (written
// from now on as (z -> y)).
//
// 2. Explicit unification
//
//	x: {z: _, y: _} & {x: _, w: _}
//
// When considering x, we want no edges between the arguments of the
// explicit unification operator '&'.  There should only be edges (z
// -> y) and (x -> w). Through explicit unifications, cycles of field
// names can be introduced, e.g.:
//
//	x: {z: _, y: _} & {y: _, w: _, z: _}
//
// 3. Embeddings
//
//	b: {x: _, w: _}
//	a: {z: _, y: _}
//	c: { a, b }
//
// Here, a and b are embedded within c, and the order is important, so
// at a minimum we want edges (z -> y), (x -> w), and (y -> x). Other
// edges which don't introduce cycles are also acceptable (e.g. (z ->
// x), (y -> w) etc).
//
// 4. Implicit unification
//
//	c: {z: _, y: _}
//	c: {x: _, w: _}
//
// Here, like with embeddings, we choose that the source order is
// important, and so we must have a minimum of (z -> y), (x -> w) and
// (y -> x).
//
// Currently, the evaluator does not always provide enough information
// for us to be able to reliably identify all implicit unifications,
// especially where the ordering is enforced via some intermediate
// node. For example:
//
//	a: {
//		d: z: _
//		d: t: _
//		e: {x: _, w: _}
//	}
//	c: a.d & a.e
//
// Here, the information we get when sorting the fields of c (post
// evaluation), is insufficient to be able to establish the edge (z ->
// t), but it is sufficient to establish (x -> w). So in this case, we
// end up only with the edge (x -> w), and so the other field names
// fall back to lexicographical sorting.
//
// 5. Duplicates
//
//	a: {z: _, y: _, z: int}
//
//	b: c: _
//	b: d: _
//	b: c: int
//
// For a, we want to try to avoid adding an edge (y -> z), and for b
// we want to try to avoid adding an edge (d -> c). So within a
// regular struct, we do not add any additional edges when revisiting
// a declaration previously visited within the same struct. Similarly,
// for implicit unifications within the same file, we do not add any
// additional edges when revisiting a declaration.
//
// In order to get as close as possible to the desired ordering, we
// range over the Vertex's StructInfos, maintaining a list of Features
// which must come before any new Features, i.e. a frontier. For this
// to work, we need to sort the Vertex's StructInfos. Two approaches
// are used:
//
// 1. A topological sorting of a Vertex's StructInfos. This is
// effective for embeddings, and the relationship between embeddings
// and regular fields. For example:
//
//	a: {y: _, x: _}
//	b: {z: _, a}
//
// For b, a topological analysis will find that we can't enter the
// StructInfo containing y and x, until after we've processed the
// declaration of z.
//
// 2. However, even after a topological analysis, we'll often have
// many root StructInfos. We order these by source position (not the
// soure position of the StructInfo's StructLit itself, but of the
// references (if any) that resolved to the StructInfo's StructLit),
// then group them. If several StructInfos share the same position,
// then they are batched together and considered to be explictly
// unified. Then, consecutive batches of explicitly unified
// StructInfos are grouped together.
//
// The result is that explicit unification is correctly
// identified. E.g.:
//
//	a: {x: _}
//	b: {z: int}
//	c: {y: >10}
//	o: a & b & c
//
// for o, the StructInfos corresponding to a, b and c will all be
// grouped together in a single batch and considered to be explicitly
// unified. Also, structInfos that correspond to the same position
// (including no position) will be treated as explicity unified, and
// so no weight will be given to their relative position within the
// Vertex's slice of StructInfos.

import (
	"cmp"
	"fmt"
	"slices"

	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
)

type structMeta struct {
	structInfo *adt.StructInfo
	pos        token.Pos

	// Should this struct be considered to be part of an explicit
	// unification (e.g. x & y)?
	isExplicit bool
	// Does this struct have no incoming edges?
	isRoot bool
}

func (sMeta *structMeta) String() string {
	var sl *adt.StructLit
	if sMeta.structInfo != nil {
		sl = sMeta.structInfo.StructLit
	}
	return fmt.Sprintf("{%p sl:%p %v (explicit? %v; root? %v)}",
		sMeta, sl, sMeta.pos, sMeta.isExplicit, sMeta.isRoot)
}

func (sm *structMeta) hasDynamic(dynFieldsMap map[*adt.DynamicField][]adt.Feature) bool {
	for _, decl := range sm.structInfo.Decls {
		if dynField, ok := decl.(*adt.DynamicField); ok {
			if _, found := dynFieldsMap[dynField]; found {
				return true
			}
		}
	}
	return false
}

// We need to order a Vertex's StructInfos. To do that, we want a
// filename+position for every StructInfo.
//
// We build a map from every StructInfo's StructLit and all its decls
// to a *structMeta, using the structLit's position.
//
// The StructLit in a StructInfo may directly appear in the parent's
// arc conjuncts. In this case, the StructLit's position is the
// correct position to use. But the StructLit may have been reached
// via a FieldReference, or SelectorExpr or something else. We want
// the position of the reference, and not the StructLit itself. E.g.
//
//	a: {x: 5}
//	b: {y: 7}
//	c: b
//	c: a
//
// If we're ordering the fields of c, we want the position of b and a
// on lines 3 and 4, not the StructLits which declare a and b on lines
// 1 and 2. To do this, we walk through the Vertex's Arc's
// conjuncts. If a conjunct's Field has been reached via some
// resolver, then the conjunct's Refs will record that, and will allow
// us to update the Field's position (and hence the StructLit's
// position) to that of the reference.
//
// Additionally, we need to discover whether each StructLit is
// included as a result of explicit unification (c: a & b), implicit
// unification:
//
//	c: b
//	c: a
//
// or embedding:
//
//	c: {
//	    b
//	    a
//	}
//
// Explicit unification needs treating specially so to avoid incorrect
// edges between the fields of the lhs and rhs of the &. To do this,
// we look at the vertex's conjuncts. If a conjunct is a binary
// expression &, then we look up the structMeta for the arguments to
// the binary expression, and mark them as explicit unification.
func analyseStructs(v *adt.Vertex, builder *GraphBuilder) ([]*structMeta, map[adt.Decl][]*structMeta) {
	structInfos := v.Structs
	nodeToStructMeta := make(map[adt.Node][]*structMeta)
	structMetas := make([]structMeta, len(structInfos))

	// First pass: make sure we create all the structMetas and map to
	// them from a StructInfo's StructLit, and all its internal
	// Decls. Assume everything is a root. Initial attempt at recording
	// a position, which will be correct only for direct use of literal
	// structs in the calculation of vertex v.
	for i, s := range structInfos {
		sl := s.StructLit
		sMeta := &structMetas[i]
		sMeta.structInfo = s
		sMeta.isRoot = true
		if src := sl.Source(); src != nil {
			sMeta.pos = src.Pos()
		}
		nodeToStructMeta[sl] = append(nodeToStructMeta[sl], sMeta)
		for _, decl := range sl.Decls {
			nodeToStructMeta[decl] = append(nodeToStructMeta[decl], sMeta)
		}
	}

	roots := make([]*structMeta, 0, len(structMetas))
	outgoing := make(map[adt.Decl][]*structMeta)
	// Second pass: build outgoing map based on the StructInfo
	// parent-child relationship. Children are necessarily not roots.
	for i := range structMetas {
		sMeta := &structMetas[i]
		parentDecl := sMeta.structInfo.Decl
		if _, found := nodeToStructMeta[parentDecl]; found {
			outgoing[parentDecl] = append(outgoing[parentDecl], sMeta)
			sMeta.isRoot = false
		} else {
			roots = append(roots, sMeta)
		}
	}

	// If an arc's conjunct's Field is a node we care about, and it has
	// been reached via resolution, then unwind those resolutions to
	// uncover the position of the earliest reference.
	for _, arc := range v.Arcs {
		builder.EnsureNode(arc.Label)
		arc.VisitLeafConjuncts(func(c adt.Conjunct) bool {
			field := c.Field()
			debug("self arc conjunct field %p :: %T, expr %p :: %T (%v)\n",
				field, field, c.Expr(), c.Expr(), c.Expr().Source())
			sMetas, found := nodeToStructMeta[field]
			if !found {
				return true
			}
			if src := field.Source(); src != nil {
				for _, sMeta := range sMetas {
					sMeta.pos = src.Pos()
				}
			}
			refs := c.CloseInfo.CycleInfo.Refs
			if refs == nil {
				return true
			}
			debug(" ref %p :: %T (%v)\n",
				refs.Ref, refs.Ref, refs.Ref.Source().Pos())
			for refs.Next != nil {
				refs = refs.Next
				debug(" ref %p :: %T (%v)\n",
					refs.Ref, refs.Ref, refs.Ref.Source().Pos())
			}
			nodeToStructMeta[refs.Ref] = append(nodeToStructMeta[refs.Ref], sMetas...)
			if pos := refs.Ref.Source().Pos(); pos != token.NoPos {
				for _, sMeta := range nodeToStructMeta[refs.Ref] {
					sMeta.pos = pos
				}
			}

			return true
		})
	}

	// Explore our own conjuncts to find explicit unifications and
	// record as appropriate in the structMetas.
	v.VisitLeafConjuncts(func(c adt.Conjunct) bool {
		debug("self conjunct field %p :: %T, expr %p :: %T\n",
			c.Field(), c.Field(), c.Expr(), c.Expr())
		worklist := []adt.Expr{c.Expr()}
		for len(worklist) != 0 {
			expr := worklist[0]
			worklist = worklist[1:]

			binExpr, ok := expr.(*adt.BinaryExpr)
			if !ok || binExpr.Op != adt.AndOp {
				continue
			}
			for _, expr := range []adt.Expr{binExpr.X, binExpr.Y} {
				for _, sMeta := range nodeToStructMeta[expr] {
					sMeta.isExplicit = true
				}
			}
			worklist = append(worklist, binExpr.X, binExpr.Y)
		}
		return true
	})

	return roots, outgoing
}

// Find all fields which have been created as a result of successful
// evaluation of a dynamic field name.
func dynamicFieldsFeatures(v *adt.Vertex) map[*adt.DynamicField][]adt.Feature {
	var m map[*adt.DynamicField][]adt.Feature
	for _, arc := range v.Arcs {
		arc.VisitLeafConjuncts(func(c adt.Conjunct) bool {
			if dynField, ok := c.Field().(*adt.DynamicField); ok {
				if m == nil {
					m = make(map[*adt.DynamicField][]adt.Feature)
				}
				m[dynField] = append(m[dynField], arc.Label)
			}
			return true
		})
	}
	return m
}

type structMetaBatch []*structMeta

func (batch structMetaBatch) isExplicit() bool {
	return len(batch) > 1 || (len(batch) == 1 && batch[0].isExplicit)
}

type structMetaBatches []structMetaBatch

func (batchesPtr *structMetaBatches) appendBatch(batch structMetaBatch) {
	if len(batch) == 0 {
		return
	}
	batches := *batchesPtr
	if l := len(batches); l == 0 {
		*batchesPtr = append(batches, batch)
	} else if prevBatch := batches[l-1]; batch.isExplicit() &&
		prevBatch.isExplicit() &&
		batch[0].pos.Filename() == prevBatch[0].pos.Filename() {
		batches[l-1] = append(batches[l-1], batch...)
	} else {
		*batchesPtr = append(batches, batch)
	}
}

type vertexFeatures struct {
	builder      *GraphBuilder
	dynFieldsMap map[*adt.DynamicField][]adt.Feature
	outgoing     map[adt.Decl][]*structMeta
}

func (vf *vertexFeatures) compareStructMeta(a, b *structMeta) int {
	if c := comparePos(a.pos, b.pos); c != 0 {
		return c
	}
	aHasDyn := a.hasDynamic(vf.dynFieldsMap)
	bHasDyn := b.hasDynamic(vf.dynFieldsMap)
	switch {
	case aHasDyn == bHasDyn:
		return 0
	case aHasDyn:
		return 1 // gather dynamic fields at the end
	default:
		return -1
	}
}

func comparePos(aPos, bPos token.Pos) int {
	if aPos == bPos {
		return 0
	} else if aPos == token.NoPos {
		return 1
	} else if bPos == token.NoPos {
		return -1
	}
	if c := cmp.Compare(aPos.Filename(), bPos.Filename()); c != 0 {
		return c
	}
	return cmp.Compare(aPos.Offset(), bPos.Offset())
}

func VertexFeatures(index adt.StringIndexer, v *adt.Vertex) []adt.Feature {
	debug("\n*** V (%s %v %p) ***\n", v.Label.RawString(index), v.Label, v)

	builder := NewGraphBuilder()
	dynFieldsMap := dynamicFieldsFeatures(v)
	roots, outgoing := analyseStructs(v, builder)

	vf := &vertexFeatures{
		builder:      builder,
		dynFieldsMap: dynFieldsMap,
		outgoing:     outgoing,
	}

	slices.SortFunc(roots, vf.compareStructMeta)
	debug("roots: %v\n", roots)

	var batches structMetaBatches
	var batch structMetaBatch
	for _, root := range roots {
		if len(batch) == 0 ||
			(batch[0].pos == root.pos && !root.hasDynamic(dynFieldsMap)) {
			batch = append(batch, root)
		} else {
			batches.appendBatch(batch)
			batch = structMetaBatch{root}
		}
	}
	batches.appendBatch(batch)
	debug("batches: %v\n", batches)

	var previous, next []adt.Feature
	var previousBatch structMetaBatch
	for _, batch := range batches {
		explicit := batch.isExplicit()
		if len(previousBatch) != 0 &&
			previousBatch[0].pos.Filename() != batch[0].pos.Filename() {
			previous = nil
		}
		for _, root := range batch {
			root.isExplicit = explicit
			debug("starting root. Explicit unification? %v\n", explicit)
			next = append(next, vf.addEdges(previous, root)...)
		}
		previous = next
		next = nil
		previousBatch = batch
	}

	debug("edges: %v\n", builder.edgesSet)
	return builder.Build().Sort(index)
}

func (vf *vertexFeatures) addEdges(previous []adt.Feature, sMeta *structMeta) []adt.Feature {
	debug("--- S %p (%p :: %T) (sl: %p) (explicit? %v) ---\n",
		sMeta, sMeta.structInfo.Decl, sMeta.structInfo.Decl,
		sMeta.structInfo.StructLit, sMeta.isExplicit)
	debug(" previous: %v\n", previous)
	var next []adt.Feature

	filename := sMeta.pos.Filename()
	debug(" filename: %s (%v)\n", filename, sMeta.pos)

	for i, decl := range sMeta.structInfo.Decls {
		debug(" %p / %d: d (%p :: %T)\n", sMeta, i, decl, decl)
		if bin, ok := decl.(*adt.BinaryExpr); ok {
			debug("  binary expr: %p :: %T %v %p :: %T\n",
				bin.X, bin.X, bin.Op, bin.Y, bin.Y)
		}

		currentLabel := adt.InvalidLabel
		switch decl := decl.(type) {
		case *adt.Field:
			currentLabel = decl.Label
			debug(" value %p :: %T (%v)\n", decl.Value, decl.Value, decl.Value)
			if src := decl.Value.Source(); src != nil {
				debug(" field value source: %v\n", src.Pos())
			}
		case *adt.DynamicField:
			// This struct contains a dynamic field. If that dynamic
			// field was successfully evaluated into a field, then insert
			// that field into this chain.
			if labels := vf.dynFieldsMap[decl]; len(labels) > 0 {
				currentLabel = labels[0]
				vf.dynFieldsMap[decl] = labels[1:]
			}
		}
		if currentLabel != adt.InvalidLabel {
			debug("  label %v\n", currentLabel)

			node, exists := vf.builder.nodesByFeature[currentLabel]
			if exists && node.structMeta == sMeta {
				// same field within the same structLit
				debug("    skipping 1\n")

			} else if exists && !sMeta.isExplicit && sMeta.pos != token.NoPos &&
				node.structMeta != nil &&
				node.structMeta.pos.Filename() == filename {
				// same field within the same file during implicit unification
				debug("    skipping 2\n")

			} else {
				debug("    %v %v\n", node, exists)
				node = vf.builder.EnsureNode(currentLabel)
				node.structMeta = sMeta
				next = append(next, currentLabel)
				for _, prevLabel := range previous {
					vf.builder.AddEdge(prevLabel, currentLabel)
				}
				previous = next
				next = nil
			}
		}

		if nextStructMetas := vf.outgoing[decl]; len(nextStructMetas) != 0 {
			debug("  nextStructs: %v\n", nextStructMetas)
			binExpr, isBinary := decl.(*adt.BinaryExpr)
			isBinary = isBinary && binExpr.Op == adt.AndOp

			for _, sMeta := range nextStructMetas {
				sMeta.isExplicit = isBinary
				edges := vf.addEdges(previous, sMeta)
				if isBinary {
					next = append(next, edges...)
				} else {
					previous = edges
				}
			}
			if isBinary {
				previous = next
				next = nil
			}
		}
	}

	return previous
}
