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

// Package dep analyzes dependencies between values.
package dep

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
)

// Dependencies
//
// A dependency is a reference relation from one Vertex to another. A Vertex
// has multiple Conjuncts, each of which is associated with an expression.
// Each expression, in turn, may have multiple references, each representing
// a single dependency.
//
// A reference that occurs in a node will point to another node. A reference
// `x.y` may point to a node `x.y` as well as `x`. By default, only the most
// precise node is reported, which is `x.y` if it exists, or `x` otherwise.
// In the latter case, a path is associated with the reference to indicate
// the specific non-existing path that is needed for that dependency. (TODO)
//
// A single reference may point to multiple nodes. For instance,
// (a & b).z may point to both `a.z` and `b.z`. This has to be taken into
// account if dep is used for substitutions.
//
//
//   field: Conjunct
//             |
//           Expr                       Conjunct Expression
//             |- Reference             A reference to led to a target
//             |-    \- Target Node     Pointed to by Reference
//             |-         \- UsedPath   The sole path used within Node

// TODO: verify that these concepts are correctly reflected in the API:
// Source:
//     The CUE value for which dependencies are analyzed.
//     This may differ per dependency for dynamic and transitive analysis.
// Target:
//     The field to which the found reference resolves.
// Reference:
//     The reference that resolved to the dependency.
//     Replacing this reference in the conjuncts of the source vertex with a
//     link to the target vertex yields the same result if there only a single
//     dependency matching this reference.
// Conjunct:
//     The conjunct in which the Reference was found.
// Used Path:
//     The target vertex may be a parent of the actual, more precise,
//     dependency, if the latter does not yet exist. The target path is the path
//     from the target vertex to the actual dependency.
// Trace:
//     A sequence of dependencies leading to the result in case of transitive
//     dependencies.

// TODO: for a public API, a better approach seems to be to have a single
// Visit method, with a configuration to set a bunch of orthogonal options.
// Here are some examples of the options:
//   - Dynamic:    evaluate and descend into computed fields.
//   - Recurse:    evaluate dependencies of subfields as well.
//   - Inner:      report dependencies within the root being visited.
//   - RootLess:   report dependencies that do not have a path to the root.
//   - Transitive: get all dependencies, not just the direct ones.
//   - Substitute: do not get precise dependencies, but rather keep them
//         such that each expression needs to be replaced with at most
//         one dependency. Could be a method on Dependency.
//   - ContinueOnError:  continue visiting even if there are errors.
//   [add more as they come up]
//

type Config struct {
	// Dynamic enables evaluting dependencies Vertex Arcs, recursively
	Dynamic bool

	// Descend enables recursively descending into fields. This option is
	// implied by Dynamic.
	Descend bool

	// Cycles allows a Node to reported more than once. This includes the node
	// passed to Visit, which is otherwise never reported. This option can be
	// used to disable cycle checking. TODO: this is not yet implemented.
	AllowCycles bool

	// Rootless enables reporting nodes that do not have a path from the root.
	// This includes variables of comprehensions and fields of composite literal
	// values that are part of expressions, such as {out: v}.out.
	Rootless bool

	// TODO:
	// ContinueOnError indicates whether to continue finding dependencies
	// even when there are errors.
	// ContinueOnError bool

	//  pkg indicates the main package for which the analyzer is configured,
	// which is used for reporting purposes.
	Pkg *adt.ImportReference
}

// A Dependency is a reference and the node that reference resolves to.
type Dependency struct {
	// Node is the referenced node.
	Node *adt.Vertex

	// Reference is the expression that referenced the node.
	Reference adt.Resolver

	pkg *adt.ImportReference

	top bool

	visitor *visitor
}

// Recurse visits the dependencies of d.Node, using the same visit function as
// the original.
func (d *Dependency) Recurse() {
	savedAll := d.visitor.all
	savedTop := d.visitor.top
	savedMarked := d.visitor.marked
	d.visitor.all = d.visitor.recurse
	d.visitor.top = true
	d.visitor.marked = nil

	d.visitor.visitReusingVisitor(d.Node, false)

	d.visitor.all = savedAll
	d.visitor.top = savedTop
	d.visitor.marked = savedMarked
}

