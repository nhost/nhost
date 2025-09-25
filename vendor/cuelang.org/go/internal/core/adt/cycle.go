// Copyright 2022 CUE Authors
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

// TODO:
// - compiler support for detecting cross-pattern references.
// - handle propagation of cyclic references to root across disjunctions.

// # Cycle detection algorithm V3
//
// The cycle detection algorithm detects the following kind of cycles:
//
// - Structural cycles: cycles where a field, directly or indirectly, ends up
//   referring to an ancestor node. For instance:
//
//      a: b: a
//
//      a: b: c
//      c: a
//
//      T: a?: T
//      T: a: {}
//
// - Reference cycles: cycles where a field, directly or indirectly, end up
//   referring to itself:
//      a: a
//
//      a: b
//      b: a
//
// - Inline cycles: cycles within an expression, for instance:
//
//      x: {y: x}.out
//
// Note that it is possible for the unification of two non-cyclic structs to be
// cyclic:
//
//     y: {
//         f: h: g
//         g: _
//     }
//     x: {
//         f: _
//         g: f
//     }
//
// Even though the above contains no cycles, the result of `x & y` is cyclic:
//
//     f: h: g
//     g: f
//
// Cycle detection is inherently a dynamic process.
//
// ## ALGORITHM OVERVIEW
//
//  1.  Traversal with Path Tracking:
//      •   Perform a depth-first traversal of the CUE value graph.
//      •   Maintain a path (call stack) of ancestor nodes during traversal.
//          For this purpose, we separately track the parent relation as well
//          as marking nodes that are currently being processed.
//  2.  Per-Conjunct Cycle Tracking:
//      •   For each conjunct in a node’s value (i.e., c1 & c2 & ... & cn),
//          track cycles independently.
//      •   A node is considered non-cyclic if any of its conjuncts is
//          non-cyclic.
//  3.  Handling References:
//      •   When encountering a reference, check if it points to any node in the
//          current path.
//          •   If yes, mark the conjunct as cyclic.
//          •   If no, add the referenced node to the path and continue traversal.
//  4.  Handling Optional Constructs:
//      •   Conjuncts originating from optional fields, pattern constraints, and
//          disjunctions are marked as optional.
//      •   Cycle tracking for optional conjuncts is identical to conjuncts for
//          conjuncts not marked as optional up to the point a cycle is detected
//          (i.e. all conjuncts are cyclic).
//      •   When a cycle is detected, the lists of referenced nodes are cleared
//          for each conjuncts, which thereby are afforded one additional level
//          of cycles. This allows for any optional paths to terminate.
//
//
// ## CALL STACK
//
// There are two key types of structural cycles: referencing an ancestor and
// repeated mixing in of cyclic types. We track these separately.
//
// We also keep track the non-cyclicity of conjuncts a bit differently for these
// cases.
//
// ### Ancestor References
//
// Ancestor references are relatively easy to detect by simply checking if a
// resolved reference is a direct parent, or is a node that is currently under
// evaluation.
//
// An ancestor cycle is considered to be a structural cycle if there are no
// new sibling conjuncts associated with new structure.
//
// ### Reoccurring references
//
// For reoccuring references, we need to maintain a per-conjunct list of
// references. When a reference was previously resolved in a conjunct, we may
// have a cycle and will mark the conjunct as such.
//
// A cycle from a reoccurring reference is a structural cycle if there are
// no incoming arcs from any non-cyclic conjunct. The need for this subtle
// distinction can be clarified by an example;
//
// 		crossRefNoCycle: t4: {
// 			T: X={
// 				y: X.x
// 			}
//			// Here C.x.y must consider any incoming arc: here T originates from
//			// a non-cyclic conjunct, but once evaluated it becomes cyclic and
//			// will be the only conjunct. This is not a cycle, though. We must
//			// take into account that T was introduced from a non-cyclic
//			// conjunct.
// 			C: T & { x: T }
// 		}
//
//
// ## OPTIONAL PATHS
//
// Cyclic references for conjuncts that originate from an "optional" path, such
// as optional fields and pattern constraints, may not necessary be cyclic, as
// on a next iteration such conjuncts _may_ still terminate.
//
// To allow for this kind of eventuality, optional conjuncts are processed in
// two phases:
//
//  - they behave as normal conjuncts up to the point a cycle is detected
//  - afterwards, their reference history is cleared and they are afforded to
//    proceed until the next cycle is detected.
//
// Note that this means we may allow processing to proceed deeper than strictly
// necessary in some cases.
//
// Note that we only allow this for references: for cycles with ancestor nodes
// we immediately terminate for optional fields. This simplifies the algorithm.
// But it is also correct: in such cases either the whole node is in an optional
// path, in which case reporting an error is benign (as they are allowed), or
// the node corresponds to a non-optional field, in which case a cycle can be
// expected to reproduce another non-optional cycle, which will be an error.
//
// ### Examples
//
// These are not cyclic:
//
//  1. The structure is cyclic, but he optional field needs to be "fed" to
//     continue the cycle:
//
//      a: b?: a        // a: {}
//
//      b: [string]: b  // b: {}
//
//      c: 1 | {d: c}   // c: 1
//
//  2. The structure is cyclic. Conjunct `x: a` keeps detecting cycles, but
//     is fed with new structure up until x.b.c.b.c.b. After this, this
//     (optional) conjunct is allowed to proceed until the next cycle, which
//     not be reached, as the `b?` is not unified with a concrete value.
//     So the result of `x` is `{b: c: b: c: b: c: {}}`.
//
//      a: b?: c: a
//      x: a
//      x: b: c: b: c: b: {}
//
// These are cyclic:
//
//  3. Here the optional conjunct triggers a new cycle of itself, but also
//     of a conjunct that turns `b` into a regular field. It is thus a self-
//     feeding cycle.
//
//      a: b?: a
//      a: b: _
//
//      c: [string]: c
//      c: b: _
//
//  4.  Here two optional conjuncts end up feeding each other, resulting in a
//      cycle.
//
//      a: c: a | int
//      a: a | int
//
//      y1: c?: c: y1
//      x1: y1
//      x1: c: y1
//
//      y2: [string]: b: y2
//      x2: y2
//      x2: b: y2
//
//
// ## INLINE CYCLES
//
// The semantics for treating inline cycles can be derived by rewriting CUE of
// the form
//
//      x: {...}.out
//
// as
//
//      x:  _x.out
//      _x: {...}
//
// A key difference is that as such structs are not "rooted" (they have no path
// from the root of the configuration tree) and thus any error should be caught
// and evaluated before doing a lookup in such structs to be correct. For the
// purpose of this algorithm, this especially pertains to structural cycles.
//
// TODO: implement: current handling of inline still loosly based on old
// algorithm.
//
// ### Examples
//
// Expanding these out with the above rules should give the same results.
//
// Cyclic:
//
//  1. This is an example of mutual recursion, triggered by n >= 2.
//
//      fibRec: {
//          nn: int,
//          out: (fib & {n: nn}).out
//      }
//      fib: {
//          n: int
//          if n >= 2 { out: (fibRec & {nn: n - 2}).out }
//          if n < 2  { out: n }
//      }
//      fib2: fib & {n: 2}
//
// is equivalent to
//
//      fibRec: {
//          nn:   int,
//          out:  _out.out
//          _out: fib & {n: nn}
//      }
//      fib: {
//          n: int
//          if n >= 2 {
//              out:  _out.out
//              _out: fibRec & {nn: n - 2}
//          }
//          if n < 2  { out: n }
//      }
//      fib2: fib & {n: 2}
//
// Non-cyclic:
//
//  2. This is not dissimilar to the previous example, but since additions are
//     done on separate lines, each field is only visited once and no cycle is
//     triggered.
//
//      f: { in:  number, out: in }
//      k00: 0
//      k10: (f & {in: k00}).out
//      k20: (f & {in: k10}).out
//      k10: (f & {in: k20}).out
//
// which is equivalent to
//
//      f: { in:  number, out: in }
//      k0:   0
//      k1:  _k1.out
//      k2:  _k2.out
//      k1:  _k3.out
//      _k1: f
//      _k2: f
//      _k3: f
//      _k1: in: k0
//      _k2: in: k1
//      _k3: in: k2
//
// and thus is non-cyclic.
//
// ## EDGE CASES
//
// This section lists several edge cases, including interactions with the
// detection of self-reference cycles.
//
// Self-reference cycles, like `a: a`, evaluate to top. The evaluator detects
// this cases and drop such conjuncts, effectively treating them as top.
//
// ### Self-referencing patterns
//
// Self-references in patterns are typically handled automatically. But there
// are some edge cases where the are not:
//
// 		_self: x: [...and(x)]
// 		_self
// 		x: [1]
//
// Patterns are recorded in Vertex values that are themselves evaluated to
// allow them to be compared, such as in subsumption or filtering disjunctions.
// In the above case, `x` may be evaluated to be inserted in the pattern
// Vertex, but because the pattern is not itself `x`, node identity cannot be
// used to detect a self-reference.
//
// The current solution is to mark a node as a pattern constraint and treat
// structural cycles to such nodes as "reference cycles". As pattern constraints
// are optional, it is safe to ignore such errors.
//
// ### Lookups in inline cycles
//
// A lookup, especially in inline cycles, should be considered evidence of
// non-cyclicity. Consider the following example:
//
// 		{ p: { x: p, y: 1 } }.p.x.y
//
// without considering a lookup as evidence of non-cyclicity, this would be
// resulting in a structural cycle.
//
// ## CORRECTNESS
//
// ### The algorithm will terminate
//
// First consider the algorithm without optional conjuncts. If a parent node is
// referenced, it will obviously be caught. The more interesting case is if a
// reference to a node is made which is later reintroduced.
//
// When a conjunct splits into multiple conjuncts, its entire cycle history is
// copied. This means that any cyclic conjunct will be marked as cyclic in
// perpetuity. Non-cyclic conjuncts will either remain non-cyclic or be turned
// into a cycle. A conjunct can only remain non-cyclic for a maximum of the
// number of nodes in a graph. For any structure to repeat, it must have a
// repeated reference. This means that eventually either all conjuncts will
// either terminate or become cyclic.
//
// Optional conjuncts do not materially alter this property. The only difference
// is that when a node-level cycle is detected, we continue processing of some
// conjuncts until this next cycle is reached.
//
//
// ## TODO
//
//  - treatment of let fields
//  - tighter termination for some mutual cycles in optional conjuncts.

