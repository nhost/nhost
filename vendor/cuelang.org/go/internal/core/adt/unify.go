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

	"cuelang.org/go/cue/token"
)

// TODO(mpvl): perhaps conjunctsProcessed is a better name for this.
func (v *Vertex) isInitialized() bool {
	return v.status == finalized || (v.state != nil && v.state.isInitialized)
}

func (n *nodeContext) assertInitialized() {
	if n != nil && n.ctx.isDevVersion() {
		if v := n.node; !v.isInitialized() {
			panic(fmt.Sprintf("vertex %p not initialized", v))
		}
	}
}

// isInProgress reports whether v is in the midst of being evaluated. This means
// that conjuncts have been scheduled, but that it has not been finalized.
func (v *Vertex) isInProgress() bool {
	return v.status != finalized && v.state != nil && v.state.isInitialized
}

func (v *Vertex) getBareState(c *OpContext) *nodeContext {
	if v.status == finalized { // TODO: use BaseValue != nil
		return nil
	}
	if v.state == nil {
		v.state = c.newNodeContext(v)
		v.state.initBare()
		v.state.refCount = 1
	}

	// An additional refCount for the current user.
	v.state.refCount += 1

	// TODO: see if we can get rid of ref counting after new evaluator is done:
	// the recursive nature of the new evaluator should make this unnecessary.

	return v.state
}

func (v *Vertex) getState(c *OpContext) *nodeContext {
	s := v.getBareState(c)
	if s != nil && !s.isInitialized {
		s.scheduleConjuncts()
	}
	return s
}

// initNode initializes a nodeContext for the evaluation of the given Vertex.
func (n *nodeContext) initBare() {
	v := n.node
	if v.Parent != nil && v.Parent.state != nil {
		v.state.depth = v.Parent.state.depth + 1
		n.blockOn(allAncestorsProcessed)
	}

	n.blockOn(scalarKnown | listTypeKnown | arcTypeKnown)

	if v.Label.IsDef() {
		v.ClosedRecursive = true
	}

	if v.Parent != nil {
		if v.Parent.ClosedRecursive {
			v.ClosedRecursive = true
		}
	}
}

func (n *nodeContext) scheduleConjuncts() {
	n.isInitialized = true

	v := n.node
	ctx := n.ctx

	ctx.stats.Unifications++

	// Set the cache to a cycle error to ensure a cyclic reference will result
	// in an error if applicable. A cyclic error may be ignored for
	// non-expression references. The cycle error may also be removed as soon
	// as there is evidence what a correct value must be, but before all
	// validation has taken place.
	//
	// TODO(cycle): having a more recursive algorithm would make this
	// special cycle handling unnecessary.
	v.BaseValue = cycle

	defer ctx.PopArc(ctx.PushArc(v))

	root := n.node.rootCloseContext(n.ctx)
	root.incDependent(n.ctx, INIT, nil) // decremented below

	for _, c := range v.Conjuncts {
		ci := c.CloseInfo
		ci.cc = root
		n.scheduleConjunct(c, ci)
	}

	root.decDependent(ctx, INIT, nil)
}