// Import returns the import reference or nil if the reference was within
// the same package as the visited Vertex.
func (d *Dependency) Import() *adt.ImportReference {
	return d.pkg
}

// IsRoot reports whether the dependency is referenced by the root of the
// original Vertex passed to any of the Visit* functions, and not one of its
// descendent arcs. This always returns true for [Visit].
func (d *Dependency) IsRoot() bool {
	return d.top
}

func importRef(r adt.Expr) *adt.ImportReference {
	switch x := r.(type) {
	case *adt.ImportReference:
		return x
	case *adt.SelectorExpr:
		return importRef(x.X)
	case *adt.IndexExpr:
		return importRef(x.X)
	}
	return nil
}

// VisitFunc is used for reporting dependencies.
type VisitFunc func(Dependency) error

var empty *adt.Vertex

func init() {
	// TODO: Consider setting a non-nil BaseValue.
	empty = &adt.Vertex{}
	empty.ForceDone()
}

var zeroConfig = &Config{}

// Visit calls f for the dependencies of n as determined by the given
// configuration.
func Visit(cfg *Config, c *adt.OpContext, n *adt.Vertex, f VisitFunc) error {
	if cfg == nil {
		cfg = zeroConfig
	}
	if c == nil {
		panic("nil context")
	}
	v := visitor{
		ctxt:       c,
		fn:         f,
		pkg:        cfg.Pkg,
		recurse:    cfg.Descend,
		all:        cfg.Descend,
		top:        true,
		cfgDynamic: cfg.Dynamic,
	}
	return v.visitReusingVisitor(n, true)
}

// visitReusingVisitor is factored out of Visit so that we may reuse visitor.
func (v *visitor) visitReusingVisitor(n *adt.Vertex, top bool) error {
	if v.cfgDynamic {
		if v.marked == nil {
			v.marked = marked{}
		}
		v.marked.markExpr(n)

		v.dynamic(n, top)
	} else {
		v.visit(n, top)
	}
	return v.err
}

func (v *visitor) visit(n *adt.Vertex, top bool) (err error) {
	savedNode := v.node
	savedTop := v.top

	v.node = n
	v.top = top

	defer func() {
		v.node = savedNode
		v.top = savedTop

		switch x := recover(); x {
		case nil:
		case aborted:
			err = v.err
		default:
			panic(x)
		}
	}()

	n.VisitLeafConjuncts(func(x adt.Conjunct) bool {
		v.markExpr(x.Env, x.Elem())
		return true
	})

	return nil
}

var aborted = errors.New("aborted")

type visitor struct {
	ctxt *adt.OpContext
	fn   VisitFunc
	node *adt.Vertex
	err  error
	pkg  *adt.ImportReference

	// recurse indicates whether, during static analysis, to process references
	// that will be unified into different fields.
	recurse bool
	// all indicates wether to process references that would be unified into
	// different fields. This similar to recurse, but sometimes gets temporarily
	// overridden to deal with special cases.
	all       bool
	top       bool
	topRef    adt.Resolver
	pathStack []refEntry
	numRefs   int // count of reported dependencies

	// cfgDynamic is kept from the original config.
	cfgDynamic bool

	marked marked
}

type refEntry struct {
	env *adt.Environment
	ref adt.Resolver
}

// TODO: factor out the below logic as either a low-level dependency analyzer or
// some walk functionality.