// DEPRECATED: V2 cycle detection.
//
// TODO(evalv3): remove these comments once we have fully moved to V3.
//

// Cycle detection:
//
// - Current algorithm does not allow for early non-cyclic conjunct detection.
// - Record possibly cyclic references.
// - Mark as cyclic if no evidence is found.
// - Note that this also activates the same reference in other (parent) conjuncts.

// CYCLE DETECTION ALGORITHM
//
// BACKGROUND
//
// The cycle detection is inspired by the cycle detection used by Tomabechi's
// [Tomabechi COLING 1992] and Van Lohuizen's [Van Lohuizen ACL 2000] graph
// unification algorithms.
//
// Unlike with traditional graph unification, however, CUE uses references,
// which, unlike node equivalence, are unidirectional. This means that the
// technique to track equivalence through dereference, as common in graph
// unification algorithms like Tomabechi's, does not work unaltered.
//
// The unidirectional nature of references imply that each reference equates a
// facsimile of the value it points to. This renders the original approach of
// node-pointer equivalence useless.
//
//
// PRINCIPLE OF ALGORITHM
//
// The solution for CUE is based on two observations:
//
// - the CUE algorithm tracks all conjuncts that define a node separately, -
// accumulating used references on a per-conjunct basis causes duplicate
//   references to uniquely identify cycles.
//
// A structural cycle, as defined by the spec, can then be detected if all
// conjuncts are marked as a cycle.
//
// References are accumulated as follows:
//
// 1. If a conjunct is a reference the reference is associated with that
//    conjunct as well as the conjunct corresponding to the value it refers to.
// 2. If a conjunct is a struct (including lists), its references are associated
//    with all embedded values and fields.
//
// To narrow down the specifics of the reference-based cycle detection, let us
// explore structural cycles in a bit more detail.
//
//
// STRUCTURAL CYCLES
//
// See the language specification for a higher-level and more complete overview.
//
// We have to define when a cycle is detected. CUE implementations MUST report
// an error upon a structural cycle, and SHOULD report cycles at the shortest
// possible paths at which they occur, but MAY report these at deeper paths. For
// instance, the following CUE has a structural cycle
//
//     f: g: f
//
// The shortest path at which the cycle can be reported is f.g, but as all
// failed configurations are logically equal, it is fine for implementations to
// report them at f.g.g, for instance.
//
// It is not, however, correct to assume that a reference to a parent is always
// a cycle. Consider this case:
//
//     a: [string]: b: a
//
// Even though reference `a` refers to a parent node, the cycle needs to be fed
// by a concrete field in struct `a` to persist, meaning it cannot result in a
// cycle as defined in the spec as it is defined here. Note however, that a
// specialization of this configuration _can_ result in a cycle. Consider
//
//     a: [string]: b: a
//     a: c: _
//
// Here reference `a` is guaranteed to result in a structural cycle, as field
// `c` will match the pattern constraint unconditionally.
//
// In other words, it is not possible to exclude tracking references across
// pattern constraints from cycle checking.
//
// It is tempting to try to find a complete set of these edge cases with the aim
// to statically determine cases in which this occurs. But as [Carpenter 1992]
// demonstrates, it is possible for cycles to be created as a result of unifying
// two graphs that are themselves acyclic. The following example is a
// translation of Carpenters example to CUE:
//
//     y: {
//         f: h: g
//         g: _
//     }
//     x: {
//         f: _
//         g: f
//     }
//
// Even though the above contains no cycles, the result of `x & y` is cyclic:
//
//     f: h: g
//     g: f
//
// This means that, in practice, cycle detection has at least partially a
// dynamic component to it.
//
//
// ABSTRACT ALGORITHM
//
// The algorithm is described declaratively by defining what it means for a
// field to have a structural cycle. In the below, a _reference_ is uniquely
// identified by the pointer identity of a Go Resolver instance.
//
// Cycles are tracked on a per-conjunct basis and are not aggregated per Vertex:
// administrative information is only passed on from parent to child conjunct.
//
// A conjunct is a _parent_ of another conjunct if is a conjunct of one of the
// non-optional fields of the conjunct. For instance, conjunct `x` with value
// `{b: y & z}`, is a parent of conjunct `y` as well as `z`. Within field `b`,
// the conjuncts `y` and `z` would be tracked individually, though.
//
// A conjunct is _associated with a reference_ if its value was obtained by
// evaluating a reference. Note that a conjunct may be associated with many
// references if its evaluation requires evaluating a chain of references. For
// instance, consider
//
//    a: {x: d}
//    b: a
//    c: b & e
//    d: y: 1
//
// the first conjunct of field `c` (reference `b`) has the value `{x: y: 1}` and
// is associated with references `b` and `a`.
//
// The _tracked references_ of a conjunct are all references that are associated
// with it or any of its ancestors (parents of parents). For instance, the
// tracked references of conjunct `b.x` of field `c.x` are `a`, `b`, and `d`.
//
// A conjunct is a violating cycle if it is a reference that:
//  - occurs in the tracked references of the conjunct, or
//  - directly refers to a parent node of the conjunct.
//
// A conjunct is cyclic if it is a violating cycle or if any of its ancestors
// are a violating cycle.
//
// A field has a structural cycle if it is composed of at least one conjunct
// that is a violating cycle and no conjunct that is not cyclic.
//
// Note that a field can be composed of only cyclic conjuncts while still not be
// structural cycle: as long as there are no conjuncts that are a violating
// cycle, it is not a structural cycle. This is important for the following
//     case:
//
//         a: [string]: b: a
//         x: a
//         x: c: b: c: {}
//
// Here, reference `a` is never a cycle as the recursive references crosses a
// pattern constraint that only instantiates if it is unified with something
// else.
//
//
// DISCUSSION
//
// The goal of conjunct cycle marking algorithm is twofold: - mark conjuncts
// that are proven to propagate indefinitely - mark them as early as possible
// (shortest CUE path).
//
// TODO: Prove all cyclic conjuncts will eventually be marked as cyclic.
//
// TODO:
//   - reference marks whether it crosses a pattern, improving the case
//     a: [string]: b: c: b
//     This requires a compile-time detection mechanism.
//
//
// REFERENCES
// [Tomabechi COLING 1992]: https://aclanthology.org/C92-2068
//     Hideto Tomabechi. 1992. Quasi-Destructive Graph Unification with
//     Structure-Sharing. In COLING 1992 Volume 2: The 14th International
//     Conference on Computational Linguistics.
//
// [Van Lohuizen ACL 2000]: https://aclanthology.org/P00-1045/
//     Marcel P. van Lohuizen. 2000. "Memory-Efficient and Thread-Safe
//     Quasi-Destructive Graph Unification". In Proceedings of the 38th Annual
//     Meeting of the Association for Computational Linguistics, pages 352–359,
//     Hong Kong. Association for Computational Linguistics.
//
// [Carpenter 1992]:
//     Bob Carpenter, "The logic of typed feature structures."
//     Cambridge University Press, ISBN:0-521-41932-8

