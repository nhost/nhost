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

import (
	"fmt"

	"cuelang.org/go/cue/ast"
)

// This file contains functionality for processing conjuncts to insert the
// corresponding values in the Vertex.
//
// Conjuncts are divided into two classes:
// - literal values that need no evaluation: these are inserted directly into
//   the Vertex.
// - field or value expressions that need to be evaluated: these are inserted
//   as a task into the Vertex' associated scheduler for later evaluation.
//   The implementation of these tasks can be found in tasks.go.
//
// The main entrypoint is scheduleConjunct.

// scheduleConjunct splits c into parts to be incrementally processed and queues
// these parts up for processing. it will itself not cause recursive processing.
func (n *nodeContext) scheduleConjunct(c Conjunct, id CloseInfo) {
	n.assertInitialized()

	// Explanation of switch statement:
	//
	// A Conjunct can be a leaf or, through a ConjunctGroup, a tree. The tree
	// reflects the history of how the conjunct was inserted in terms of
	// definitions and embeddings. This, in turn, is used to compute closedness.
	//
	// Once all conjuncts for a Vertex have been collected, this tree contains
	// all the information needed to trace its histroy: if a Vertex is
	// referenced in an expression, this tree can be used to insert the
	// conjuncts keeping closedness in mind.
	//
	// In the collection phase, however, this is not sufficient. CUE computes
	// conjuncts "out of band". This means that conjuncts accumulate in
	// different parts of the tree in an indeterminate order. closeContext is
	// used to account for this.
	//
	// Basically, if the closeContext associated with c belongs to n, we take
	// it that the conjunct needs to be inserted at the point in the tree
	// associated by this closeContext. If, on the other hand, the closeContext
	// is not defined or does not belong to this node, we take this conjunct
	// is inserted by means of a reference. In this case we assume that the
	// computation of the tree has completed and the tree can be used to reflect
	// the closedness structure.
	//
	// TODO: once the evaluator is done and all tests pass, consider having
	// two different entry points to account for these cases.
	switch cc := c.CloseInfo.cc; {
	case cc == nil || cc.src != n.node:
		// In this case, a Conjunct is inserted from another Arc. If the
		// conjunct represents an embedding or definition, we need to create a
		// new closeContext to represent this.
		if id.cc == nil {
			id.cc = n.node.rootCloseContext(n.ctx)
		}
		if id.cc == cc {
			panic("inconsistent state: same closeContext")
		}
		var t closeNodeType
		if c.CloseInfo.FromDef {
			t |= closeDef
		}
		if c.CloseInfo.FromEmbed {
			t |= closeEmbed
		}
		if t != 0 {
			id, _ = id.spawnCloseContext(n.ctx, t)
		}
		if !id.cc.done {
			id.cc.incDependent(n.ctx, DEFER, nil)
			defer id.cc.decDependent(n.ctx, DEFER, nil)
		}

		if id.cc.src != n.node {
			// TODO(#3406): raise a panic again.
			//		out: d & { d }
			//		d: {
			//			kind: "foo" | "bar"
			//			{ kind: "foo" } | { kind: "bar" }
			//		}
			// panic("inconsistent state: nodes differ")
		}
	default:

		// In this case, the conjunct is inserted as the result of an expansion
		// of a conjunct in place, not a reference. In this case, we must use
		// the cached closeContext.
		id.cc = cc

		// Note this subtlety: we MUST take the cycle info from c when this is
		// an in place evaluated node, otherwise we must take that of id.
		id.CycleInfo = c.CloseInfo.CycleInfo
	}

	if id.cc.needsCloseInSchedule != nil {
		dep := id.cc.needsCloseInSchedule
		id.cc.needsCloseInSchedule = nil
		defer id.cc.decDependent(n.ctx, EVAL, dep)
	}

	env := c.Env

	if id.cc.isDef {
		n.node.ClosedRecursive = true
	}

	switch x := c.Elem().(type) {
	case *ConjunctGroup:
		for _, c := range *x {
			// TODO(perf): can be one loop

			cc := c.CloseInfo.cc
			if cc.src == n.node && cc.needsCloseInSchedule != nil {
				// We need to handle this specifically within the ConjunctGroup
				// loop, because multiple conjuncts may be using the same root
				// closeContext. This can be merged once Vertex.Conjuncts is an
				// interface, requiring any list to be a root conjunct.

				dep := cc.needsCloseInSchedule
				cc.needsCloseInSchedule = nil
				defer cc.decDependent(n.ctx, EVAL, dep)
			}
		}
		for _, c := range *x {
			n.scheduleConjunct(c, id)
		}

	case *Vertex:
		// TODO: move this logic to scheduleVertexConjuncts or at least ensure
		// that we can also share data Vertices?
		if x.IsData() {
			n.unshare()
			n.insertValueConjunct(env, x, id)
		} else {
			n.scheduleVertexConjuncts(c, x, id)
		}

	case Value:
		// TODO: perhaps some values could be shared.
		n.unshare()
		n.insertValueConjunct(env, x, id)

	case *BinaryExpr:
		// NOTE: do not unshare: a conjunction could still allow structure
		// sharing, such as in the case of `ref & ref`.
		if x.Op == AndOp {
			n.scheduleConjunct(MakeConjunct(env, x.X, id), id)
			n.scheduleConjunct(MakeConjunct(env, x.Y, id), id)
			return
		}

		n.unshare()
		// Even though disjunctions and conjunctions are excluded, the result
		// must may still be list in the case of list arithmetic. This could
		// be a scalar value only once this is no longer supported.
		n.scheduleTask(handleExpr, env, x, id)

	case *StructLit:
		n.unshare()
		n.scheduleStruct(env, x, id)

	case *ListLit:
		n.unshare()

		// At this point we known we have at least an empty list.
		n.updateCyclicStatusV3(id)

		env := &Environment{
			Up:     env,
			Vertex: n.node,
		}
		n.scheduleTask(handleListLit, env, x, id)

	case *DisjunctionExpr:
		n.unshare()
		id := id
		id.setOptionalV3(n)

		// TODO(perf): reuse envDisjunct values so that we can also reuse the
		// disjunct slice.
		d := envDisjunct{
			env:     env,
			cloneID: id,
			src:     x,
			expr:    x,
		}
		for _, dv := range x.Values {
			d.disjuncts = append(d.disjuncts, disjunct{
				expr:      dv.Val,
				isDefault: dv.Default,
				mode:      mode(x.HasDefaults, dv.Default),
			})
		}
		n.scheduleDisjunction(d)

	case *Comprehension:
		// always a partial comprehension.
		n.insertComprehension(env, x, id)

	case Resolver:
		n.scheduleTask(handleResolver, env, x, id)

	case Evaluator:
		n.unshare()
		// Interpolation, UnaryExpr, CallExpr
		n.scheduleTask(handleExpr, env, x, id)

	default:
		panic("unreachable")
	}

	n.ctx.stats.Conjuncts++
}