// markExpr visits all nodes in an expression to mark dependencies.
func (c *visitor) markExpr(env *adt.Environment, expr adt.Elem) {
	if expr, ok := expr.(adt.Resolver); ok {
		c.markResolver(env, expr)
		return
	}

	saved := c.topRef
	c.topRef = nil
	defer func() { c.topRef = saved }()

	switch x := expr.(type) {
	case nil:
	case *adt.BinaryExpr:
		c.markExpr(env, x.X)
		c.markExpr(env, x.Y)

	case *adt.UnaryExpr:
		c.markExpr(env, x.X)

	case *adt.Interpolation:
		for i := 1; i < len(x.Parts); i += 2 {
			c.markExpr(env, x.Parts[i])
		}

	case *adt.BoundExpr:
		c.markExpr(env, x.Expr)

	case *adt.CallExpr:
		c.markExpr(env, x.Fun)
		saved := c.all
		c.all = true
		for _, a := range x.Args {
			c.markExpr(env, a)
		}
		c.all = saved

	case *adt.DisjunctionExpr:
		for _, d := range x.Values {
			c.markExpr(env, d.Val)
		}

	case *adt.SliceExpr:
		c.markExpr(env, x.X)
		c.markExpr(env, x.Lo)
		c.markExpr(env, x.Hi)
		c.markExpr(env, x.Stride)

	case *adt.ListLit:
		env := &adt.Environment{Up: env, Vertex: empty}
		for _, e := range x.Elems {
			switch x := e.(type) {
			case *adt.Comprehension:
				c.markComprehension(env, x)

			case adt.Expr:
				c.markSubExpr(env, x)

			case *adt.Ellipsis:
				if x.Value != nil {
					c.markSubExpr(env, x.Value)
				}
			}
		}

	case *adt.StructLit:
		env := &adt.Environment{Up: env, Vertex: empty}
		for _, e := range x.Decls {
			c.markDecl(env, e)
		}

	case *adt.Comprehension:
		c.markComprehension(env, x)
	}
}

// markResolve resolves dependencies.
func (c *visitor) markResolver(env *adt.Environment, r adt.Resolver) {
	// Note: it is okay to pass an empty CloseInfo{} here as we assume that
	// all nodes are finalized already and we need neither closedness nor cycle
	// checks.
	ref, _ := c.ctxt.Resolve(adt.MakeConjunct(env, r, adt.CloseInfo{}), r)

	// TODO: consider the case where an inlined composite literal does not
	// resolve, but has references. For instance, {a: k, ref}.b would result
	// in a failure during evaluation if b is not defined within ref. However,
	// ref might still specialize to allow b.

	if ref != nil {
		c.reportDependency(env, r, ref)
		return
	}

	// It is possible that a reference cannot be resolved because it is
	// incomplete. In this case, we should check whether subexpressions of the
	// reference can be resolved to mark those dependencies. For instance,
	// prefix paths of selectors and the value or index of an index expression
	// may independently resolve to a valid dependency.

	switch x := r.(type) {
	case *adt.NodeLink:
		panic("unreachable")

	case *adt.IndexExpr:
		c.markExpr(env, x.X)
		c.markExpr(env, x.Index)

	case *adt.SelectorExpr:
		c.markExpr(env, x.X)
	}
}

