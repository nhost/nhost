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

package adt

import "slices"

// This file implements a Vertex overlay. This is used by the disjunction
// algorithm to fork an existing Vertex value without modifying the original.
//
// At the moment, the forked value is a complete copy of the original.
// The copy points to the original to keep track of pointer equivalence.
// Conversely, while a copy is evaluated, the value of which it is a copy
// references the copy. Dereferencing will then take care that the copy is used
// during evaluation.
//
//   nodeContext (main)  <-
//   - deref               \
//     |                    \
//     |  nodeContext (d1)  | <-
//     \  - overlays -------/   \
//      \                        \
//       ->   nodeContext (d2)    |
//            - overlays --------/
//
// TODO: implement dereferencing
// TODO(perf): implement copy on write: instead of copying the entire tree, we
// could get by with only copying arcs to that are modified in the copy.

var nextGeneration int

func newOverlayContext(ctx *OpContext) *overlayContext {
	nextGeneration++
	return &overlayContext{ctx: ctx, generation: nextGeneration}
}

// An overlayContext keeps track of copied vertices, closeContexts, and tasks.
// This allows different passes to know which of each were created, without
// having to walk the entire tree.
type overlayContext struct {
	ctx *OpContext

	// generation is used to identify the current overlayContext. All
	// closeContexts created by this overlayContext will have this generation.
	// Whenever a counter of a closedContext is changed, this may only cause
	// a cascade of changes if the generation is the same.
	generation int

	// closeContexts holds the allocated closeContexts created by allocCC.
	//
	// In the first pass, closeContexts are copied using allocCC. This also
	// walks the parent tree, and allocates copies for ConjunctGroups.
	//
	// In the second pass, initCloneCC can be finalized by initializing each
	// closeContext in this slice.
	//
	// Note that after the copy is completed, the overlay pointer should be
	// deleted.
	closeContexts []*closeContext

	// vertices holds the original, non-overlay vertices. The overlay for a
	// vertex v can be obtained by looking up v.cc.overlay.src.
	vertices []*Vertex
}

// cloneRoot clones the a Vertex in which disjunctions are defined to allow
// inserting selected disjuncts into a new Vertex.
func (ctx *overlayContext) cloneRoot(root *nodeContext) *nodeContext {
	// Clone all vertices that need to be cloned to support the overlay.
	v := ctx.cloneVertex(root.node)
	v.IsDisjunct = true

	// TODO: patch notifications to any node that is within the disjunct to
	// point to the new vertex instead.

	// Initialize closeContexts: at this point, all closeContexts that need to
	// be cloned have been allocated and stored in closeContexts and can now be
	// initialized.
	for _, cc := range ctx.closeContexts {
		ctx.initCloneCC(cc)
	}

	// TODO: walk overlay vertices and decrement counters of non-disjunction
	// running tasks?
	// TODO: find a faster way to do this. Walking over vertices would
	// probably be faster.
	for _, cc := range ctx.closeContexts {
		for _, d := range cc.dependencies {
			if d.task == nil {
				// The test case that makes this necessary:
				// #A: ["a" | "b"] | {}
				// #A: ["a" | "b"] | {}
				// b:  #A & ["b"]
				//
				// TODO: invalidate task instead?
				continue
			}
			if d.kind == TASK && d.task.state == taskRUNNING && !d.task.defunct {
				cc.overlay.decDependent(ctx.ctx, TASK, nil)
			}
		}
	}

	return v.state
}

// unlinkOverlay unlinks helper pointers. This should be done after the
// evaluation of a disjunct is complete. Keeping the linked pointers around
// will allow for dereferencing a vertex to its overlay, which, in turn,
// allows a disjunct to refer to parents vertices of the disjunct that
// recurse into the disjunct.
//
// TODO(perf): consider using generation counters.
func (ctx *overlayContext) unlinkOverlay() {
	for _, cc := range ctx.closeContexts {
		cc.overlay = nil
	}
}