// TODO: mark references as crossing optional boundaries, rather than
// approximating it during evaluation.

type CycleInfo struct {
	// CycleType is used by the V3 cycle detection algorithm to track whether
	// a cycle is detected and of which type.
	CycleType CyclicType

	// IsCyclic indicates whether this conjunct, or any of its ancestors,
	// had a violating cycle.
	// TODO: make this a method and use CycleType == IsCyclic after V2 is removed.
	IsCyclic bool

	// Inline is used to detect expressions referencing themselves, for instance:
	//     {x: out, out: x}.out
	Inline bool

	// TODO(perf): pack this in with CloseInfo. Make an uint32 pointing into
	// a buffer maintained in OpContext, using a mark-release mechanism.
	Refs *RefNode
}

// A RefNode is a linked list of associated references.
type RefNode struct {
	Ref Resolver
	Arc *Vertex // Ref points to this Vertex

	// Node is the Vertex of which Ref is evaluated as a conjunct.
	// If there is a cyclic reference (not structural cycle), then
	// the reference will have the same node. This allows detecting reference
	// cycles for nodes referring to nodes with an evaluation cycle
	// (mode tracked to Evaluating status). Examples:
	//
	//      a: x
	//      Y: x
	//      x: {Y}
	//
	// and
	//
	//      Y: x.b
	//      a: x
	//      x: b: {Y} | null
	//
	// In both cases there are not structural cycles and thus need to be
	// distinguished from regular structural cycles.
	Node *Vertex

	Next  *RefNode
	Depth int32
}