// reportDependency reports a dependency from r to v.
// v must be the value that is obtained after resolving r.
func (c *visitor) reportDependency(env *adt.Environment, ref adt.Resolver, v *adt.Vertex) {
	if v == c.node || v == empty {
		return
	}

	reference := ref
	if c.topRef == nil && len(c.pathStack) == 0 {
		saved := c.topRef
		c.topRef = ref
		defer func() { c.topRef = saved }()
	}

	// TODO: in "All" mode we still report the latest reference used, instead
	// of the reference at the start of the traversal, as the self-contained
	// algorithm (its only user) depends on it.
	// However, if the stack is non-nil, the reference will not correctly
	// reflect the substituted value, so we use the top reference instead.
	if !c.recurse && len(c.pathStack) == 0 && c.topRef != nil {
		reference = c.topRef
	}

	inspect := false

	if c.ctxt.Version == internal.DevVersion {
		inspect = v.IsDetached() || !v.MayAttach()
	} else {
		inspect = !v.Rooted()
	}

	if inspect {
		// TODO: there is currently no way to inspect where a non-rooted node
		// originated from. As of EvalV3, we allow non-rooted nodes to be
		// structure shared. This makes them effectively rooted, with the
		// difference that there is an indirection in BaseValue for the
		// structure sharing. Nonetheless, this information is lost in the
		// internal API when traversing.

		// As an alternative we now do not skip processing the node if we
		// an inlined, non-rooted node is associated with another node than
		// the one we are currently processing.

		// If a node is internal, we need to further investigate any references.
		// If there are any, reference, even if it is otherwise not reported,
		// we report this reference.
		before := c.numRefs
		c.markInternalResolvers(env, ref, v)
		// TODO: this logic could probably be simplified if we let clients
		// explicitly mark whether to visit rootless nodes. Visiting these
		// may be necessary when substituting values.
		switch _, ok := ref.(*adt.FieldReference); {
		case !ok && c.isLocal(env, ref):
			// 	Do not report rootless nodes for selectors.
			return
		case c.numRefs > before:
			// For FieldReferences that resolve to something we do not need
			// to report anything intermediate.
			return
		}
	}
	if hasLetParent(v) {
		return
	}

	// Expand path.
	altRef := reference
	for i := len(c.pathStack) - 1; i >= 0; i-- {
		x := c.pathStack[i]
		var w *adt.Vertex
		// TODO: instead of setting the reference, the proper thing to do is
		// to record a path that still needs to be selected into the recorded
		// dependency. See the Target Path definition at the top of the file.
		if f := c.feature(x.env, x.ref); f != 0 {
			w = v.Lookup(f)
		}
		if w == nil {
			break
		}
		altRef = x.ref
		if i == 0 && c.topRef != nil {
			altRef = c.topRef
		}
		v = w
	}
	if inspect && len(c.pathStack) == 0 && c.topRef != nil {
		altRef = c.topRef
	}

	// All resolvers are expressions.
	if p := importRef(ref.(adt.Expr)); p != nil {
		savedPkg := c.pkg
		c.pkg = p
		defer func() { c.pkg = savedPkg }()
	}

	c.numRefs++

	if c.ctxt.Version == internal.DevVersion {
		v.Finalize(c.ctxt)
	}

	d := Dependency{
		Node:      v,
		Reference: altRef,
		pkg:       c.pkg,
		top:       c.top,
		visitor:   c,
	}
	if err := c.fn(d); err != nil {
		c.err = err
		panic(aborted)
	}
}

// isLocal reports whether a non-rooted struct is an internal node or not.
// If it is not, we need to further investigate any references.
func (c *visitor) isLocal(env *adt.Environment, r adt.Resolver) bool {
	for {
		switch x := r.(type) {
		case *adt.FieldReference:
			for i := 0; i < int(x.UpCount); i++ {
				env = env.Up
			}
			return env.Vertex == empty
		case *adt.SelectorExpr:
			r, _ = x.X.(adt.Resolver)
		case *adt.IndexExpr:
			r, _ = x.X.(adt.Resolver)
		default:
			return env.Vertex == empty
		}
	}
}

// TODO(perf): make this available as a property of vertices to avoid doing
// work repeatedly.
func hasLetParent(v *adt.Vertex) bool {
	for ; v != nil; v = v.Parent {
		if v.Label.IsLet() {
			return true
		}
	}
	return false
}

// markConjuncts transitively marks all reference of the current node.
func (c *visitor) markConjuncts(v *adt.Vertex) {
	v.VisitLeafConjuncts(func(x adt.Conjunct) bool {
		// Use Elem instead of Expr to preserve the Comprehension to, in turn,
		// ensure an Environment is inserted for the Value clause.
		c.markExpr(x.Env, x.Elem())
		return true
	})
}

// markInternalResolvers marks dependencies for rootless nodes. As these
// nodes may not be visited during normal traversal, we need to be more
// proactive. For selectors and indices this means we need to evaluate their
// objects to see exactly what the selector or index refers to.
func (c *visitor) markInternalResolvers(env *adt.Environment, r adt.Resolver, v *adt.Vertex) {
	if v.Rooted() {
		panic("node must not be rooted")
	}

	saved := c.all // recursive traversal already done by this function.

	// As lets have no path and we otherwise will not process them, we set
	// processing all to true.
	if c.marked != nil && hasLetParent(v) {
		v.VisitLeafConjuncts(func(x adt.Conjunct) bool {
			c.marked.markExpr(x.Expr())
			return true
		})
	}

	c.markConjuncts(v)

	// evaluateInner will already process all values recursively, so disable
	// while processing in this case.
	c.all = false

	switch r := r.(type) {
	case *adt.SelectorExpr:
		c.evaluateInner(env, r.X, r)
	case *adt.IndexExpr:
		c.evaluateInner(env, r.X, r)
	}

	c.all = saved
}

