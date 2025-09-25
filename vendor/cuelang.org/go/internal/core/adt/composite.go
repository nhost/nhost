// Copyright 2020 CUE Authors
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

package adt

import (
	"fmt"
	"slices"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// TODO: unanswered questions about structural cycles:
//
// 1. When detecting a structural cycle, should we consider this as:
//    a) an unevaluated value,
//    b) an incomplete error (which does not affect parent validity), or
//    c) a special value.
//
// Making it an error is the simplest way to ensure reentrancy is disallowed:
// without an error it would require an additional mechanism to stop reentrancy
// from continuing to process. Even worse, in some cases it may only partially
// evaluate, resulting in unexpected results. For this reason, we are taking
// approach `b` for now.
//
// This has some consequences of how disjunctions are treated though. Consider
//
//     list: {
//        head: _
//        tail: list | null
//     }
//
// When making it an error, evaluating the above will result in
//
//     list: {
//        head: _
//        tail: null
//     }
//
// because list will result in a structural cycle, and thus an error, it will be
// stripped from the disjunction. This may or may not be a desirable property. A
// nice thing is that it is not required to write `list | *null`. A disadvantage
// is that this is perhaps somewhat inexplicit.
//
// When not making it an error (and simply cease evaluating child arcs upon
// cycle detection), the result would be:
//
//     list: {
//        head: _
//        tail: list | null
//     }
//
// In other words, an evaluation would result in a cycle and thus an error.
// Implementations can recognize such cases by having unevaluated arcs. An
// explicit structure cycle marker would probably be less error prone.
//
// Note that in both cases, a reference to list will still use the original
// conjuncts, so the result will be the same for either method in this case.
//
//
// 2. Structural cycle allowance.
//
// Structural cycle detection disallows reentrancy as well. This means one
// cannot use structs for recursive computation. This will probably preclude
// evaluation of some configuration. Given that there is no real alternative
// yet, we could allow structural cycle detection to be optionally disabled.

// An Environment links the parent scopes for identifier lookup to a composite
// node. Each conjunct that make up node in the tree can be associated with
// a different environment (although some conjuncts may share an Environment).
type Environment struct {
	Up     *Environment
	Vertex *Vertex

	// DynamicLabel is only set when instantiating a field from a pattern
	// constraint. It is used to resolve label references.
	DynamicLabel Feature

	// TODO(perf): make the following public fields a shareable struct as it
	// mostly is going to be the same for child nodes.

	// TODO: This can probably move into the nodeContext, making it a map from
	// conjunct to Value.
	cache map[cacheKey]Value
}

type cacheKey struct {
	Expr Expr
	Arc  *Vertex
}

func (e *Environment) up(ctx *OpContext, count int32) *Environment {
	for i := int32(0); i < count; i++ {
		e = e.Up
		ctx.Assertf(ctx.Pos(), e.Vertex != nil, "Environment.up encountered a nil vertex")
	}
	return e
}

type ID int32

// evalCached is used to look up dynamic field pattern constraint expressions.
func (e *Environment) evalCached(c *OpContext, x Expr) Value {
	if v, ok := x.(Value); ok {
		return v
	}
	key := cacheKey{x, nil}
	v, ok := e.cache[key]
	if !ok {
		if e.cache == nil {
			e.cache = map[cacheKey]Value{}
		}
		env, src := c.e, c.src
		c.e, c.src = e, x.Source()
		// Save and restore errors to ensure that only relevant errors are
		// associated with the cash.
		err := c.errs
		v = c.evalState(x, require(partial, allKnown)) // TODO: should this be finalized?
		c.e, c.src = env, src
		c.errs = err
		if b, ok := v.(*Bottom); !ok || !b.IsIncomplete() {
			e.cache[key] = v
		}
	}
	return v
}

// A Vertex is a node in the value tree. It may be a leaf or internal node.
// It may have arcs to represent elements of a fully evaluated struct or list.
//
// For structs, it only contains definitions and concrete fields.
// optional fields are dropped.
//
// It maintains source information such as a list of conjuncts that contributed
// to the value.
type Vertex struct {
	// Parent links to a parent Vertex. This parent should only be used to
	// access the parent's Label field to find the relative location within a
	// tree.
	Parent *Vertex

	// State:
	//   eval: nil, BaseValue: nil -- unevaluated
	//   eval: *,   BaseValue: nil -- evaluating
	//   eval: *,   BaseValue: *   -- finalized
	//
	state *nodeContext

	// _cc manages the closedness logic for this Vertex. It is created
	// by rootCloseContext.
	// TODO: move back to nodeContext, but be sure not to clone it.
	_cc *closeContext

	// Label is the feature leading to this vertex.
	Label Feature

	// TODO: move the following fields to nodeContext.

	// status indicates the evaluation progress of this vertex.
	status vertexStatus

	// hasAllConjuncts indicates that the set of conjuncts is complete.
	// This is the case if the conjuncts of all its ancestors have been
	// processed.
	hasAllConjuncts bool

	// isData indicates that this Vertex is to be interpreted as data: pattern
	// and additional constraints, as well as optional fields, should be
	// ignored.
	isData bool

	// ClosedRecursive indicates whether this Vertex is recursively closed.
	// This is the case, for instance, if it is a node in a definition or if one
	// of the conjuncts, or ancestor conjuncts, is a definition.
	ClosedRecursive bool

	// ClosedNonRecursive indicates that this Vertex has been closed for this
	// level only. This supports the close builtin.
	ClosedNonRecursive bool

	// HasEllipsis indicates that this Vertex is open by means of an ellipsis.
	// TODO: combine this field with Closed once we removed the old evaluator.
	HasEllipsis bool

	// MultiLet indicates whether multiple let fields were added from
	// different sources. If true, a LetReference must be resolved using
	// the per-Environment value cache.
	MultiLet bool

	// After this is set, no more arcs may be added during evaluation. This is
	// set, for instance, after a Vertex is used as a source for comprehensions,
	// or any other operation that relies on the set of arcs being constant.
	LockArcs bool

	// IsDynamic signifies whether this struct is computed as part of an
	// expression and not part of the static evaluation tree.
	// Used for cycle detection.
	IsDynamic bool

	// IsPatternConstraint indicates that this Vertex is an entry in
	// Vertex.PatternConstraints.
	IsPatternConstraint bool

	// nonRooted indicates that this Vertex originates within the context of
	// a dynamic, or inlined, Vertex (e.g. `{out: ...}.out``). Note that,
	// through reappropriation, this Vertex may become rooted down the line.
	// Use the !IsDetached method to determine whether this Vertex became
	// rooted.
	nonRooted bool // indicates that there is no path from the root of the tree.

	// anonymous indicates that this Vertex is being computed within a
	// addressable context, or in other words, a context for which there is
	// a path from the root of the file. Typically, the only addressable
	// contexts are fields. Examples of fields that are not addressable are
	// the for source of comprehensions and let fields or let clauses.
	anonymous bool

	// hasPendingArc is set if this Vertex has a void arc (e.g. for comprehensions)
	hasPendingArc bool

	// IsDisjunct indicates this Vertex is a disjunct resulting from a
	// disjunction evaluation.
	IsDisjunct bool

	// IsShared is true if BaseValue holds a Vertex of a node of another path.
	// If a node is shared, the user should be careful with traversal.
	// The debug printer, for instance, takes extra care not to print in a loop.
	IsShared bool

	// IsCyclic is true if a node is cyclic, for instance if its value is
	// a cyclic reference to a shared node or if the value is a conjunction
	// of which at least one value is cyclic (not yet supported).
	IsCyclic bool

	// ArcType indicates the level of optionality of this arc.
	ArcType ArcType

	// cyclicReferences is a linked list of internal references pointing to this
	// Vertex. This is used to shorten the path of some structural cycles.
	cyclicReferences *RefNode

	// BaseValue is the value associated with this vertex. For lists and structs
	// this is a sentinel value indicating its kind.
	BaseValue BaseValue

	// ChildErrors is the collection of all errors of children.
	ChildErrors *Bottom

	// The parent of nodes can be followed to determine the path within the
	// configuration of this node.
	// Value  Value
	Arcs []*Vertex // arcs are sorted in display order.

	// PatternConstraints are additional constraints that match more nodes.
	// Constraints that match existing Arcs already have their conjuncts
	// mixed in.
	// TODO: either put in StructMarker/ListMarker or integrate with Arcs
	// so that this pointer is unnecessary.
	PatternConstraints *Constraints

	// Conjuncts lists the structs that ultimately formed this Composite value.
	// This includes all selected disjuncts.
	//
	// This value may be nil, in which case the Arcs are considered to define
	// the final value of this Vertex.
	//
	// TODO: all access to Conjuncts should go through functions like
	// VisitLeafConjuncts and VisitAllConjuncts. We should probably make this
	// an unexported field.
	Conjuncts []Conjunct

	// Structs is a slice of struct literals that contributed to this value.
	// This information is used to compute the topological sort of arcs.
	Structs []*StructInfo
}

func deref(v *Vertex) *Vertex {
	v = v.DerefValue()
	n := v.state
	if n != nil {
		v = n.underlying
	}
	if v == nil {
		panic("unexpected nil underlying with non-nil state")
	}
	return v
}

func equalDeref(a, b *Vertex) bool {
	return deref(a) == deref(b)
}

func (v *Vertex) cc() *closeContext {
	return v._cc
}

// rootCloseContext creates a closeContext for this Vertex or returns the
// existing one.
func (v *Vertex) rootCloseContext(ctx *OpContext) *closeContext {
	if v._cc == nil {
		v._cc = &closeContext{
			group:           (*ConjunctGroup)(&v.Conjuncts),
			parent:          nil,
			src:             v,
			parentConjuncts: v,
			decl:            v,
		}
		v._cc.incDependent(ctx, ROOT, nil) // matched in REF(decrement:nodeDone)
	}
	v._cc.origin = v._cc
	if p := v.Parent; p != nil {
		pcc := p.rootCloseContext(ctx)
		v._cc.origin = pcc.origin
	}

	return v._cc
}

// newInlineVertex creates a Vertex that is needed for computation, but for
// which there is no CUE path defined from the root Vertex.
func (ctx *OpContext) newInlineVertex(parent *Vertex, v BaseValue, a ...Conjunct) *Vertex {
	n := &Vertex{
		BaseValue: v,
		IsDynamic: true,
		ArcType:   ArcMember,
		Conjuncts: a,
	}
	if !ctx.isDevVersion() {
		n.Parent = parent
	}
	if ctx.inDetached > 0 {
		n.anonymous = true
	}
	return n

}

// updateArcType updates v.ArcType if t is more restrictive.
func (v *Vertex) updateArcType(t ArcType) {
	if t >= v.ArcType {
		return
	}
	if v.ArcType == ArcNotPresent {
		return
	}
	s := v.state
	// NOTE: this condition does not occur in V2.
	if s != nil && v.isFinal() {
		c := s.ctx
		if s.scheduler.frozen.meets(arcTypeKnown) {
			p := token.NoPos
			if src := c.Source(); src != nil {
				p = src.Pos()
			}
			parent := v.Parent
			parent.reportFieldCycleError(c, p, v.Label)
			return
		}
	}
	if v.Parent != nil && v.Parent.ArcType == ArcPending && v.Parent.state != nil && v.Parent.state.ctx.isDevVersion() {
		// TODO: check that state is always non-nil.
		v.Parent.state.unshare()
	}
	v.ArcType = t
}

// isDefined indicates whether this arc is a "value" field, and not a constraint
// or void arc.
func (v *Vertex) isDefined() bool {
	return v.ArcType == ArcMember
}

// IsConstraint reports whether the Vertex is an optional or required field.
func (v *Vertex) IsConstraint() bool {
	return v.ArcType == ArcOptional || v.ArcType == ArcRequired
}

// IsDefined indicates whether this arc is defined meaning it is not a
// required or optional constraint and not a "void" arc.
// It will evaluate the arc, and thus evaluate any comprehension, to make this
// determination.
func (v *Vertex) IsDefined(c *OpContext) bool {
	if v.isDefined() {
		return true
	}
	v.Finalize(c)
	return v.isDefined()
}

// Rooted reports if it is known there is a path from the root of the tree to
// this Vertex. If this returns false, it may still be rooted if the node
// originated from an inline struct, but was later reappropriated.
func (v *Vertex) Rooted() bool {
	return !v.nonRooted && !v.Label.IsLet() && !v.IsDynamic
}

// IsDetached reports whether this Vertex does not have a path from the root.
func (v *Vertex) IsDetached() bool {
	// v might have resulted from an inline struct that was subsequently shared.
	// In this case, it is still rooted.
	for ; v != nil; v = v.Parent {
		if v.Rooted() {
			return false
		}
	}

	return true
}

// MayAttach reports whether this Vertex may attach to another arc.
// The behavior is undefined if IsDetached is true.
func (v *Vertex) MayAttach() bool {
	return !v.Label.IsLet() && !v.anonymous
}

type ArcType uint8

const (
	// ArcMember means that this arc is a normal non-optional field
	// (including regular, hidden, and definition fields).
	ArcMember ArcType = iota

	// ArcRequired is like optional, but requires that a field be specified.
	// Fields are of the form foo!.
	ArcRequired

	// ArcOptional represents fields of the form foo? and defines constraints
	// for foo in case it is defined.
	ArcOptional

	// ArcPending means that it is not known yet whether an arc exists and that
	// its conjuncts need to be processed to find out. This happens when an arc
	// is provisionally added as part of a comprehension, but when this
	// comprehension has not yet yielded any results.
	ArcPending

	// ArcNotPresent indicates that this arc is not present and, unlike
	// ArcPending, needs no further processing.
	ArcNotPresent

	// TODO: define a type for optional arcs. This will be needed for pulling
	// in optional fields into the Vertex, which, in turn, is needed for
	// structure sharing, among other things.
	// We could also define types for required fields and potentially lets.
)

func (a ArcType) String() string {
	switch a {
	case ArcMember:
		return "Member"
	case ArcOptional:
		return "Optional"
	case ArcRequired:
		return "Required"
	case ArcPending:
		return "Pending"
	case ArcNotPresent:
		return "NotPresent"
	}
	return fmt.Sprintf("ArcType(%d)", a)
}

// definitelyExists reports whether an arc is a constraint or member arc.
// TODO: we should check that users of this call ensure there are no
// ArcPendings.
func (v *Vertex) definitelyExists() bool {
	return v.ArcType < ArcPending
}

// ConstraintFromToken converts a given AST constraint token to the
// corresponding ArcType.
func ConstraintFromToken(t token.Token) ArcType {
	switch t {
	case token.OPTION:
		return ArcOptional
	case token.NOT:
		return ArcRequired
	}
	return ArcMember
}

// Token reports the token corresponding to the constraint represented by a,
// or token.ILLEGAL otherwise.
func (a ArcType) Token() (t token.Token) {
	switch a {
	case ArcOptional:
		t = token.OPTION
	case ArcRequired:
		t = token.NOT
	}
	return t
}

// Suffix reports the field suffix for the given ArcType if it is a
// constraint or the empty string otherwise.
func (a ArcType) Suffix() string {
	switch a {
	case ArcOptional:
		return "?"
	case ArcRequired:
		return "!"

	// For debugging internal state. This is not CUE syntax.
	case ArcPending:
		return "*"
	case ArcNotPresent:
		return "-"
	}
	return ""
}

func (v *Vertex) Clone() *Vertex {
	c := *v
	c.state = nil
	return &c
}

type StructInfo struct {
	*StructLit

	Env *Environment

	CloseInfo

	// Embed indicates the struct in which this struct is embedded (originally),
	// or nil if this is a root structure.
	// Embed   *StructInfo
	// Context *RefInfo // the location from which this struct originates.
	Disable bool

	Embedding bool

	// Decl contains this Struct
	Decl Decl
}

// TODO(perf): this could be much more aggressive for eliminating structs that
// are immaterial for closing.
func (s *StructInfo) useForAccept() bool {
	if c := s.closeInfo; c != nil {
		return !c.noCheck
	}
	return true
}

// vertexStatus indicates the evaluation progress of a Vertex.
type vertexStatus int8

//go:generate go run golang.org/x/tools/cmd/stringer -type=vertexStatus

const (
	// unprocessed indicates a Vertex has not been processed before.
	// Value must be nil.
	unprocessed vertexStatus = iota

	// evaluating means that the current Vertex is being evaluated. If this is
	// encountered it indicates a reference cycle. Value must be nil.
	evaluating

	// partial indicates that the result was only partially evaluated. It will
	// need to be fully evaluated to get a complete results.
	//
	// TODO: this currently requires a renewed computation. Cache the
	// nodeContext to allow reusing the computations done so far.
	partial

	// conjuncts is the state reached when all conjuncts have been evaluated,
	// but without recursively processing arcs.
	conjuncts

	// evaluatingArcs indicates that the arcs of the Vertex are currently being
	// evaluated. If this is encountered it indicates a structural cycle.
	// Value does not have to be nil
	evaluatingArcs

	// finalized means that this node is fully evaluated and that the results
	// are save to use without further consideration.
	finalized
)

// Wrap creates a Vertex that takes w as a shared value. This allows users
// to set different flags for a wrapped Vertex.
func (c *OpContext) Wrap(v *Vertex, id CloseInfo) *Vertex {
	w := c.newInlineVertex(nil, nil, v.Conjuncts...)
	n := w.getState(c)
	n.share(makeAnonymousConjunct(nil, v, nil), v, CloseInfo{})
	return w
}

// Status returns the status of the current node. When reading the status, one
// should always use this method over directly reading status field.
//
// NOTE: this only matters for EvalV3 and beyonds, so a lot of the old code
// might still access it directly.
func (v *Vertex) Status() vertexStatus {
	v = v.DerefValue()
	return v.status
}

// ForceDone prevents v from being evaluated.
func (v *Vertex) ForceDone() {
	v.updateStatus(finalized)
}

// IsUnprocessed reports whether v is unprocessed.
func (v *Vertex) IsUnprocessed() bool {
	return v.Status() == unprocessed
}

func (v *Vertex) updateStatus(s vertexStatus) {
	if !isCyclePlaceholder(v.BaseValue) {
		if !v.IsErr() && v.state != nil {
			Assertf(v.state.ctx, v.Status() <= s+1, "attempt to regress status from %d to %d", v.Status(), s)
		}
	}

	if s == finalized && v.BaseValue == nil {
		// TODO: for debugging.
		// panic("not finalized")
	}
	v.status = s
}

// setParentDone signals v that the conjuncts of all ancestors have been
// processed.
// If all conjuncts of this node have been set, all arcs will be notified
// of this parent being done.
//
// Note: once a vertex has started evaluation (state != nil), insertField will
// cause all conjuncts to be immediately processed. This means that if all
// ancestors of this node processed their conjuncts, and if this node has
// processed all its conjuncts as well, all nodes that it embedded will have
// received all their conjuncts as well, after which this node will have been
// notified of these conjuncts.
func (v *Vertex) setParentDone() {
	v.hasAllConjuncts = true
	// Could set "Conjuncts" flag of arc at this point.
	if n := v.state; n != nil && len(n.conjuncts) == n.conjunctsPos {
		for _, a := range v.Arcs {
			a.setParentDone()
		}
	}
}

// VisitLeafConjuncts visits all conjuncts that are leafs of the ConjunctGroup tree.
func (v *Vertex) VisitLeafConjuncts(f func(Conjunct) bool) {
	VisitConjuncts(v.Conjuncts, f)
}

func VisitConjuncts(a []Conjunct, f func(Conjunct) bool) bool {
	for _, c := range a {
		switch x := c.x.(type) {
		case *ConjunctGroup:
			if !VisitConjuncts(*x, f) {
				return false
			}
		default:
			if !f(c) {
				return false
			}
		}
	}
	return true
}

// VisitAllConjuncts visits all conjuncts of v, including ConjunctGroups.
// Note that ConjunctGroups do not have an Environment associated with them.
func (v *Vertex) VisitAllConjuncts(f func(c Conjunct, isLeaf bool)) {
	visitAllConjuncts(v.Conjuncts, f)
}

func visitAllConjuncts(a []Conjunct, f func(c Conjunct, isLeaf bool)) {
	for _, c := range a {
		switch x := c.x.(type) {
		case *ConjunctGroup:
			f(c, false)
			visitAllConjuncts(*x, f)
		default:
			f(c, true)
		}
	}
}

// HasConjuncts reports whether v has any conjuncts.
func (v *Vertex) HasConjuncts() bool {
	return len(v.Conjuncts) > 0
}

// SingleConjunct reports whether there is a single leaf conjunct and returns 1
// if so. It will return 0 if there are no conjuncts or 2 if there are more than
// 1.
//
// This is an often-used operation.
func (v *Vertex) SingleConjunct() (c Conjunct, count int) {
	if v == nil {
		return c, 0
	}
	v.VisitLeafConjuncts(func(x Conjunct) bool {
		c = x
		if count++; count > 1 {
			return false
		}
		return true
	})

	return c, count
}

// ConjunctAt assumes a Vertex represents a top-level Vertex, such as one
// representing a file or a let expressions, where all conjuncts appear at the
// top level. It may panic if this condition is not met.
func (v *Vertex) ConjunctAt(i int) Conjunct {
	return v.Conjuncts[i]
}

// Value returns the Value of v without definitions if it is a scalar
// or itself otherwise.
func (v *Vertex) Value() Value {
	switch x := v.BaseValue.(type) {
	case nil:
		return nil
	case *StructMarker, *ListMarker:
		return v
	case Value:
		// TODO: recursively descend into Vertex?
		return x
	default:
		panic(fmt.Sprintf("unexpected type %T", v.BaseValue))
	}
}

// isUndefined reports whether a vertex does not have a useable BaseValue yet.
func (v *Vertex) isUndefined() bool {
	if !v.isDefined() {
		return true
	}
	switch v.BaseValue {
	case nil, cycle:
		return true
	}
	return false
}

// isFinal reports whether this node may no longer be modified.
func (v *Vertex) isFinal() bool {
	// TODO(deref): the accounting of what is final should be recorded
	// in the original node. Remove this dereference once the old
	// evaluator has been removed.
	return v.Status() == finalized
}

func (x *Vertex) IsConcrete() bool {
	return x.Concreteness() <= Concrete
}

// IsData reports whether v should be interpreted in data mode. In other words,
// it tells whether optional field matching and non-regular fields, like
// definitions and hidden fields, should be ignored.
func (v *Vertex) IsData() bool {
	return v.isData || !v.HasConjuncts()
}

// ToDataSingle creates a new Vertex that represents just the regular fields
// of this vertex. Arcs are left untouched.
// It is used by cue.Eval to convert nodes to data on per-node basis.
func (v *Vertex) ToDataSingle() *Vertex {
	w := *v
	w.isData = true
	w.state = nil
	w.status = finalized
	return &w
}

// ToDataAll returns a new v where v and all its descendents contain only
// the regular fields.
func (v *Vertex) ToDataAll(ctx *OpContext) *Vertex {
	v.Finalize(ctx)

	arcs := make([]*Vertex, 0, len(v.Arcs))
	for _, a := range v.Arcs {
		if !a.IsDefined(ctx) {
			continue
		}
		if a.Label.IsRegular() {
			arcs = append(arcs, a.ToDataAll(ctx))
		}
	}
	w := *v
	w.state = nil
	w.status = finalized

	w.BaseValue = toDataAll(ctx, w.BaseValue)
	w.Arcs = arcs
	w.isData = true
	w.Conjuncts = slices.Clone(v.Conjuncts)
	// TODO(perf): this is not strictly necessary for evaluation, but it can
	// hurt performance greatly. Drawback is that it may disable ordering.
	for _, s := range w.Structs {
		s.Disable = true
	}
	for i, c := range w.Conjuncts {
		if v, _ := c.x.(Value); v != nil {
			w.Conjuncts[i].x = toDataAll(ctx, v).(Value)
		}
	}
	return &w
}

func toDataAll(ctx *OpContext, v BaseValue) BaseValue {
	switch x := v.(type) {
	default:
		return x

	case *Vertex:
		return x.ToDataAll(ctx)

	case *Disjunction:
		d := *x
		values := x.Values
		// Data mode involves taking default values and if there is an
		// unambiguous default value, we should convert that to data as well.
		switch x.NumDefaults {
		case 0:
		case 1:
			return toDataAll(ctx, values[0])
		default:
			values = values[:x.NumDefaults]
		}
		d.Values = make([]Value, len(values))
		for i, v := range values {
			switch x := v.(type) {
			case *Vertex:
				d.Values[i] = x.ToDataAll(ctx)
			default:
				d.Values[i] = x
			}
		}
		return &d

	case *Conjunction:
		c := *x
		c.Values = make([]Value, len(x.Values))
		for i, v := range x.Values {
			// This case is okay because the source is of type Value.
			c.Values[i] = toDataAll(ctx, v).(Value)
		}
		return &c
	}
}

// func (v *Vertex) IsEvaluating() bool {
// 	return v.Value == cycle
// }

// IsErr is a convenience function to check whether a Vertex represents an
// error currently. It does not finalize the value, so it is possible that
// v may become erroneous after this call.
func (v *Vertex) IsErr() bool {
	// if v.Status() > Evaluating {
	return v.Bottom() != nil
}

// Err finalizes v, if it isn't yet, and returns an error if v evaluates to an
// error or nil otherwise.
func (v *Vertex) Err(c *OpContext) *Bottom {
	v.Finalize(c)
	return v.Bottom()
}

// Bottom reports whether v is currently erroneous It does not finalize the
// value, so it is possible that v may become erroneous after this call.
func (v *Vertex) Bottom() *Bottom {
	// TODO: should we consider errors recorded in the state?
	v = v.DerefValue()
	if b, ok := v.BaseValue.(*Bottom); ok {
		return b
	}
	return nil
}

// func (v *Vertex) Evaluate()

func (v *Vertex) Finalize(c *OpContext) {
	// Saving and restoring the error context prevents v from panicking in
	// case the caller did not handle existing errors in the context.
	err := c.errs
	c.errs = nil
	c.unify(v, final(finalized, allKnown))
	c.errs = err
}

// CompleteArcs ensures the set of arcs has been computed.
func (v *Vertex) CompleteArcs(c *OpContext) {
	c.unify(v, final(conjuncts, allKnown))
}

func (v *Vertex) CompleteArcsOnly(c *OpContext) {
	c.unify(v, final(conjuncts, fieldSetKnown))
}

func (v *Vertex) AddErr(ctx *OpContext, b *Bottom) {
	v.SetValue(ctx, CombineErrors(nil, v.Value(), b))
}

// SetValue sets the value of a node.
func (v *Vertex) SetValue(ctx *OpContext, value BaseValue) *Bottom {
	return v.setValue(ctx, finalized, value)
}

func (v *Vertex) setValue(ctx *OpContext, state vertexStatus, value BaseValue) *Bottom {
	v.BaseValue = value
	// TODO: should not set status here for new evaluator.
	v.updateStatus(state)
	return nil
}

func (n *nodeContext) setBaseValue(value BaseValue) {
	n.node.BaseValue = value
}

// swapBaseValue swaps the BaseValue of a node with the given value and returns
// the previous value.
func (n *nodeContext) swapBaseValue(value BaseValue) (saved BaseValue) {
	saved = n.node.BaseValue
	n.setBaseValue(value)
	return saved
}

// ToVertex wraps v in a new Vertex, if necessary.
func ToVertex(v Value) *Vertex {
	switch x := v.(type) {
	case *Vertex:
		return x
	default:
		n := &Vertex{
			status:    finalized,
			BaseValue: x,
		}
		n.AddConjunct(MakeRootConjunct(nil, v))
		return n
	}
}

// Unwrap returns the possibly non-concrete scalar value of v, v itself for
// lists and structs, or nil if v is an undefined type.
func Unwrap(v Value) Value {
	x, ok := v.(*Vertex)
	if !ok {
		return v
	}
	// TODO(deref): BaseValue is currently overloaded to track cycles as well
	// as the actual or dereferenced value. Once the old evaluator can be
	// removed, we should use the new cycle tracking mechanism for cycle
	// detection and keep BaseValue clean.
	x = x.DerefValue()
	if n := x.state; n != nil && isCyclePlaceholder(x.BaseValue) {
		if n.errs != nil && !n.errs.IsIncomplete() {
			return n.errs
		}
		if n.scalar != nil {
			return n.scalar
		}
	}
	return x.Value()
}

// OptionalType is a bit field of the type of optional constraints in use by an
// Acceptor.
type OptionalType int8

const (
	HasField          OptionalType = 1 << iota // X: T
	HasDynamic                                 // (X): T or "\(X)": T
	HasPattern                                 // [X]: T
	HasComplexPattern                          // anything but a basic type
	HasAdditional                              // ...T
	IsOpen                                     // Defined for all fields
)

func (v *Vertex) Kind() Kind {
	// This is possible when evaluating comprehensions. It is potentially
	// not known at this time what the type is.
	switch {
	case v.state != nil && v.state.kind == BottomKind:
		return BottomKind
	case v.BaseValue != nil && !isCyclePlaceholder(v.BaseValue):
		return v.BaseValue.Kind()
	case v.state != nil:
		return v.state.kind
	default:
		return TopKind
	}
}

func (v *Vertex) OptionalTypes() OptionalType {
	var mask OptionalType
	for _, s := range v.Structs {
		mask |= s.OptionalTypes()
	}
	return mask
}

// IsOptional reports whether a field is explicitly defined as optional,
// as opposed to whether it is allowed by a pattern constraint.
func (v *Vertex) IsOptional(label Feature) bool {
	for _, a := range v.Arcs {
		if a.Label == label {
			return a.IsConstraint()
		}
	}
	return false
}

func (v *Vertex) accepts(ok, required bool) bool {
	return ok || (!required && !v.ClosedRecursive)
}

func (v *Vertex) IsClosedStruct() bool {
	// TODO: uncomment this. This fixes a bunch of closedness bugs
	// in the old and new evaluator. For compability sake, though, we
	// keep it as is for now.
	// if v.Closed {
	// 	return true
	// }
	// if v.HasEllipsis {
	// 	return false
	// }
	switch x := v.BaseValue.(type) {
	default:
		return false

	case *Vertex:
		return v.ClosedRecursive && !v.HasEllipsis

	case *StructMarker:
		if x.NeedClose {
			return true
		}

	case *Disjunction:
	}
	return isClosed(v)
}

func (v *Vertex) IsClosedList() bool {
	if x, ok := v.BaseValue.(*ListMarker); ok {
		return !x.IsOpen
	}
	return false
}

// TODO: return error instead of boolean? (or at least have version that does.)
func (v *Vertex) Accept(ctx *OpContext, f Feature) bool {
	// TODO(#543): remove this check.
	if f.IsDef() {
		return true
	}

	if f.IsHidden() || f.IsLet() {
		return true
	}

	// TODO(deref): right now a dereferenced value holds all the necessary
	// closedness information. In the future we may want to allow sharing nodes
	// with different closedness information. In that case, we should reconsider
	// the use of this dereference. Consider, for instance:
	//
	//     #a: b     // this node is currently not shared, but could be.
	//     b: {c: 1}
	v = v.DerefValue()
	if x, ok := v.BaseValue.(*Disjunction); ok {
		for _, v := range x.Values {
			if x, ok := v.(*Vertex); ok && x.Accept(ctx, f) {
				return true
			}
		}
		return false
	}

	if f.IsInt() {
		switch v.BaseValue.(type) {
		case *ListMarker:
			// TODO(perf): use precomputed length.
			if f.Index() < len(v.Elems()) {
				return true
			}
			return !v.IsClosedList()

		default:
			return v.Kind()&ListKind != 0
		}
	}

	if k := v.Kind(); k&StructKind == 0 && f.IsString() {
		// If the value is bottom, we may not really know if this used to
		// be a struct.
		if k != BottomKind || len(v.Structs) == 0 {
			return false
		}
	}

	// TODO: move this check to IsClosedStruct. Right now this causes too many
	// changes in the debug output, and it also appears to be not entirely
	// correct.
	if v.HasEllipsis {
		return true

	}

	if !v.IsClosedStruct() || v.Lookup(f) != nil {
		return true
	}

	// TODO(perf): collect positions in error.
	defer ctx.ReleasePositions(ctx.MarkPositions())

	return v.accepts(Accept(ctx, v, f))
}

// MatchAndInsert finds the conjuncts for optional fields, pattern
// constraints, and additional constraints that match f and inserts them in
// arc. Use f is 0 to match all additional constraints only.
func (v *Vertex) MatchAndInsert(ctx *OpContext, arc *Vertex) {
	if !v.Accept(ctx, arc.Label) {
		return
	}

	// Go backwards to simulate old implementation.
	for i := len(v.Structs) - 1; i >= 0; i-- {
		s := v.Structs[i]
		if s.Disable {
			continue
		}
		s.MatchAndInsert(ctx, arc)
	}

	// This is the equivalent for the new implementation.
	if pcs := v.PatternConstraints; pcs != nil {
		for _, pc := range pcs.Pairs {
			if matchPattern(ctx, pc.Pattern, arc.Label) {
				for _, c := range pc.Constraint.Conjuncts {
					env := *(c.Env)
					if arc.Label.Index() < MaxIndex {
						env.DynamicLabel = arc.Label
					}
					c.Env = &env

					root := arc.rootCloseContext(ctx)
					root.insertConjunct(ctx, root, c, c.CloseInfo, ArcMember, true, false)
				}
			}
		}
	}
}

func (v *Vertex) IsList() bool {
	_, ok := v.BaseValue.(*ListMarker)
	return ok
}

// Lookup returns the Arc with label f if it exists or nil otherwise.
func (v *Vertex) Lookup(f Feature) *Vertex {
	for _, a := range v.Arcs {
		if a.Label == f {
			// TODO(P1)/TODO(deref): this indirection should ultimately be
			// eliminated: the original node may have useful information (like
			// original conjuncts) that are eliminated after indirection. We
			// should leave it up to the user of Lookup at what point an
			// indirection is necessary.
			a = a.DerefValue()
			return a
		}
	}
	return nil
}

// LookupRaw returns the Arc with label f if it exists or nil otherwise.
//
// TODO: with the introduction of structure sharing, it is not always correct
// to indirect the arc. At the very least, this discards potential useful
// information. We introduce LookupRaw to avoid having to delete the
// information. Ultimately, this should become Lookup, or better, we should
// have a higher-level API for accessing values.
func (v *Vertex) LookupRaw(f Feature) *Vertex {
	for _, a := range v.Arcs {
		if a.Label == f {
			return a
		}
	}
	return nil
}

// Elems returns the regular elements of a list.
func (v *Vertex) Elems() []*Vertex {
	// TODO: add bookkeeping for where list arcs start and end.
	a := make([]*Vertex, 0, len(v.Arcs))
	for _, x := range v.Arcs {
		if x.Label.IsInt() {
			a = append(a, x)
		}
	}
	return a
}

func (v *Vertex) Init(c *OpContext) {
	v.getState(c)
}

// GetArc returns a Vertex for the outgoing arc with label f. It creates and
// ads one if it doesn't yet exist.
func (v *Vertex) GetArc(c *OpContext, f Feature, t ArcType) (arc *Vertex, isNew bool) {
	arc = v.Lookup(f)
	if arc != nil {
		arc.updateArcType(t)
		return arc, false
	}

	if c.isDevVersion() {
		return nil, false
	}

	if v.LockArcs {
		// TODO(errors): add positions.
		if f.IsInt() {
			c.addErrf(EvalError, token.NoPos,
				"element at index %v not allowed by earlier comprehension or reference cycle", f)
		} else {
			c.addErrf(EvalError, token.NoPos,
				"field %v not allowed by earlier comprehension or reference cycle", f)
		}
	}
	// TODO: consider setting Dynamic here from parent.
	arc = &Vertex{
		Parent:    v,
		Label:     f,
		ArcType:   t,
		nonRooted: v.IsDynamic || v.Label.IsLet() || v.nonRooted,
		anonymous: v.anonymous || v.Label.IsLet(),
	}
	v.Arcs = append(v.Arcs, arc)
	if t == ArcPending {
		v.hasPendingArc = true
	}
	return arc, true
}

func (v *Vertex) Source() ast.Node {
	if v != nil {
		if b, ok := v.BaseValue.(Value); ok {
			return b.Source()
		}
	}
	return nil
}

// InsertConjunct is a low-level method to insert a conjunct into a Vertex.
// It should only be used by the compiler. It does not consider any logic
// that is necessary if a conjunct is added to a Vertex that is already being
// evaluated.
func (v *Vertex) InsertConjunct(c Conjunct) {
	v.Conjuncts = append(v.Conjuncts, c)
}

// InsertConjunctsFrom is a low-level method to insert a conjuncts into a Vertex
// from another Vertex.
func (v *Vertex) InsertConjunctsFrom(w *Vertex) {
	v.Conjuncts = append(v.Conjuncts, w.Conjuncts...)
}

// AddConjunct adds the given Conjuncts to v if it doesn't already exist.
func (v *Vertex) AddConjunct(c Conjunct) *Bottom {
	if v.BaseValue != nil && !isCyclePlaceholder(v.BaseValue) {
		// TODO: investigate why this happens at all. Removing it seems to
		// change the order of fields in some cases.
		//
		// This is likely a bug in the evaluator and should not happen.
		return &Bottom{
			Err:  errors.Newf(token.NoPos, "cannot add conjunct"),
			Node: v,
		}
	}
	if !v.hasConjunct(c) {
		v.addConjunctUnchecked(c)
	}
	return nil
}

func (v *Vertex) hasConjunct(c Conjunct) (added bool) {
	switch f := c.x.(type) {
	case *BulkOptionalField, *Ellipsis:
	case *Field:
		v.updateArcType(f.ArcType)
	case *DynamicField:
		v.updateArcType(f.ArcType)
	default:
		v.ArcType = ArcMember
	}
	return hasConjunct(v.Conjuncts, c)
}

func hasConjunct(cs []Conjunct, c Conjunct) bool {
	for _, x := range cs {
		// TODO: disregard certain fields from comparison (e.g. Refs)?
		if x.CloseInfo.closeInfo == c.CloseInfo.closeInfo &&
			x.x == c.x &&
			x.Env.Up == c.Env.Up && x.Env.Vertex == c.Env.Vertex {
			return true
		}
	}
	return false
}

func (n *nodeContext) addConjunction(c Conjunct, index int) {
	unreachableForDev(n.ctx)

	// NOTE: This does not split binary expressions for comprehensions.
	// TODO: split for comprehensions and rewrap?
	if x, ok := c.Elem().(*BinaryExpr); ok && x.Op == AndOp {
		c.x = x.X
		n.conjuncts = append(n.conjuncts, conjunct{C: c, index: index})
		c.x = x.Y
		n.conjuncts = append(n.conjuncts, conjunct{C: c, index: index})
	} else {
		n.conjuncts = append(n.conjuncts, conjunct{C: c, index: index})
	}
}

func (v *Vertex) addConjunctUnchecked(c Conjunct) {
	index := len(v.Conjuncts)
	v.Conjuncts = append(v.Conjuncts, c)
	if n := v.state; n != nil && !n.ctx.isDevVersion() {
		// TODO(notify): consider this as a central place to send out
		// notifications. At the moment this is not necessary, but it may
		// be if we move the notification mechanism outside of the path of
		// running tasks.
		n.addConjunction(c, index)

		// TODO: can we remove notifyConjunct here? This method is only
		// used if either Unprocessed is 0, in which case there will be no
		// notification recipients, or for "pushed down" comprehensions,
		// which should also have been added at an earlier point.
		n.notifyConjunct(c)
	}
}

// addConjunctDynamic adds a conjunct to a vertex and immediately evaluates
// it, whilst doing the same for any vertices on the notify list, recursively.
func (n *nodeContext) addConjunctDynamic(c Conjunct) {
	unreachableForDev(n.ctx)

	n.node.Conjuncts = append(n.node.Conjuncts, c)
	n.addExprConjunct(c, partial)
	n.notifyConjunct(c)

}

func (n *nodeContext) notifyConjunct(c Conjunct) {
	unreachableForDev(n.ctx)

	for _, rec := range n.notify {
		arc := rec.v
		if !arc.hasConjunct(c) {
			if arc.state == nil {
				// TODO: continuing here is likely to result in a faulty
				// (incomplete) configuration. But this may be okay. The
				// CUE_DEBUG=0 flag disables this assertion.
				n.ctx.Assertf(n.ctx.pos(), !n.ctx.Strict, "unexpected nil state")
				n.ctx.addErrf(0, n.ctx.pos(), "cannot add to field %v", arc.Label)
				continue
			}
			arc.state.addConjunctDynamic(c)
		}
	}
}

func (v *Vertex) AddStruct(s *StructLit, env *Environment, ci CloseInfo) *StructInfo {
	info := StructInfo{
		StructLit: s,
		Env:       env,
		CloseInfo: ci,
	}
	if env.Vertex != nil {
		// be careful to avoid promotion of nil env.Vertex to non-nil
		// info.Decl
		info.Decl = env.Vertex
	}
	if cc := ci.cc; cc != nil && cc.decl != nil {
		info.Decl = cc.decl
	} else if decl := ci.closeInfo.Decl(); decl != nil {
		info.Decl = decl
	}
	for _, t := range v.Structs {
		if *t == info { // TODO: check for different identity.
			return t
		}
	}
	t := &info
	v.Structs = append(v.Structs, t)
	return t
}

// Path computes the sequence of Features leading from the root to of the
// instance to this Vertex.
//
// NOTE: this is for debugging purposes only.
func (v *Vertex) Path() []Feature {
	return appendPath(nil, v)
}

func appendPath(a []Feature, v *Vertex) []Feature {
	if v.Parent == nil {
		return a
	}
	a = appendPath(a, v.Parent)
	if v.Label != 0 {
		// A Label may be 0 for programmatically inserted nodes.
		a = append(a, v.Label)
	}
	return a
}

// A Conjunct is an Environment-Expr pair. The Environment is the starting
// point for reference lookup for any reference contained in X.
type Conjunct struct {
	Env *Environment
	x   Node

	// CloseInfo is a unique number that tracks a group of conjuncts that need
	// belong to a single originating definition.
	CloseInfo CloseInfo
}

// MakeConjunct creates a conjunct from current Environment and CloseInfo of c.
func (c *OpContext) MakeConjunct(x Expr) Conjunct {
	return MakeConjunct(c.e, x, c.ci)
}

// TODO(perf): replace with composite literal if this helps performance.

// MakeRootConjunct creates a conjunct from the given environment and node.
// It panics if x cannot be used as an expression.
func MakeRootConjunct(env *Environment, x Node) Conjunct {
	return MakeConjunct(env, x, CloseInfo{})
}

func MakeConjunct(env *Environment, x Node, id CloseInfo) Conjunct {
	if env == nil {
		// TODO: better is to pass one.
		env = &Environment{}
	}
	switch x.(type) {
	case Elem, interface{ expr() Expr }:
	default:
		panic(fmt.Sprintf("invalid Node type %T", x))
	}
	return Conjunct{env, x, id}
}

func (c *Conjunct) Source() ast.Node {
	return c.x.Source()
}

func (c *Conjunct) Field() Node {
	switch x := c.x.(type) {
	case *Comprehension:
		return x.Value
	default:
		return c.x
	}
}

// Elem retrieves the Elem form of the contained conjunct.
// If it is a Field, it will return the field value.
func (c Conjunct) Elem() Elem {
	switch x := c.x.(type) {
	case interface{ expr() Expr }:
		return x.expr()
	case Elem:
		return x
	default:
		panic("unreachable")
	}
}

// Expr retrieves the expression form of the contained conjunct. If it is a
// field or comprehension, it will return its associated value. This is only to
// be used for syntactic operations where evaluation of the expression is not
// required. To get an expression paired with the correct environment, use
// EnvExpr.
//
// TODO: rename to RawExpr.
func (c *Conjunct) Expr() Expr {
	return ToExpr(c.x)
}

// EnvExpr returns the expression form of the contained conjunct alongside an
// Environment in which this expression should be evaluated.
func (c Conjunct) EnvExpr() (*Environment, Expr) {
	return EnvExpr(c.Env, c.Elem())
}

// EnvExpr returns the expression represented by Elem alongside an Environment
// with the necessary adjustments in which the resulting expression can be
// evaluated.
func EnvExpr(env *Environment, elem Elem) (*Environment, Expr) {
	for {
		switch x := elem.(type) {
		case *ConjunctGroup:
			if len(*x) == 1 {
				c := (*x)[0]
				env = c.Env
				elem = c.Elem()
				continue
			}
		case *Comprehension:
			env = linkChildren(env, x)
			c := MakeConjunct(env, x.Value, CloseInfo{})
			elem = c.Elem()
			continue
		}
		break
	}
	return env, ToExpr(elem)
}

// ToExpr extracts the underlying expression for a Node. If something is already
// an Expr, it will return it as is, if it is a field, it will return its value,
// and for comprehensions it returns the yielded struct.
func ToExpr(n Node) Expr {
	for {
		switch x := n.(type) {
		case *ConjunctGroup:
			if len(*x) != 1 {
				return x
			}
			n = (*x)[0].x
		case Expr:
			return x
		case interface{ expr() Expr }:
			n = x.expr()
		case *Comprehension:
			n = x.Value
		default:
			panic("unreachable")
		}
	}
}