// TODO(evalv3): consider not returning a result at all.
func (v *Vertex) unify(c *OpContext, needs condition, mode runMode) bool {
	if c.LogEval > 0 {
		c.nest++
		c.Logf(v, "Unify %v", fmt.Sprintf("%p", v))
		defer func() {
			c.Logf(v, "END Unify")
			c.nest--
		}()
	}

	if c.evalDepth == 0 {
		defer func() {
			// This loop processes nodes that need to be evaluated, but should be
			// evaluated outside of the stack to avoid structural cycle detection.
			// See comment at toFinalize.
			a := c.toFinalize
			c.toFinalize = c.toFinalize[:0]
			for _, x := range a {
				x.Finalize(c)
			}
		}()
	}

	if mode == ignore {
		return false
	}

	// Note that the state of a node can be removed before the node is.
	// This happens with the close builtin, for instance.
	// See TestFromAPI in pkg export.
	// TODO(evalv3): find something more principled.
	if v.state == nil && v.cc() != nil && v.cc().conjunctCount == 0 {
		v.status = finalized
		return true
	}

	n := v.getState(c)
	if n == nil {
		return true // already completed
	}
	defer n.free()

	defer n.unmarkDepth(n.markDepth())

	// Typically a node processes all conjuncts before processing its fields.
	// So this condition is very likely to trigger. If for some reason the
	// parent has not been processed yet, we could attempt to process more
	// of its tasks to increase the chances of being able to find the
	// information we are looking for here. For now we just continue as is.
	//
	// For dynamic nodes, the parent only exists to provide a path context.
	//
	// Note that if mode is final, we will guarantee that the conditions for
	// this if clause are met down the line. So we assume this is already the
	// case and set the signal accordingly if so.
	if !v.Rooted() || v.Parent.allChildConjunctsKnown() || mode == finalize {
		n.signal(allAncestorsProcessed)
	}

	nodeOnlyNeeds := needs &^ (subFieldsProcessed)
	n.process(nodeOnlyNeeds, mode)

	defer c.PopArc(c.PushArc(v))

	w := v.DerefDisjunct()
	if w != v {
		// Should resolve with dereference.
		v.ClosedRecursive = w.ClosedRecursive
		v.status = w.status
		v.ChildErrors = CombineErrors(nil, v.ChildErrors, w.ChildErrors)
		v.Arcs = nil
		return w.state.meets(needs)
	}
	n.updateScalar()

	if n.aStruct != nil {
		n.updateNodeType(StructKind, n.aStruct, n.aStructID)
	}

	// First process all but the subfields.
	switch {
	case n.meets(nodeOnlyNeeds):
		// pass through next phase.
	case mode != finalize:
		// TODO: disjunctions may benefit from evaluation as much prematurely
		// as possible, as this increases the chances of premature failure.
		// We should consider doing a recursive "attemptOnly" evaluation here.
		return false
	}

	if n.isShared {
		if isCyclePlaceholder(n.origBaseValue) {
			n.origBaseValue = nil
		}
	} else if isCyclePlaceholder(n.node.BaseValue) {
		n.node.BaseValue = nil
	}
	if !n.isShared {
		// TODO(sharewithval): allow structure sharing if we only have validator
		// and references.
		// TODO: rewrite to use mode when we get rid of old evaluator.
		state := finalized
		n.validateValue(state)
	}

	if n.node.Label.IsLet() || n.meets(allAncestorsProcessed) {
		if cc := v.rootCloseContext(n.ctx); !cc.isDecremented { // TODO: use v.cc
			cc.decDependent(c, ROOT, nil) // REF(decrement:nodeDone)
			cc.isDecremented = true
		}
	}

	if v, ok := n.node.BaseValue.(*Vertex); ok && n.sharedID.CycleType == NoCycle {
		if n.ctx.hasDepthCycle(v) {
			n.reportCycleError()
			return true
		}
		// We unify here to proactively detect cycles. We do not need to,
		// nor should we, if have have already found one.
		v.unify(n.ctx, needs, mode)
	}

	// At this point, no more conjuncts will be added, so we could decrement
	// the notification counters.

	switch {
	case n.completed&subFieldsProcessed != 0:
		// done

	case needs&subFieldsProcessed != 0:
		if DebugSort > 0 {
			DebugSortArcs(n.ctx, n.node)
		}

		switch {
		case assertStructuralCycleV3(n):
		// TODO: consider bailing on error if n.errs != nil.
		case n.completeAllArcs(needs, mode):
		}

		if mode == finalize {
			n.signal(subFieldsProcessed)
		}

		if v.BaseValue == nil {
			// TODO: this seems to not be possible. Possibly remove.
			state := finalized
			v.BaseValue = n.getValidators(state)
		}
		if v := n.node.Value(); v != nil && IsConcrete(v) {
			// Ensure that checks are not run again when this value is used
			// in a validator.
			checks := n.checks
			n.checks = n.checks[:0]
			for _, v := range checks {
				// TODO(errors): make Validate return bottom and generate
				// optimized conflict message. Also track and inject IDs
				// to determine origin location.s
				if b := c.Validate(v, n.node); b != nil {
					n.addBottom(b)
				}
			}
		}

	case needs&fieldSetKnown != 0:
		n.evalArcTypes(mode)
	}

	if err := n.getErr(); err != nil {
		n.errs = nil
		if b := n.node.Bottom(); b != nil {
			err = CombineErrors(nil, b, err)
		}
		n.setBaseValue(err)
	}

	if mode == attemptOnly {
		return n.meets(needs)
	}

	if mask := n.completed & needs; mask != 0 {
		// TODO: phase3: validation
		n.signal(mask)
	}

	n.finalizeDisjunctions()

	w = v.DerefValue() // Dereference anything, including shared nodes.
	if w != v {
		// Clear value fields that are now referred to in the dereferenced
		// value (w).
		v.ChildErrors = nil
		v.Arcs = nil

		// Set control fields that are referenced without dereferencing.
		if w.ClosedRecursive {
			v.ClosedRecursive = true
		}
		// NOTE: setting ClosedNonRecursive is not necessary, as it is
		// handled by scheduleValue.
		if w.HasEllipsis {
			v.HasEllipsis = true
		}
		v.status = w.status

		return true
	}

	// TODO: adding this is wrong, but it should not cause the snippet below
	// to hang. Investigate.
	// v.Closed = v.cc.isClosed
	//
	// This hangs:
	// issue1940: {
	// 	#T: ["a", #T] | ["c", #T] | ["d", [...#T]]
	// 	#A: t: #T
	// 	#B: x: #A
	// 	#C: #B
	// 	#C: x: #A
	// }

	// validationCompleted
	if n.completed&(subFieldsProcessed) != 0 {
		n.node.HasEllipsis = n.node.cc().isTotal

		// The next piece of code used to address the following case
		// (order matters)
		//
		// 		c1: c: [string]: f2
		// 		f2: c1
		// 		Also: cycle/issue990
		//
		// However, with recent changes, it no longer matters. Simultaneously,
		// this causes a hang in the following case:
		//
		// 		_self: x: [...and(x)]
		// 		_self
		// 		x: [1]
		//
		// For this reason we disable it now. It may be the case that we need
		// to enable it for computing disjunctions.
		//
		n.incDepth()
		defer n.decDepth()

		if pc := n.node.PatternConstraints; pc != nil {
			for _, c := range pc.Pairs {
				c.Constraint.unify(n.ctx, allKnown, attemptOnly)
			}
		}

		n.node.updateStatus(finalized)

		defer n.unmarkOptional(n.markOptional())

		if DebugDeps {
			RecordDebugGraph(n.ctx, n.node, "Finalize")
		}
	}

	return n.meets(needs)
}