// evaluateInner evaluates the LHS of the given selector or index expression,
// and marks all its conjuncts. The reference is pushed on a stack to mark
// the field or index that needs to be selected for any dependencies that are
// subsequently encountered. This is handled by reportDependency.
func (c *visitor) evaluateInner(env *adt.Environment, x adt.Expr, r adt.Resolver) {
	value, _ := c.ctxt.Evaluate(env, x)
	v, _ := value.(*adt.Vertex)
	if v == nil {
		return
	}
	// TODO(perf): one level of  evaluation would suffice.
	v.Finalize(c.ctxt)

	saved := len(c.pathStack)
	c.pathStack = append(c.pathStack, refEntry{env, r})
	c.markConjuncts(v)
	c.pathStack = c.pathStack[:saved]
}

func (c *visitor) feature(env *adt.Environment, r adt.Resolver) adt.Feature {
	switch r := r.(type) {
	case *adt.SelectorExpr:
		return r.Sel
	case *adt.IndexExpr:
		v, _ := c.ctxt.Evaluate(env, r.Index)
		v = adt.Unwrap(v)
		return adt.LabelFromValue(c.ctxt, r.Index, v)
	default:
		return adt.InvalidLabel
	}
}

func (c *visitor) markSubExpr(env *adt.Environment, x adt.Expr) {
	if c.all {
		saved := c.top
		c.top = false
		c.markExpr(env, x)
		c.top = saved
	}
}

func (c *visitor) markDecl(env *adt.Environment, d adt.Decl) {
	switch x := d.(type) {
	case *adt.Field:
		c.markSubExpr(env, x.Value)

	case *adt.BulkOptionalField:
		c.markExpr(env, x.Filter)
		// when dynamic, only continue if there is evidence of
		// the field in the parallel actual evaluation.
		c.markSubExpr(env, x.Value)

	case *adt.DynamicField:
		c.markExpr(env, x.Key)
		// when dynamic, only continue if there is evidence of
		// a matching field in the parallel actual evaluation.
		c.markSubExpr(env, x.Value)

	case *adt.Comprehension:
		c.markComprehension(env, x)

	case adt.Expr:
		c.markExpr(env, x)

	case *adt.Ellipsis:
		if x.Value != nil {
			c.markSubExpr(env, x.Value)
		}
	}
}

func (c *visitor) markComprehension(env *adt.Environment, y *adt.Comprehension) {
	env = c.markClauses(env, y.Clauses)

	// Use "live" environments if we have them. This is important if
	// dependencies are computed on a partially evaluated value where a pushed
	// down comprehension is defined outside the root of the dependency
	// analysis. For instance, when analyzing dependencies at path a.b in:
	//
	//  a: {
	//      for value in { test: 1 } {
	//          b: bar: value
	//      }
	//  }
	//
	if envs := y.Envs(); len(envs) > 0 {
		// We use the Environment to get access to the parent chain. It
		// suffices to take any Environment (in this case the first), as all
		// will have the same parent chain.
		env = envs[0]
	}
	for i := y.Nest(); i > 0; i-- {
		env = &adt.Environment{Up: env, Vertex: empty}
	}
	// TODO: consider using adt.EnvExpr and remove the above loop.
	c.markExpr(env, adt.ToExpr(y.Value))
}

func (c *visitor) markClauses(env *adt.Environment, a []adt.Yielder) *adt.Environment {
	for _, y := range a {
		switch x := y.(type) {
		case *adt.ForClause:
			c.markExpr(env, x.Src)
			env = &adt.Environment{Up: env, Vertex: empty}
			// In dynamic mode, iterate over all actual value and
			// evaluate.

		case *adt.LetClause:
			c.markExpr(env, x.Expr)
			env = &adt.Environment{Up: env, Vertex: empty}

		case *adt.IfClause:
			c.markExpr(env, x.Condition)
			// In dynamic mode, only continue if condition is true.

		case *adt.ValueClause:
			env = &adt.Environment{Up: env, Vertex: empty}
		}
	}
	return env
}