// cyclicConjunct is used in nodeContext to postpone the computation of
// cyclic conjuncts until a non-cyclic conjunct permits it to be processed.
type cyclicConjunct struct {
	c   Conjunct
	arc *Vertex // cached Vertex
}

// CycleType indicates the type of cycle detected. The CyclicType is associated
// with a conjunct and may only increase in value for child conjuncts.
type CyclicType uint8

const (
	NoCycle CyclicType = iota

	// like newStructure, but derived from a reference. If this is set, a cycle
	// will move to maybeCyclic instead of isCyclic.
	IsOptional

	// maybeCyclic is set if a cycle is detected within an optional field.
	//
	MaybeCyclic

	// IsCyclic marks that this conjunct has a structural cycle.
	IsCyclic
)

func (n *nodeContext) detectCycleV3(arc *Vertex, env *Environment, x Resolver, ci CloseInfo) (_ CloseInfo, skip bool) {
	n.assertInitialized()

	// If we are pointing to a direct ancestor, and we are in an optional arc,
	// we can immediately terminate, as a cycle error within an optional field
	// is okay. If we are pointing to a direct ancestor in a non-optional arc,
	// we also can terminate, as this is a structural cycle.
	// TODO: use depth or check direct ancestry.
	if n.hasAncestorV3(arc) {
		if n.node.IsDynamic || ci.Inline {
			n.reportCycleError()
			return ci, true
		}

		return n.markCyclicV3(arc, env, x, ci)
	}

	// As long as a node-wide cycle has not yet been detected, we allow cycles
	// in optional fields to proceed unchecked.
	if n.hasNonCyclic && ci.CycleType == MaybeCyclic {
		return ci, false
	}

	for r := ci.Refs; r != nil; r = r.Next {
		if equalDeref(r.Arc, arc) {
			if n.node.IsDynamic || ci.Inline {
				n.reportCycleError()
				return ci, true
			}

			if equalDeref(r.Node, n.node) {
				// reference cycle
				// TODO: in some cases we must continue to fully evaluate.
				// Return false here to solve v0.7.txtar:mutual.t4.ok.p1 issue.
				return ci, true
			}

			// If there are still any non-cyclic conjuncts, and if this conjunct
			// is optional, we allow this to continue one more cycle.
			if ci.CycleType == IsOptional && n.hasNonCyclic {
				ci.CycleType = MaybeCyclic
				ci.Refs = nil
				return ci, false
			}

			return n.markCyclicPathV3(arc, env, x, ci)
		}
	}

	ci.Refs = &RefNode{
		Arc:   deref(arc),
		Ref:   x,
		Node:  deref(n.node),
		Next:  ci.Refs,
		Depth: n.depth,
	}

	return ci, false
}