// scheduleStruct records all elements of this conjunct in the structure and
// then processes it. If an element needs to be inserted for evaluation,
// it may be scheduled.
func (n *nodeContext) scheduleStruct(env *Environment,
	s *StructLit,
	ci CloseInfo) {
	n.updateCyclicStatusV3(ci)

	// NOTE: This is a crucial point in the code:
	// Unification dereferencing happens here. The child nodes are set to
	// an Environment linked to the current node. Together with the De Bruijn
	// indices, this determines to which Vertex a reference resolves.

	childEnv := &Environment{
		Up:     env,
		Vertex: n.node,
	}

	hasEmbed := false
	hasEllipsis := false

	// TODO: do we still need this?
	// shouldClose := ci.cc.isDef || ci.cc.isClosedOnce

	s.Init(n.ctx)

	// TODO: do we still need to AddStruct and do we still need to Disable?
	parent := n.node.AddStruct(s, childEnv, ci)
	parent.Disable = true // disable until processing is done.
	ci.IsClosed = false

	// TODO: precompile
loop1:
	for _, d := range s.Decls {
		switch d.(type) {
		case *Ellipsis:
			hasEllipsis = true
			break loop1
		}
	}

	// TODO(perf): precompile whether struct has embedding.
loop2:
	for _, d := range s.Decls {
		switch d.(type) {
		case *Comprehension, Expr:
			// No need to increment and decrement, as there will be at least
			// one entry.
			if _, ok := s.Src.(*ast.File); !ok && s.Src != nil {
				// If this is not a file, the struct indicates the scope/
				// boundary at which closedness should apply. This is not true
				// for files.
				// We should also not spawn if this is a nested Comprehension,
				// where the spawn is already done as it may lead to spurious
				// field not allowed errors. We can detect this with a nil s.Src.
				// TODO(evalv3): use a more principled detection mechanism.
				// TODO: set this as a flag in StructLit so as to not have to
				// do the somewhat dangerous cast here.
				ci, _ = ci.spawnCloseContext(n.ctx, 0)
			}
			// Note: adding a count is not needed here, as there will be an
			// embed spawn below.
			hasEmbed = true
			break loop2
		}
	}

	// First add fixed fields and schedule expressions.
	for _, d := range s.Decls {
		switch x := d.(type) {
		case *Field:
			if x.Label.IsString() && x.ArcType == ArcMember {
				n.aStruct = s
				n.aStructID = ci
			}
			ci := ci
			if x.ArcType == ArcOptional {
				ci.setOptionalV3(n)
			}

			fc := MakeConjunct(childEnv, x, ci)
			// fc.CloseInfo.cc = nil // TODO: should we add this?
			n.insertArc(x.Label, x.ArcType, fc, ci, true)

		case *LetField:
			lc := MakeConjunct(childEnv, x, ci)
			n.insertArc(x.Label, ArcMember, lc, ci, true)

		case *Comprehension:
			ci, cc := ci.spawnCloseContext(n.ctx, closeEmbed)
			cc.decl = x
			cc.incDependent(n.ctx, DEFER, nil)
			defer cc.decDependent(n.ctx, DEFER, nil)
			n.insertComprehension(childEnv, x, ci)
			hasEmbed = true

		case *Ellipsis:
			// Can be added unconditionally to patterns.
			ci.cc.isDef = false
			ci.cc.isClosed = false
			ci.cc.isDefOrig = false

		case *DynamicField:
			if x.ArcType == ArcMember {
				n.aStruct = s
				n.aStructID = ci
			}
			n.scheduleTask(handleDynamic, childEnv, x, ci)

		case *BulkOptionalField:
			ci := ci
			ci.setOptionalV3(n)

			// All do not depend on each other, so can be added at once.
			n.scheduleTask(handlePatternConstraint, childEnv, x, ci)

		case Expr:
			// TODO: perhaps special case scalar Values to avoid creating embedding.
			ci, cc := ci.spawnCloseContext(n.ctx, closeEmbed)
			cc.decl = x

			// TODO: do we need to increment here?
			cc.incDependent(n.ctx, DEFER, nil) // decrement deferred below
			defer cc.decDependent(n.ctx, DEFER, nil)

			ec := MakeConjunct(childEnv, x, ci)
			n.scheduleConjunct(ec, ci)
			hasEmbed = true
		}
	}
	if hasEllipsis {
		ci.cc.isTotal = true
	}
	if !hasEmbed {
		n.aStruct = s
		n.aStructID = ci
		ci.cc.hasNonTop = true
	}

	// TODO: probably no longer necessary.
	parent.Disable = false
}

