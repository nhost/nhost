// Copyright 2023 CUE Authors
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

// This file contains functionality for pattern constraints.

// Constraints keeps track of pattern constraints and the set of allowed
// fields.
type Constraints struct {
	// Pairs lists Pattern-Constraint pairs.
	Pairs []PatternConstraint // TODO(perf): move to Arcs?

	// Allowed is a Value that defines the set of all allowed fields.
	// To check if a field is allowed, its correpsonding CUE value can be
	// unified with this value.
	Allowed Value
}

// A PatternConstraint represents a single
//
//	[pattern]: T.
//
// The Vertex holds a list of conjuncts to represent the constraints. We use
// a Vertex so that these can be evaluated and compared for equality.
// Unlike for regular Vertex values, CloseInfo.closeContext is set for
// constraints: it is needed when matching subfields to ensure that conjuncts
// get inserted into the proper groups.
type PatternConstraint struct {
	Pattern    Value
	Constraint *Vertex
}

// insertListEllipsis inserts the given list ellipsis as a pattern constraint on
// n, applying it to all elements at indexes >= offset.
func (n *nodeContext) insertListEllipsis(offset int, ellipsis Conjunct) {
	ctx := n.ctx

	var p Value
	if offset == 0 {
		p = &BasicType{
			Src: ellipsis.Field().Source(),
			K:   IntKind,
		}
	} else {
		p = &BoundValue{
			Src:   nil, // TODO: field source.
			Op:    GreaterEqualOp,
			Value: ctx.NewInt64(int64(offset)),
		}
	}
	n.insertConstraint(p, ellipsis)
}

// insertConstraint ensures a given pattern constraint is present in the
// constraints of n and reports whether the pair was added newly.
//
// The given conjunct must have a closeContext associated with it. This ensures
// that different pattern constraints pairs originating from the same
// closeContext will be collated properly in fields to which these constraints
// are applied.
func (n *nodeContext) insertConstraint(pattern Value, c Conjunct) bool {
	if c.CloseInfo.cc == nil {
		panic("constraint conjunct must have closeContext associated with it")
	}

	ctx := n.ctx
	v := n.node

	pcs := v.PatternConstraints
	if pcs == nil {
		pcs = &Constraints{}
		v.PatternConstraints = pcs
	}

	var constraint *Vertex
	for _, pc := range pcs.Pairs {
		if Equal(ctx, pc.Pattern, pattern, 0) {
			constraint = pc.Constraint
			break
		}
	}

	if constraint == nil {
		constraint = &Vertex{
			// See "Self-referencing patterns" in cycle.go
			IsPatternConstraint: true,
		}
		pcs.Pairs = append(pcs.Pairs, PatternConstraint{
			Pattern:    pattern,
			Constraint: constraint,
		})
	} else if constraint.hasConjunct(c) {
		// The constraint already existed and the conjunct was already added.
		return false
	}

	constraint.addConjunctUnchecked(c)
	return true
}

// matchPattern reports whether f matches pattern. The result reflects
// whether unification of pattern with f converted to a CUE value succeeds.
// The caller should check separately whether f matches any other arcs
// that are not covered by pattern.
func matchPattern(ctx *OpContext, pattern Value, f Feature) bool {
	if pattern == nil || !f.IsRegular() {
		return false
	}

	// TODO(perf): this assumes that comparing an int64 against apd.Decimal
	// is faster than converting this to a Num and using that for comparison.
	// This may very well not be the case. But it definitely will be if we
	// special-case integers that can fit in an int64 (or int32 if we want to
	// avoid many bound checks), which we probably should. Especially when we
	// allow list constraints, like [<10]: T.
	var label Value
	if f.IsString() && int64(f.Index()) != MaxIndex {
		label = f.ToValue(ctx)
	}

	return matchPatternValue(ctx, pattern, f, label)
}

// matchPatternValue matches a concrete value against f. label must be the
// CUE value that is obtained from converting f.
//
// This is an optimization an intended to be faster than regular CUE evaluation
// for the majority of cases where pattern constraints are used.
func matchPatternValue(ctx *OpContext, pattern Value, f Feature, label Value) (result bool) {
	if v, ok := pattern.(*Vertex); ok {
		v.unify(ctx, scalarKnown, finalize)
	}
	pattern = Unwrap(pattern)
	label = Unwrap(label)

	if pattern == label {
		return true
	}

	k := IntKind
	if f.IsString() {
		k = StringKind
	}
	if !k.IsAnyOf(pattern.Kind()) {
		return false
	}

	// Fast track for the majority of cases.
	switch x := pattern.(type) {
	case *Bottom:
		// TODO: hoist and reuse with the identical code in optional.go.
		if x == cycle {
			err := ctx.NewPosf(pos(pattern), "cyclic pattern constraint")
			ctx.vertex.VisitLeafConjuncts(func(c Conjunct) bool {
				addPositions(err, c)
				return true
			})
			ctx.AddBottom(&Bottom{
				Err:  err,
				Node: ctx.vertex,
			})
		}
		if ctx.errs == nil {
			ctx.AddBottom(x)
		}
		return false

	case *Top:
		return true

	case *BasicType:
		return x.K&k == k

	case *BoundValue:
		switch x.Kind() {
		case StringKind:
			if label == nil {
				return false
			}
			str := label.(*String).Str
			return x.validateStr(ctx, str)

		case NumberKind:
			return x.validateInt(ctx, int64(f.Index()))
		}

	case *Num:
		if !f.IsInt() {
			return false
		}
		yi := int64(f.Index())
		xi, err := x.X.Int64()
		return err == nil && xi == yi

	case *String:
		if label == nil {
			return false
		}
		y, ok := label.(*String)
		return ok && x.Str == y.Str

	case *Conjunction:
		for _, a := range x.Values {
			if !matchPatternValue(ctx, a, f, label) {
				return false
			}
		}
		return true

	case *Disjunction:
		for _, a := range x.Values {
			if matchPatternValue(ctx, a, f, label) {
				return true
			}
		}
		return false
	}

	// Slow track.
	//
	// TODO(perf): if a pattern tree has many values that are not handled in the
	// fast track, it is probably more efficient to handle everything in the
	// slow track. One way to signal this would be to have a "value thunk" at
	// the root that causes the fast track to be bypassed altogether.

	if label == nil {
		label = f.ToValue(ctx)
	}

	n := ctx.newInlineVertex(nil, nil,
		MakeConjunct(ctx.e, pattern, ctx.ci),
		MakeConjunct(ctx.e, label, ctx.ci))
	n.Finalize(ctx)
	return n.Err(ctx) == nil
}