// markCyclicV3 marks a conjunct as being cyclic. Also, it postpones processing
// the conjunct in the absence of evidence of a non-cyclic conjunct.
func (n *nodeContext) markCyclicV3(arc *Vertex, env *Environment, x Resolver, ci CloseInfo) (CloseInfo, bool) {
	ci.CycleType = IsCyclic
	ci.IsCyclic = true

	n.hasAnyCyclicConjunct = true
	n.hasAncestorCycle = true

	if !n.hasNonCycle && env != nil {
		// TODO: investigate if we can get rid of cyclicConjuncts in the new
		// evaluator.
		v := Conjunct{env, x, ci}
		n.node.cc().incDependent(n.ctx, DEFER, nil)
		n.cyclicConjuncts = append(n.cyclicConjuncts, cyclicConjunct{v, arc})
		return ci, true
	}
	return ci, false
}

func (n *nodeContext) markCyclicPathV3(arc *Vertex, env *Environment, x Resolver, ci CloseInfo) (CloseInfo, bool) {
	ci.CycleType = IsCyclic
	ci.IsCyclic = true

	n.hasAnyCyclicConjunct = true

	if !n.hasNonCyclic && env != nil {
		// TODO: investigate if we can get rid of cyclicConjuncts in the new
		// evaluator.
		v := Conjunct{env, x, ci}
		n.node.cc().incDependent(n.ctx, DEFER, nil)
		n.cyclicConjuncts = append(n.cyclicConjuncts, cyclicConjunct{v, arc})
		return ci, true
	}
	return ci, false
}

// hasDepthCycle uses depth counters to keep track of cycles:
//   - it allows detecting reference cycles as well (state evaluating is
//     no longer used in v3)
//   - it can capture cycles across inline structs, which do not have
//     Parent set.
//
// TODO: ensure that evalDepth is cleared when a node is finalized.
func (c *OpContext) hasDepthCycle(v *Vertex) bool {
	if s := v.state; s != nil && v.status != finalized {
		return s.evalDepth > 0 && s.evalDepth < c.evalDepth
	}
	return false
}

// hasAncestorV3 checks whether a node is currently being processed. The code
// still assumes that is includes any node that is currently being processed.
func (n *nodeContext) hasAncestorV3(arc *Vertex) bool {
	if n.ctx.hasDepthCycle(arc) {
		return true
	}

	// 	TODO: insert test conditions for Bloom filter that guarantee that all
	// 	parent nodes have been marked as "hot", in which case we can avoid this
	// 	traversal.
	// if n.meets(allAncestorsProcessed)  {
	// 	return false
	// }

	for p := n.node.Parent; p != nil; p = p.Parent {
		// TODO(perf): deref arc only once.
		if equalDeref(p, arc) {
			return true
		}
	}
	return false
}

func (n *nodeContext) hasOnlyCyclicConjuncts() bool {
	return (n.hasAncestorCycle && !n.hasNonCycle) ||
		(n.hasAnyCyclicConjunct && !n.hasNonCyclic)
}