// scheduleVertexConjuncts injects the conjuncst of src n. If src was not fully
// evaluated, it subscribes dst for future updates.
func (n *nodeContext) scheduleVertexConjuncts(c Conjunct, arc *Vertex, closeInfo CloseInfo) {
	// disjunctions, we need to dereference he underlying node.
	if deref(n.node) == deref(arc) {
		return
	}

	if n.shareIfPossible(c, arc, closeInfo) {
		arc.getState(n.ctx)
		return
	}

	// We need to ensure that each arc is only unified once (or at least) a
	// bounded time, witch each conjunct. Comprehensions, for instance, may
	// distribute a value across many values that get unified back into the
	// same value. If such a value is a disjunction, than a disjunction of N
	// disjuncts will result in a factor N more unifications for each
	// occurrence of such value, resulting in exponential running time. This
	// is especially common values that are used as a type.
	//
	// However, unification is idempotent, so each such conjunct only needs
	// to be unified once. This cache checks for this and prevents an
	// exponential blowup in such case.
	//
	// TODO(perf): this cache ensures the conjuncts of an arc at most once
	// per ID. However, we really need to add the conjuncts of an arc only
	// once total, and then add the close information once per close ID
	// (pointer can probably be shared). Aside from being more performant,
	// this is probably the best way to guarantee that conjunctions are
	// linear in this case.

	ciKey := closeInfo
	ciKey.Refs = nil
	ciKey.Inline = false
	key := arcKey{arc, ciKey}
	for _, k := range n.arcMap {
		if key == k {
			return
		}
	}
	n.arcMap = append(n.arcMap, key)

	if IsDef(c.Expr()) {
		// TODO: or should we always insert the wrapper (for errors)?
		ci, dc := closeInfo.spawnCloseContext(n.ctx, closeDef)
		closeInfo = ci

		dc.incDependent(n.ctx, DEFER, nil) // decrement deferred below
		defer dc.decDependent(n.ctx, DEFER, nil)
	}

	if !n.node.nonRooted || n.node.IsDynamic {
		if state := arc.getBareState(n.ctx); state != nil {
			state.addNotify2(n.node, closeInfo)
		}
	}

	// TODO(perf): buffer or use stack.
	var a []*closeContext
	a = appendPrefix(a, closeInfo.cc)

	// Use explicit index in case Conjuncts grows during iteration.
	for i := 0; i < len(arc.Conjuncts); i++ {
		c := arc.Conjuncts[i]
		n.insertAndSkipConjuncts(a, c, closeInfo)
	}

	if state := arc.getBareState(n.ctx); state != nil {
		n.toComplete = true
	}
}