// Once returning, all arcs plus conjuncts that can be known are known.
//
// Proof:
//   - if there is a cycle, all completeNodeConjuncts will be called
//     repeatedly for all nodes in this cycle, and all tasks on the cycle
//     will have run at least once.
//   - any tasks that were blocking on values on this circle to be completed
//     will thus have to be completed at some point in time if they can.
//   - any tasks that were blocking on values outside of this ring will have
//     initiated its own execution, which is either not cyclic, and thus
//     completes, or is on a different cycle, in which case it completes as
//     well.
//
// Goal:
// - complete notifications
// - decrement reference counts for root and notify.
// NOT:
// - complete value. That is reserved for Unify.
func (n *nodeContext) completeNodeTasks(mode runMode) {
	n.assertInitialized()

	if n.isCompleting > 0 {
		return
	}
	n.isCompleting++
	defer func() {
		n.isCompleting--
	}()

	v := n.node
	c := n.ctx

	if n.ctx.LogEval > 0 {
		c.nest++
		defer func() {
			c.nest--
		}()
	}

	if p := v.Parent; p != nil && p.state != nil {
		if !v.IsDynamic && n.completed&allAncestorsProcessed == 0 {
			p.state.completeNodeTasks(mode)
		}
	}

	if v.IsDynamic || v.Parent.allChildConjunctsKnown() {
		n.signal(allAncestorsProcessed)
	}

	if len(n.scheduler.tasks) != n.scheduler.taskPos {
		// TODO: do we need any more requirements here?
		const needs = valueKnown | fieldConjunctsKnown

		n.process(needs, mode)
		n.updateScalar()
	}

	// Check:
	// - parents (done)
	// - incoming notifications
	// - pending arcs (or incoming COMPS)
	// TODO: replace with something more principled that does not piggyback on
	// debug information.
	for _, r := range v.cc().externalDeps {
		src := r.src
		a := &src.arcs[r.index]
		if a.decremented || a.kind != NOTIFY {
			continue
		}
		if n := src.src.getState(n.ctx); n != nil {
			n.completeNodeTasks(mode)
		}
	}

	// As long as ancestors are not processed, it is still possible for
	// conjuncts to be inserted. Until that time, it is not okay to decrement
	// theroot. It is not necessary to wait on tasks to complete, though,
	// as pending tasks will have their own dependencies on root, meaning it
	// is safe to decrement here.
	if !n.meets(allAncestorsProcessed) && !n.node.Label.IsLet() && mode != finalize {
		return
	}

	// At this point, no more conjuncts will be added, so we could decrement
	// the notification counters.

	if cc := v.rootCloseContext(n.ctx); !cc.isDecremented { // TODO: use v.cc
		cc.isDecremented = true

		cc.decDependent(n.ctx, ROOT, nil) // REF(decrement:nodeDone)
	}
}