// setOptionalV3 marks a conjunct as being optional. The nodeContext is
// currently unused, but allows for checks to be added and to add logging during
// debugging.
func (c *CloseInfo) setOptionalV3(n *nodeContext) {
	_ = n // See comment.
	if c.CycleType == NoCycle {
		c.CycleType = IsOptional
	}
}

// markCycle checks whether the reference x is cyclic. There are two cases:
//  1. it was previously used in this conjunct, and
//  2. it directly references a parent node.
//
// Other inputs:
//
//	arc      the reference to which x points
//	env, ci  the components of the Conjunct from which x originates
//
// A cyclic node is added to a queue for later processing if no evidence of a
// non-cyclic node has so far been found. updateCyclicStatus processes delayed
// nodes down the line once such evidence is found.
//
// If a cycle is the result of "inline" processing (an expression referencing
// itself), an error is reported immediately.
//
// It returns the CloseInfo with tracked cyclic conjuncts updated, and
// whether or not its processing should be skipped, which is the case either if
// the conjunct seems to be fully cyclic so far or if there is a valid reference
// cycle.
func (n *nodeContext) markCycle(arc *Vertex, env *Environment, x Resolver, ci CloseInfo) (_ CloseInfo, skip bool) {
	unreachableForDev(n.ctx)

	n.assertInitialized()

	// TODO(perf): this optimization can work if we also check for any
	// references pointing to arc within arc. This can be done with compiler
	// support. With this optimization, almost all references could avoid cycle
	// checking altogether!
	// if arc.status == Finalized && arc.cyclicReferences == nil {
	//  return v, false
	// }

	// Check whether the reference already occurred in the list, signaling
	// a potential cycle.
	found := false
	depth := int32(0)
	for r := ci.Refs; r != nil; r = r.Next {
		if r.Ref != x {
			// TODO(share): this is a bit of a hack. We really should implement
			// (*Vertex).cyclicReferences for the new evaluator. However,
			// implementing cyclicReferences is somewhat tricky, as it requires
			// referenced nodes to be evaluated, which is a guarantee we may not
			// want to give. Moreover, it seems we can find a simpler solution
			// based on structure sharing. So punt on this solution for now.
			if r.Arc != arc || !n.ctx.isDevVersion() {
				continue
			}
			found = true
		}

		// A reference that is within a graph that is being evaluated
		// may repeat with a different arc and will point to a
		// non-finalized arc. A repeating reference that points outside the
		// graph will always be the same address. Hence, if this is a
		// finalized arc with a different address, it resembles a reference that
		// is included through a different path and is not a cycle.
		if !equalDeref(r.Arc, arc) && arc.status == finalized {
			continue
		}

		// For dynamically created structs we mark this as an error. Otherwise
		// there is only an error if we have visited the arc before.
		if ci.Inline && (arc.IsDynamic || equalDeref(r.Arc, arc)) {
			n.reportCycleError()
			return ci, true
		}

		// We have a reference cycle, as distinguished from a structural
		// cycle. Reference cycles represent equality, and thus are equal
		// to top. We can stop processing here.
		// var nn1, nn2 *Vertex
		// if u := r.Node.state.underlay; u != nil {
		// 	nn1 = u.node
		// }
		// if u := n.node.state.underlay; u != nil {
		// 	nn2 = u.node
		// }
		if equalDeref(r.Node, n.node) {
			return ci, true
		}

		depth = r.Depth
		found = true

		// Mark all conjuncts of this Vertex that refer to the same node as
		// cyclic. This is an extra safety measure to ensure that two conjuncts
		// cannot work in tandom to circumvent a cycle. It also tightens
		// structural cycle detection in some cases. Late detection of cycles
		// can result in a lot of redundant work.
		//
		// TODO: this loop is not on a critical path, but it may be evaluated
		// if it is worthy keeping at some point.
		for i, c := range n.node.Conjuncts {
			if c.CloseInfo.IsCyclic {
				continue
			}
			for rr := c.CloseInfo.Refs; rr != nil; rr = rr.Next {
				// TODO: Is it necessary to find another way to find
				// "parent" conjuncts? This mechanism seems not entirely
				// accurate. Maybe a pointer up to find the root and then
				// "spread" downwards?
				if r.Ref == x && equalDeref(r.Arc, rr.Arc) {
					n.node.Conjuncts[i].CloseInfo.IsCyclic = true
					break
				}
			}
		}

		break
	}

	if arc.state != nil {
		if d := arc.state.evalDepth; d > 0 && d >= n.ctx.optionalMark {
			arc.IsCyclic = true
		}
	}

	// The code in this switch statement registers structural cycles caught
	// through EvaluatingArcs to the root of the cycle. This way, any node
	// referencing this value can track these nodes early. This is mostly an
	// optimization to shorten the path for which structural cycles are
	// detected, which may be critical for performance.
outer:
	switch arc.status {
	case evaluatingArcs: // also  Evaluating?
		if arc.state.evalDepth < n.ctx.optionalMark {
			break
		}

		// The reference may already be there if we had no-cyclic structure
		// invalidating the cycle.
		for r := arc.cyclicReferences; r != nil; r = r.Next {
			if r.Ref == x {
				break outer
			}
		}

		arc.cyclicReferences = &RefNode{
			Arc:  deref(arc),
			Ref:  x,
			Next: arc.cyclicReferences,
		}

	case finalized:
		// Insert cyclic references from found arc, if any.
		for r := arc.cyclicReferences; r != nil; r = r.Next {
			if r.Ref == x {
				// We have detected a cycle, with the only exception if arc is
				// a disjunction, as evaluation always stops at unresolved
				// disjunctions.
				if _, ok := arc.BaseValue.(*Disjunction); !ok {
					found = true
				}
			}
			ci.Refs = &RefNode{
				Arc:  deref(r.Arc),
				Node: deref(n.node),

				Ref:   x,
				Next:  ci.Refs,
				Depth: n.depth,
			}
		}
	}

	// NOTE: we need to add a tracked reference even if arc is not cyclic: it
	// may still cause a cycle that does not refer to a parent node. For
	// instance:
	//
	//      y: [string]: b: y
	//      x: y
	//      x: c: x
	//
	// ->
	//          - in conjuncts
	//             - out conjuncts: these count for cycle detection.
	//      x: {
	//          [string]: <1: y> b: y
	//          c: x
	//      }
	//      x.c: {
	//          <1: y> b: y
	//          <2: x> y
	//             [string]: <3: x, y> b: y
	//          <2: x> c: x
	//      }
	//      x.c.b: {
	//          <1: y> y
	//             [string]: <4: y; Cyclic> b: y
	//          <3: x, y> b: y
	//      }
	//      x.c.b.b: {
	//          <3: x, y> y
	//               [string]: <5: x, y, Cyclic> b: y
	//          <4: y, Cyclic> y
	//               [string]: <5: x, y, Cyclic> b: y
	//      }
	//      x.c.c: { // structural cycle
	//          <3: x, y> b: y
	//          <2: x> x
	//               <6: x, Cyclic>: y
	//                    [string]: <8: x, y; Cyclic> b: y
	//               <7: x, Cyclic>: c: x
	//      }
	//      x.c.c.b: { // structural cycle
	//          <3: x, y> y
	//               [string]: <3: x, y; Cyclic> b: y
	//          <8: x, y; Cyclic> y
	//      }
	// ->
	//      x: [string]: b: y
	//      x: c: b: y
	//      x: c: [string]: b: y
	//      x: c: b: b: y
	//      x: c: b: [string]: b: y
	//      x: c: b: b: b: y
	//      ....       // structural cycle 1
	//      x: c: c: x // structural cycle 2
	//
	// Note that in this example there is a structural cycle at x.c.c, but we
	// would need go guarantee that cycle is detected before the algorithm
	// descends into x.c.b.
	if !found || depth != n.depth {
		// Adding this in case there is a definite cycle is unnecessary, but
		// gives somewhat better error messages.
		// We also need to add the reference again if the depth differs, as
		// the depth is used for tracking "new structure".
		// var nn *Vertex
		// if u := n.node.state.underlay; u != nil {
		// 	nn = u.node
		// }
		ci.Refs = &RefNode{
			Arc:   deref(arc),
			Ref:   x,
			Node:  deref(n.node),
			Next:  ci.Refs,
			Depth: n.depth,
		}
	}

	if !found && arc.status != evaluatingArcs {
		// No cycle.
		return ci, false
	}

	// TODO: consider if we should bail if a cycle is detected using this
	// mechanism. Ultimately, especially when the old evaluator is removed
	// and the status field purged, this should be used instead of the above.
	// if !found && arc.state.evalDepth < n.ctx.optionalMark {
	// 	// No cycle.
	// 	return ci, false
	// }

	alreadyCycle := ci.IsCyclic
	ci.IsCyclic = true

	// TODO: depth might legitimately be 0 if it is a root vertex.
	// In the worst case, this may lead to a spurious cycle.
	// Fix this by ensuring the root vertex starts with a depth of 1, for
	// instance.
	if depth > 0 {
		// Look for evidence of "new structure" to invalidate the cycle.
		// This is done by checking for non-cyclic conjuncts between the
		// current vertex up to the ancestor to which the reference points.
		// Note that the cyclic conjunct may not be marked as such, so we
		// look for at least one other non-cyclic conjunct if this is the case.
		upCount := n.depth - depth
		for p := n.node.Parent; p != nil; p = p.Parent {
			if upCount--; upCount <= 0 {
				break
			}
			a := p.Conjuncts
			count := 0
			for _, c := range a {
				count += getNonCyclicCount(c)
			}
			if !alreadyCycle {
				count--
			}
			if count > 0 {
				return ci, false
			}
		}
	}

	n.hasAnyCyclicConjunct = true
	if !n.hasNonCycle && env != nil {
		// TODO: investigate if we can get rid of cyclicConjuncts in the new
		// evaluator.
		v := Conjunct{env, x, ci}
		if n.ctx.isDevVersion() {
			n.node.cc().incDependent(n.ctx, DEFER, nil)
		}
		n.cyclicConjuncts = append(n.cyclicConjuncts, cyclicConjunct{v, arc})
		return ci, true
	}

	return ci, false
}