// appendPrefix records the closeContext from the root of the current node to
// cc by walking up the parent chain and storing the results ancestor first.
// This is used to split conjunct trees into a forest of little trees.
func appendPrefix(a []*closeContext, cc *closeContext) []*closeContext {
	if cc.parent != nil {
		a = appendPrefix(a, cc.parent)
	}
	a = append(a, cc)
	return a
}

// insertAndSkipConjuncts analyzes the conjunct tree represented by c and splits
// it into branches from the point where it deviates from the conjunct branch
// represented by skip.
//
// TODO(evalv3): Consider this example:
//
//	#A: {
//		b: {} // error only reported here.
//		c: b & {
//			// error (g not allowed) not reported here, as it would be okay if b
//			// were valid. Instead, it is reported at b only. This is conform
//			// the spec.
//			d: 1
//		}
//	}
//	x: #A
//	x: b: g: 1
//
// We could also report an error at g by tracing if a conjunct crosses a isDef
// boundary between the root of c and the cc of the conjunct.
// Not doing so might have an effect on the outcome of disjunctions. This may be
// okay (ideally closedness is not modal), but something to consider. For now,
// we should probably copy whatever v2 was doing.
func (n *nodeContext) insertAndSkipConjuncts(skip []*closeContext, c Conjunct, id CloseInfo) {
	if c.CloseInfo.cc == nil {
		n.scheduleConjunct(c, id)
		return
	}

	root := c.CloseInfo.cc.origin

	// TODO(perf): closeContexts should be exact prefixes. So instead of
	// searching the list, we could test them incrementally. This seems more
	// robust for now as the data structure might slightly change and cause
	// disalignment.
	for _, s := range skip {
		if root == s.origin {
			switch x := c.Elem().(type) {
			case *ConjunctGroup:
				for _, c := range *x {
					n.insertAndSkipConjuncts(skip, c, id)
				}

			default:
				// TODO: do leaf conjuncts that match need different treatment
				// from those that don't? Right now, we treat them the same.
				n.scheduleConjunct(c, id)
			}
			return
		}
	}

	n.scheduleConjunct(c, id)
}