func (n *nodeContext) updateScalar() {
	// Set BaseValue to scalar, but only if it was not set before. Most notably,
	// errors should not be discarded.
	if n.scalar != nil && (!n.node.IsErr() || isCyclePlaceholder(n.node.BaseValue)) {
		n.setBaseValue(n.scalar)
		n.signal(scalarKnown)
	}
}

func (n *nodeContext) completeAllArcs(needs condition, mode runMode) bool {
	if n.underlying != nil {
		// References within the disjunct may end up referencing the layer that
		// this node overlays. Also for these nodes we want to be able to detect
		// structural cycles early. For this reason, we also set the
		// evaluatingArcs status in the underlying layer.
		//
		// TODO: for now, this seems not necessary. Moreover, this will cause
		// benchmarks/cycle to display a spurious structural cycle. But it
		// shortens some of the structural cycle depths. So consider using this.
		//
		// status := n.underlying.status
		// n.underlying.updateStatus(evaluatingArcs) defer func() {
		// n.underlying.status = status }()
	}

	// TODO: this should only be done if n is not currently running tasks.
	// Investigate how to work around this.
	n.completeNodeTasks(finalize)

	for _, r := range n.node.cc().externalDeps {
		src := r.src
		a := &src.arcs[r.index]
		if a.decremented {
			continue
		}
		a.decremented = true

		// FIXME: we should be careful to not evaluate parent nodes if we
		// are inside a disjunction, or at least ensure that there are no
		// disjunction values leaked into non-disjunction nodes through
		// evaluating externalDeps.
		src.src.unify(n.ctx, needTasksDone, attemptOnly)
		a.cc.decDependent(n.ctx, a.kind, src) // REF(arcs)
	}

	n.incDepth()
	defer n.decDepth()

	// XXX(0.7): only set success if needs complete arcs.
	success := true
	// Visit arcs recursively to validate and compute error. Use index instead
	// of range in case the Arcs grows during processing.
	for arcPos := 0; arcPos < len(n.node.Arcs); arcPos++ {
		a := n.node.Arcs[arcPos]

		if !a.unify(n.ctx, needs, mode) {
			success = false
		}

		// At this point we need to ensure that all notification cycles
		// for Arc a have been processed.

		if a.ArcType == ArcPending {
			// TODO: cancel tasks?
			// TODO: is this ever run? Investigate once new evaluator work is
			// complete.
			a.ArcType = ArcNotPresent
			continue
		}

		// Errors are allowed in let fields. Handle errors and failure to
		// complete accordingly.
		if !a.Label.IsLet() && a.ArcType <= ArcRequired {
			a := a.DerefValue()
			if err := a.Bottom(); err != nil {
				n.AddChildError(err)
			}
			success = true // other arcs are irrelevant
		}

		// TODO: harmonize this error with "cannot combine"
		switch {
		case a.ArcType > ArcRequired, !a.Label.IsString():
		case n.kind&StructKind == 0:
			if !n.node.IsErr() {
				n.reportFieldMismatch(pos(a.Value()), nil, a.Label, n.node.Value())
			}
			// case !wasVoid:
			// case n.kind == TopKind:
			// 	// Theoretically it may be possible that a "void" arc references
			// 	// this top value where it really should have been a struct. One
			// 	// way to solve this is to have two passes over the arcs, where
			// 	// the first pass additionally analyzes whether comprehensions
			// 	// will yield values and "un-voids" an arc ahead of the rest.
			// 	//
			// 	// At this moment, though, I fail to see a possibility to create
			// 	// faulty CUE using this mechanism, though. At most error
			// 	// messages are a bit unintuitive. This may change once we have
			// 	// functionality to reflect on types.
			// 	if _, ok := n.node.BaseValue.(*Bottom); !ok {
			// 		n.node.BaseValue = &StructMarker{}
			// 		n.kind = StructKind
			// 	}
		}
	}

	k := 0
	for _, a := range n.node.Arcs {
		if a.ArcType != ArcNotPresent {
			n.node.Arcs[k] = a
			k++
		}
	}
	n.node.Arcs = n.node.Arcs[:k]

	// TODO: perhaps this code can go once we have builtins for comparing to
	// bottom.
	for _, c := range n.postChecks {
		ctx := n.ctx
		f := ctx.PushState(c.env, c.expr.Source())

		v := ctx.evalState(c.expr, oldOnly(finalized))
		v, _ = ctx.getDefault(v)
		v = Unwrap(v)

		switch _, isError := v.(*Bottom); {
		case isError == c.expectError:
		default:
			n.node.AddErr(ctx, &Bottom{
				Src:  c.expr.Source(),
				Code: CycleError,
				Node: n.node,
				Err: ctx.NewPosf(pos(c.expr),
					"circular dependency in evaluation of conditionals: %v changed after evaluation",
					ctx.Str(c.expr)),
			})
		}

		ctx.PopState(f)
	}

	// This should be called after all arcs have been processed, because
	// whether sharing is possible or not may depend on how arcs with type
	// ArcPending will resolve.
	n.finalizeSharing()

	// Strip struct literals that were not initialized and are not part
	// of the output.
	//
	// TODO(perf): we could keep track if any such structs exist and only
	// do this removal if there is a change of shrinking the list.
	k = 0
	for _, s := range n.node.Structs {
		if s.initialized {
			n.node.Structs[k] = s
			k++
		}
	}
	n.node.Structs = n.node.Structs[:k]

	// TODO: This seems to be necessary, but enables structural cycles.
	// Evaluator whether we still need this.
	//
	// pc := n.node.PatternConstraints
	// if pc == nil {
	// 	return success
	// }
	// for _, c := range pc.Pairs {
	// 	c.Constraint.Finalize(n.ctx)
	// }

	return success
}