func getNonCyclicCount(c Conjunct) int {
	switch a, ok := c.x.(*ConjunctGroup); {
	case ok:
		count := 0
		for _, c := range *a {
			count += getNonCyclicCount(c)
		}
		return count

	case !c.CloseInfo.IsCyclic:
		return 1

	default:
		return 0
	}
}

// updateCyclicStatusV3 looks for proof of non-cyclic conjuncts to override
// a structural cycle.
func (n *nodeContext) updateCyclicStatusV3(c CloseInfo) {
	if !c.IsCyclic {
		n.hasNonCycle = true
		for _, c := range n.cyclicConjuncts {
			ci := c.c.CloseInfo
			ci.cc = n.node.rootCloseContext(n.ctx)
			n.scheduleVertexConjuncts(c.c, c.arc, ci)
			n.node.cc().decDependent(n.ctx, DEFER, nil)
		}
		n.cyclicConjuncts = n.cyclicConjuncts[:0]
	}
}

// updateCyclicStatus looks for proof of non-cyclic conjuncts to override
// a structural cycle.
func (n *nodeContext) updateCyclicStatus(c CloseInfo) {
	unreachableForDev(n.ctx)

	if !c.IsCyclic {
		n.hasNonCycle = true
		for _, c := range n.cyclicConjuncts {
			n.addVertexConjuncts(c.c, c.arc, false)
		}
		n.cyclicConjuncts = n.cyclicConjuncts[:0]
	}
}