// cloneVertex copies the contents of x into a new Vertex.
//
// It copies all Arcs, Conjuncts, and Structs, recursively.
//
// TODO(perf): it would probably be faster to copy vertices on demand. But this
// is more complicated and it would be worth measuring how much of a performance
// benefit this gives. More importantly, we should first implement the filter
// to eliminate disjunctions pre-copy based on discriminator fields and what
// have you. This is not unlikely to eliminate
func (ctx *overlayContext) cloneVertex(x *Vertex) *Vertex {
	xcc := x.rootCloseContext(ctx.ctx) // may be uninitialized for constraints.
	if o := xcc.overlay; o != nil && o.src != nil {
		// This path could happen with structure sharing or user-constructed
		// values.
		return o.src
	}

	v := &Vertex{}
	*v = *x

	ctx.vertices = append(ctx.vertices, v)

	v._cc = ctx.allocCC(x.cc())

	v._cc.src = v
	v._cc.parentConjuncts = v
	v.Conjuncts = *v._cc.group

	if a := x.Arcs; len(a) > 0 {
		// TODO(perf): reuse buffer.
		v.Arcs = make([]*Vertex, len(a))
		for i, arc := range a {
			// TODO(perf): reuse when finalized.
			arc := ctx.cloneVertex(arc)
			v.Arcs[i] = arc
			arc.Parent = v
		}
	}

	v.Structs = slices.Clone(v.Structs)

	if pc := v.PatternConstraints; pc != nil {
		npc := &Constraints{Allowed: pc.Allowed}
		v.PatternConstraints = npc

		npc.Pairs = make([]PatternConstraint, len(pc.Pairs))
		for i, p := range pc.Pairs {
			npc.Pairs[i] = PatternConstraint{
				Pattern:    p.Pattern,
				Constraint: ctx.cloneVertex(p.Constraint),
			}
		}
	}

	if v.state != nil {
		v.state = ctx.cloneNodeContext(x.state)
		v.state.node = v

		ctx.cloneScheduler(v.state, x.state)
	}

	return v
}

func (ctx *overlayContext) cloneNodeContext(n *nodeContext) *nodeContext {
	if !n.node.isInitialized() {
		panic("unexpected uninitialized node")
	}
	d := n.ctx.newNodeContext(n.node)
	d.underlying = n.underlying
	if n.underlying == nil {
		panic("unexpected nil underlying")
	}

	d.refCount++

	d.ctx = n.ctx
	d.node = n.node

	d.nodeContextState = n.nodeContextState

	d.arcMap = append(d.arcMap, n.arcMap...)
	d.checks = append(d.checks, n.checks...)

	// TODO: do we need to add cyclicConjuncts? Typically, cyclicConjuncts
	// gets cleared at the end of a unify call. There are cases, however, where
	// this is possible. We should decide whether cyclicConjuncts should be
	// forced to be processed in the parent node, or that we allow it to be
	// copied to the disjunction. By taking no action here, we assume it is
	// processed in the parent node. Investigate whether this always will lead
	// to correct results.
	// d.cyclicConjuncts = append(d.cyclicConjuncts, n.cyclicConjuncts...)

	if len(n.disjunctions) > 0 {
		for _, de := range n.disjunctions {
			// Do not clone cc, as it is identified by underlying. We only need
			// to clone the cc in disjunctCCs.
			// de.cloneID.cc = ctx.allocCC(de.cloneID.cc)
			d.disjunctions = append(d.disjunctions, de)
		}
		for _, h := range n.disjunctCCs {
			h.cc = ctx.allocCC(h.cc)
			d.disjunctCCs = append(d.disjunctCCs, h)
		}
	}

	return d
}

// cloneConjunct prepares a tree of conjuncts for copying by first allocating
// a clone for each closeContext.
func (ctx *overlayContext) copyConjunct(c Conjunct) Conjunct {
	cc := c.CloseInfo.cc
	if cc == nil {
		return c
	}
	// TODO: see if we can avoid this allocation. It seems that this should
	// not be necessary, and evaluation attains correct results without it.
	// Removing this, though, will cause some of the assertions to fail. These
	// assertions are overly strict and could be relaxed, but keeping them as
	// they are makes reasoning about them easier.
	overlay := ctx.allocCC(cc)
	c.CloseInfo.cc = overlay
	return c
}