func (n *nodeContext) addNotify2(v *Vertex, c CloseInfo) []receiver {
	// No need to do the notification mechanism if we are already complete.
	old := n.notify
	switch {
	case n.node.isFinal():
		return old
	case !n.node.isInProgress():
	case n.meets(allAncestorsProcessed):
		return old
	}

	// Create a "root" closeContext to reflect the entry point of the
	// reference into n.node relative to cc within v. After that, we can use
	// assignConjunct to add new conjuncts.

	// TODO: dedup: only add if t does not already exist. First check if this
	// is even possible by adding a panic.
	root := n.node.rootCloseContext(n.ctx)
	if root.isDecremented {
		return old
	}

	for _, r := range n.notify {
		if r.v == v && r.cc == c.cc {
			return old
		}
	}

	cc := c.cc

	if root.linkNotify(n.ctx, v, cc, c.CycleInfo) {
		n.notify = append(n.notify, receiver{v, cc})
	}

	return old
}

// Literal conjuncts

func (n *nodeContext) insertValueConjunct(env *Environment, v Value, id CloseInfo) {
	n.updateCyclicStatusV3(id)

	ctx := n.ctx

	switch x := v.(type) {
	case *Vertex:
		if x.ClosedNonRecursive {
			n.node.ClosedNonRecursive = true
			var cc *closeContext
			id, cc = id.spawnCloseContext(n.ctx, 0)
			cc.isClosedOnce = true

			if v, ok := x.BaseValue.(*Vertex); ok {
				n.insertValueConjunct(env, v, id)
				return
			}
		}
		if _, ok := x.BaseValue.(*StructMarker); ok {
			n.aStruct = x
			n.aStructID = id
		}

		if !x.IsData() {
			c := MakeConjunct(env, x, id)
			n.scheduleVertexConjuncts(c, x, id)
			return
		}

		// TODO: evaluate value?
		switch v := x.BaseValue.(type) {
		default:
			panic(fmt.Sprintf("invalid type %T", x.BaseValue))

		case *ListMarker:
			n.updateCyclicStatusV3(id)

			// TODO: arguably we know now that the type _must_ be a list.
			n.scheduleTask(handleListVertex, env, x, id)

			return

		case *StructMarker:
			for _, a := range x.Arcs {
				if a.ArcType != ArcMember {
					continue
				}
				// TODO(errors): report error when this is a regular field.
				c := MakeConjunct(nil, a, id)
				n.insertArc(a.Label, a.ArcType, c, id, true)
			}

		case Value:
			n.insertValueConjunct(env, v, id)
		}

		return

	case *Bottom:
		id.cc.hasNonTop = true
		n.addBottom(x)
		return

	case *Builtin:
		id.cc.hasNonTop = true
		if v := x.BareValidator(); v != nil {
			n.insertValueConjunct(env, v, id)
			return
		}
	}

	if !n.updateNodeType(v.Kind(), v, id) {
		return
	}

	switch x := v.(type) {
	case *Disjunction:
		// TODO(perf): reuse envDisjunct values so that we can also reuse the
		// disjunct slice.
		id := id
		id.setOptionalV3(n)

		d := envDisjunct{
			env:     env,
			cloneID: id,
			src:     x,
			value:   x,
		}
		for i, dv := range x.Values {
			d.disjuncts = append(d.disjuncts, disjunct{
				expr:      dv,
				isDefault: i < x.NumDefaults,
				mode:      mode(x.HasDefaults, i < x.NumDefaults),
			})
		}
		n.scheduleDisjunction(d)

	case *Conjunction:
		// TODO: consider sharing: conjunct could be `ref & ref`, for instance,
		// in which case ref could still be shared.

		for _, x := range x.Values {
			n.insertValueConjunct(env, x, id)
		}

	case *Top:
		n.hasTop = true
		id.cc.hasTop = true

	case *BasicType:
		id.cc.hasNonTop = true

	case *BoundValue:
		id.cc.hasNonTop = true
		switch x.Op {
		case LessThanOp, LessEqualOp:
			if y := n.upperBound; y != nil {
				n.upperBound = nil
				v := SimplifyBounds(ctx, n.kind, x, y)
				if err := valueError(v); err != nil {
					err.AddPosition(v)
					err.AddPosition(n.upperBound)
					err.AddClosedPositions(id)
				}
				n.insertValueConjunct(env, v, id)
				return
			}
			n.upperBound = x

		case GreaterThanOp, GreaterEqualOp:
			if y := n.lowerBound; y != nil {
				n.lowerBound = nil
				v := SimplifyBounds(ctx, n.kind, x, y)
				if err := valueError(v); err != nil {
					err.AddPosition(v)
					err.AddPosition(n.lowerBound)
					err.AddClosedPositions(id)
				}
				n.insertValueConjunct(env, v, id)
				return
			}
			n.lowerBound = x

		case EqualOp, NotEqualOp, MatchOp, NotMatchOp:
			// This check serves as simplifier, but also to remove duplicates.
			k := 0
			match := false
			for _, c := range n.checks {
				if y, ok := c.x.(*BoundValue); ok {
					switch z := SimplifyBounds(ctx, n.kind, x, y); {
					case z == y:
						match = true
					case z == x:
						continue
					}
				}
				n.checks[k] = c
				k++
			}
			n.checks = n.checks[:k]
			if !match {
				n.checks = append(n.checks, MakeConjunct(env, x, id))
			}
			return
		}

	case Validator:
		// This check serves as simplifier, but also to remove duplicates.
		cx := MakeConjunct(env, x, id)
		for i, y := range n.checks {
			if b, ok := SimplifyValidator(ctx, cx, y); ok {
				n.checks[i] = b
				return
			}
		}
		kind := x.Kind()
		n.updateNodeType(kind, x, id)
		// A validator that is inserted in a closeContext should behave like top
		// in the sense that the closeContext should not be closed if no other
		// value is present that would erase top (cc.hasNonTop): if a field is
		// only associated with a validator, we leave it to the validator to
		// decide what fields are allowed.
		if kind&(ListKind|StructKind) != 0 {
			id.cc.hasTop = true
		}
		n.checks = append(n.checks, cx)

		// We use set the type of the validator argument here to ensure that
		// validation considers the ultimate value of embedded validators,
		// rather than assuming that the struct in which an expression is
		// embedded is always a struct.
		// TODO(validatorType): get rid of setting n.hasTop here.
		k := x.Kind()
		if k == TopKind {
			n.hasTop = true
		}
		n.updateNodeType(k, x, id)

	case *Vertex:
	// handled above.

	case Value: // *NullLit, *BoolLit, *NumLit, *StringLit, *BytesLit, *Builtin
		if y := n.scalar; y != nil {
			if b, ok := BinOp(ctx, EqualOp, x, y).(*Bool); !ok || !b.B {
				n.reportConflict(x, y, x.Kind(), y.Kind(), n.scalarID, id)
			}
			break
		}
		n.scalar = x
		n.scalarID = id
		n.signal(scalarKnown)

	default:
		panic(fmt.Sprintf("unknown value type %T", x))
	}

	if n.lowerBound != nil && n.upperBound != nil {
		if u := SimplifyBounds(ctx, n.kind, n.lowerBound, n.upperBound); u != nil {
			if err := valueError(u); err != nil {
				err.AddPosition(n.lowerBound)
				err.AddPosition(n.upperBound)
				err.AddClosedPositions(id)
			}
			n.lowerBound = nil
			n.upperBound = nil
			n.insertValueConjunct(env, u, id)
		}
	}
}