func assertStructuralCycleV3(n *nodeContext) bool {
	// TODO: is this the right place to put it?
	for range n.cyclicConjuncts {
		n.node.cc().decDependent(n.ctx, DEFER, nil)
	}
	n.cyclicConjuncts = n.cyclicConjuncts[:0]

	if n.hasOnlyCyclicConjuncts() {
		n.reportCycleError()
		return true
	}
	return false
}

func assertStructuralCycle(n *nodeContext) bool {
	if n.hasAnyCyclicConjunct && !n.hasNonCycle {
		n.reportCycleError()
		return true
	}
	return false
}

func (n *nodeContext) reportCycleError() {
	b := &Bottom{
		Code:  StructuralCycleError,
		Err:   n.ctx.Newf("structural cycle"),
		Value: n.node.Value(),
		Node:  n.node,
		// TODO: probably, this should have the referenced arc.
	}
	n.setBaseValue(CombineErrors(nil, n.node.Value(), b))
	n.node.Arcs = nil
}

// makeAnonymousConjunct creates a conjunct that tracks self-references when
// evaluating an expression.
//
// Example:
// TODO:
func makeAnonymousConjunct(env *Environment, x Expr, refs *RefNode) Conjunct {
	return Conjunct{
		env, x, CloseInfo{CycleInfo: CycleInfo{
			Inline: true,
			Refs:   refs,
		}},
	}
}

// incDepth increments the evaluation depth. This should typically be called
// before descending into a child node.
func (n *nodeContext) incDepth() {
	n.ctx.evalDepth++
}

// decDepth decrements the evaluation depth. It should be paired with a call to
// incDepth and be called after the processing of child nodes is done.
func (n *nodeContext) decDepth() {
	n.ctx.evalDepth--
}

// markOptional marks that we are about to process an "optional element" that
// allows errors. In these cases, structural cycles are not "terminal".
//
// Examples of such constructs are:
//
// Optional fields:
//
//	a: b?: a
//
// Pattern constraints:
//
//	a: [string]: a
//
// Disjunctions:
//
//	a: b: null | a
//
// A call to markOptional should be paired with a call to unmarkOptional.
func (n *nodeContext) markOptional() (saved int) {
	saved = n.ctx.evalDepth
	n.ctx.optionalMark = n.ctx.evalDepth
	return saved
}

// See markOptional.
func (n *nodeContext) unmarkOptional(saved int) {
	n.ctx.optionalMark = saved
}

// markDepth assigns the current evaluation depth to the receiving node.
// Any previously assigned depth is saved and returned and should be restored
// using unmarkDepth after processing n.
//
// When a node is encountered with a depth set to a non-zero value this
// indicates a cycle. The cycle is an evaluation cycle when the node's depth
// is equal to the current depth and a structural cycle otherwise.
func (n *nodeContext) markDepth() (saved int) {
	saved = n.evalDepth
	n.evalDepth = n.ctx.evalDepth
	return saved
}

// See markDepth.
func (n *nodeContext) unmarkDepth(saved int) {
	n.evalDepth = saved
}