// Phase 1: alloc
func (ctx *overlayContext) allocCC(cc *closeContext) *closeContext {
	// TODO(perf): if the original is "done", it can no longer be modified and
	// we can use the original, even if the values will not be correct.
	if cc.overlay != nil {
		return cc.overlay
	}

	o := &closeContext{generation: ctx.generation}
	cc.overlay = o
	// TODO(evalv3): is it okay to use the same origin in overlays?
	o.origin = cc.origin

	if cc.parent != nil {
		o.parent = ctx.allocCC(cc.parent)
	}

	// Copy the conjunct group if it exists.
	if cc.group != nil {
		// Copy the group of conjuncts.
		g := make([]Conjunct, len(*cc.group))
		o.group = (*ConjunctGroup)(&g)
		for i, c := range *cc.group {
			g[i] = ctx.copyConjunct(c)
		}

		if o.parent != nil {
			// validate invariants
			ca := *cc.parent.group
			if ca[cc.parentIndex].x != cc.group {
				panic("group misaligned")
			}

			(*o.parent.group)[cc.parentIndex].x = o.group
		}
	}

	// This must come after allocating the parent so that we can always read
	// the src vertex from the parent during initialization. This assumes that
	// src is set in the root closeContext when cloning a vertex.
	ctx.closeContexts = append(ctx.closeContexts, cc)

	// needsCloseInSchedule is used as a boolean. The pointer to the original
	// closeContext is just used for reporting purposes.
	if cc.needsCloseInSchedule != nil {
		o.needsCloseInSchedule = ctx.allocCC(cc.needsCloseInSchedule)
	}

	// We only explicitly tag dependencies of type ARC. Notifications that
	// point within the disjunct overlay will be tagged elsewhere.
	for _, a := range cc.arcs {
		if a.kind == ARC {
			ctx.allocCC(a.cc)
		}
	}

	return o
}

func (ctx *overlayContext) initCloneCC(x *closeContext) {
	o := x.overlay

	if p := x.parent; p != nil {
		o.parent = p.overlay
		o.src = o.parent.src
	}

	o.origin = x.origin
	o.conjunctCount = x.conjunctCount
	o.disjunctCount = x.disjunctCount
	o.isDef = x.isDef
	o.isDefOrig = x.isDefOrig
	o.hasTop = x.hasTop
	o.hasNonTop = x.hasNonTop
	o.isClosedOnce = x.isClosedOnce
	o.isEmbed = x.isEmbed
	o.isClosed = x.isClosed
	o.isTotal = x.isTotal
	o.done = x.done
	o.isDecremented = x.isDecremented
	o.parentIndex = x.parentIndex
	o.Expr = x.Expr
	o.Patterns = append(o.Patterns, x.Patterns...)

	// child and next always point to completed closeContexts. Moreover, only
	// fields that are immutable, such as Expr, are used. It is therefore not
	// necessary to use overlays.
	o.child = x.child
	if x.child != nil && x.child.overlay != nil {
		// TODO(evalv3): there seem to be situations where this is possible
		// after all. See if this is really true, and we should remove this
		// panic, or if this underlies a bug of sorts.
		// panic("unexpected overlay in child")
	}
	o.next = x.next
	if x.next != nil && x.next.overlay != nil {
		// TODO(evalv3): there seem to be situations where this is possible
		// after all. See if this is really true, and we should remove this
		// panic, or if this underlies a bug of sorts.
		// See Issue #3434.
		// panic("unexpected overlay in next")
	}

	for _, d := range x.dependencies {
		if d.decremented {
			continue
		}

		if d.dependency.overlay == nil {
			// This dependency is irrelevant for the current overlay. We can
			// eliminate it as long as we decrement the accompanying counter.
			if o.conjunctCount < 2 {
				// This node can only be relevant if it has at least one other
				// dependency. Check that we are not decrementing the counter
				// to 0.
				// TODO: this currently panics for some tests. Disabling does
				// not seem to harm, though. Reconsider whether this is an issue.
				// panic("unexpected conjunctCount: must be at least 2")
			}
			o.conjunctCount--
			continue
		}

		dep := d.dependency
		if dep.overlay != nil {
			dep = dep.overlay
		}
		o.dependencies = append(o.dependencies, &ccDep{
			dependency:  dep,
			kind:        d.kind,
			decremented: false,
		})
	}

	switch p := x.parentConjuncts.(type) {
	case *closeContext:
		if p.overlay == nil {
			panic("expected overlay")
		}
		o.parentConjuncts = p.overlay

	case *Vertex:
		o.parentConjuncts = o.src
	}

	if o.src == nil {
		// fall back to original vertex.
		// FIXME: this is incorrect, as it may lead to evaluating nodes that
		// are not part of the disjunction with values of the disjunction.
		// TODO: try eliminating EVAL dependencies of arcs that are the parent
		// of the disjunction root.
		o.src = x.src
	}

	if o.parentConjuncts == nil {
		panic("expected parentConjuncts")
	}

	for _, a := range x.arcs {
		// If an arc does not have an overlay, we should not decrement the
		// dependency counter. We simply remove the dependency in that case.
		if a.cc.overlay == nil {
			continue
		}
		if a.key.overlay != nil {
			a.key = a.key.overlay // TODO: is this necessary?
		}
		a.cc = a.cc.overlay
		o.arcs = append(o.arcs, a)
	}

	// NOTE: copying externalDeps is hard and seems unnecessary, as it needs to
	// be resolved in the base anyway.
}