func (n *nodeContext) evalArcTypes(mode runMode) {
	for _, a := range n.node.Arcs {
		if a.ArcType != ArcPending {
			continue
		}
		a.unify(n.ctx, arcTypeKnown, mode)
		// Ensure the arc is processed up to the desired level
		if a.ArcType == ArcPending {
			// TODO: cancel tasks?
			a.ArcType = ArcNotPresent
		}
	}
}

func root(v *Vertex) *Vertex {
	for v.Parent != nil {
		v = v.Parent
	}
	return v
}

func (v *Vertex) lookup(c *OpContext, pos token.Pos, f Feature, flags combinedFlags) *Vertex {
	task := c.current()
	needs := flags.conditions()
	runMode := flags.runMode()

	v = v.DerefValue()

	c.Logf(c.vertex, "LOOKUP %v", f)

	state := v.getState(c)
	if state != nil {
		// If the scheduler associated with this vertex was already running,
		// it means we have encountered a cycle. In that case, we allow to
		// proceed with partial data, in which case a "pending" arc will be
		// created to be completed later.

		// Propagate error if the error is from a different package. This
		// compensates for the fact that we do not fully evaluate the package.
		if state.hasErr() {
			err := state.getErr()
			if err != nil && err.Node != nil && root(err.Node) != root(v) {
				c.AddBottom(err)
			}
		}

		// A lookup counts as new structure. See the commend in Section
		// "Lookups in inline cycles" in cycle.go.
		state.hasNonCycle = true

		// TODO: ideally this should not be run at this point. Consider under
		// which circumstances this is still necessary, and at least ensure
		// this will not be run if node v currently has a running task.
		state.completeNodeTasks(attemptOnly)
	}

	// TODO: remove because unnecessary?
	if task != nil && task.state != taskRUNNING {
		return nil // abort, task is blocked or terminated in a cycle.
	}

	// TODO: verify lookup types.

	arc := v.LookupRaw(f)
	// We leave further dereferencing to the caller, but we do dereference for
	// the remainder of this function to be able to check the status.
	arcReturn := arc
	if arc != nil {
		arc = arc.DerefNonRooted()
		// TODO(perf): NonRooted is the minimum, but consider doing more.
		// arc = arc.DerefValue()
	}

	// TODO: clean up this logic:
	// - signal arcTypeKnown when ArcMember or ArcNotPresent is set,
	//   similarly to scalarKnown.
	// - make it clear we want to yield if it is now known if a field exists.

	var arcState *nodeContext
	switch {
	case arc != nil:
		if arc.ArcType == ArcMember {
			return arcReturn
		}
		arcState = arc.getState(c)

	case state == nil || state.meets(needTasksDone):
		// This arc cannot exist.
		v.reportFieldIndexError(c, pos, f)
		return nil

	default:
		arc = &Vertex{Parent: state.node, Label: f, ArcType: ArcPending}
		v.Arcs = append(v.Arcs, arc)
		arcState = arc.getState(c) // TODO: consider using getBareState.
	}

	if arcState != nil && (!arcState.meets(needTasksDone) || !arcState.meets(arcTypeKnown)) {
		needs |= arcTypeKnown
		// If this arc is not ArcMember, which it is not at this point,
		// any pending arcs could influence the field set.
		for _, a := range arc.Arcs {
			if a.ArcType == ArcPending {
				needs |= fieldSetKnown
				break
			}
		}
		arcState.completeNodeTasks(yield)

		// Child nodes, if pending and derived from a comprehension, may
		// still cause this arc to become not pending.
		if arc.ArcType != ArcMember {
			for _, a := range arcState.node.Arcs {
				if a.ArcType == ArcPending {
					a.unify(c, arcTypeKnown, runMode)
				}
			}
		}

		switch runMode {
		case ignore, attemptOnly:
			// TODO(cycle): ideally, we should be able to require that the
			// arcType be known at this point, but that does not seem to work.
			// Revisit once we have the structural cycle detection in place.

			// TODO: should we avoid notifying ArcPending vertices here?
			if task != nil {
				arcState.addNotify2(task.node.node, task.id)
			}
			if arc.ArcType == ArcPending {
				return arcReturn
			}
			goto handleArcType

		case yield:
			arcState.process(needs, yield)
			// continue processing, as successful processing may still result
			// in an invalid field.

		case finalize:
			// TODO: should we try to use finalize? Using it results in errors and this works. It would be more principled, though.
			arcState.process(needs, yield)
		}
	}

handleArcType:
	switch arc.ArcType {
	case ArcMember, ArcRequired:
		return arcReturn

	case ArcOptional:
		// Technically, this failure also applies to required fields. We assume
		// however, that if a reference field that is made regular will already
		// result in an error, so that piling up another error is not strictly
		// necessary. Note that the spec allows for eliding an error if it is
		// guaranteed another error is generated elsewhere. This does not
		// properly cover the case where a reference is made directly within the
		// definition, but this is fine for the purpose it serves.
		// TODO(refRequired): revisit whether referencing required fields should
		// fail.
		label := f.SelectorString(c.Runtime)
		b := &Bottom{
			Code: IncompleteError,
			Node: v,
			Err: c.NewPosf(pos,
				"cannot reference optional field: %s", label),
		}
		c.AddBottom(b)
		// TODO: yield failure
		return nil

	case ArcNotPresent:
		v.reportFieldIndexError(c, pos, f)
		return nil

	case ArcPending:
		// should not happen.
		panic("unreachable")
	}

	v.reportFieldIndexError(c, pos, f)
	return nil
}

// accept reports whether the given feature is allowed by the pattern
// constraints.
func (v *Vertex) accept(ctx *OpContext, f Feature) bool {
	// TODO: this is already handled by callers at the moment, but it may be
	// better design to move this here.
	// if v.LookupRaw(f) != nil {
	// 	return true, true
	// }

	v = v.DerefValue()

	pc := v.PatternConstraints
	if pc == nil {
		return false
	}

	return matchPattern(ctx, pc.Allowed, f)
}