func (ctx *overlayContext) cloneScheduler(dst, src *nodeContext) {
	ss := &src.scheduler
	ds := &dst.scheduler

	ds.state = ss.state
	ds.completed = ss.completed
	ds.needs = ss.needs
	ds.provided = ss.provided
	ds.counters = ss.counters

	ss.blocking = ss.blocking[:0]

	for _, t := range ss.tasks {
		switch t.state {
		case taskWAITING:
			// Do not unblock previously blocked tasks, unless they are
			// associated with this node.
			// TODO: an edge case is when a task is blocked on another node
			// within the same disjunction. We could solve this by associating
			// each nodeContext with a unique ID (like a generation counter) for
			// the disjunction.
			if t.node != src || t.blockedOn != ss {
				break
			}
			t.defunct = true
			t := ctx.cloneTask(t, ds, ss)
			ds.tasks = append(ds.tasks, t)
			ds.blocking = append(ds.blocking, t)
			ctx.ctx.blocking = append(ctx.ctx.blocking, t)

		case taskREADY:
			t.defunct = true
			t := ctx.cloneTask(t, ds, ss)
			ds.tasks = append(ds.tasks, t)

		case taskRUNNING:
			if t.run != handleResolver {
				// TODO: consider whether this is also necessary for other
				// types of tasks.
				break
			}

			t.defunct = true
			t := ctx.cloneTask(t, ds, ss)
			t.state = taskREADY
			ds.tasks = append(ds.tasks, t)
		}
	}
}

func (ctx *overlayContext) cloneTask(t *task, dst, src *scheduler) *task {
	if t.node != src.node {
		panic("misaligned node")
	}

	id := t.id
	if id.cc != nil {
		id.cc = ctx.allocCC(t.id.cc) // TODO: may be nil for disjunctions.
	}

	// TODO: alloc from buffer.
	d := &task{
		run:            t.run,
		state:          t.state,
		completes:      t.completes,
		unblocked:      t.unblocked,
		blockCondition: t.blockCondition,
		err:            t.err,
		env:            t.env,
		x:              t.x,
		id:             id,

		node: dst.node,

		// TODO: need to copy closeContexts?
		comp: t.comp,
		leaf: t.leaf,
	}

	if t.blockedOn != nil {
		if t.blockedOn != src {
			panic("invalid scheduler")
		}
		d.blockedOn = dst
	}

	return d
}
