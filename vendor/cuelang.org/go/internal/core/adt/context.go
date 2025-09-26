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
	"log"
	"reflect"
	"regexp"
	"sort"
	"strings"

	"github.com/cockroachdb/apd/v3"
	"golang.org/x/text/encoding/unicode"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/stats"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/cuedebug"
)

// DebugSort specifies that arcs be sorted consistently between implementations.
//
//	0: default
//	1: sort by Feature: this should be consistent between implementations where
//		   there is no change in the compiler and indexing code.
//	2: alphabetical
//
// TODO: move to DebugFlags
var DebugSort int

func DebugSortArcs(c *OpContext, n *Vertex) {
	if n.IsList() {
		return
	}
	switch a := n.Arcs; DebugSort {
	case 1:
		sort.SliceStable(a, func(i, j int) bool {
			return a[i].Label < a[j].Label
		})
	case 2:
		sort.SliceStable(a, func(i, j int) bool {
			return a[i].Label.SelectorString(c.Runtime) <
				a[j].Label.SelectorString(c.Runtime)
		})
	}
}

func DebugSortFields(c *OpContext, a []Feature) {
	switch DebugSort {
	case 1:
		sort.SliceStable(a, func(i, j int) bool {
			return a[i] < a[j]
		})
	case 2:
		sort.SliceStable(a, func(i, j int) bool {
			return a[i].SelectorString(c.Runtime) <
				a[j].SelectorString(c.Runtime)
		})
	}
}

// Assert panics if the condition is false. Assert can be used to check for
// conditions that are considers to break an internal variant or unexpected
// condition, but that nonetheless probably will be handled correctly down the
// line. For instance, a faulty condition could lead to error being caught
// down the road, but resulting in an inaccurate error message. In production
// code it is better to deal with the bad error message than to panic.
//
// It is advisable for each use of Assert to document how the error is expected
// to be handled down the line.
func Assertf(c *OpContext, b bool, format string, args ...interface{}) {
	if c.Strict && !b {
		panic(fmt.Sprintf("assertion failed: "+format, args...))
	}
}

// Assertf either panics or reports an error to c if the condition is not met.
func (c *OpContext) Assertf(pos token.Pos, b bool, format string, args ...interface{}) {
	if !b {
		if c.Strict {
			panic(fmt.Sprintf("assertion failed: "+format, args...))
		}
		c.addErrf(0, pos, format, args...)
	}
}

func init() {
	log.SetFlags(log.Lshortfile)
}

var pMap = map[*Vertex]int{}

func (c *OpContext) Logf(v *Vertex, format string, args ...interface{}) {
	if c.LogEval == 0 {
		return
	}
	if v == nil {
		s := fmt.Sprintf(strings.Repeat("..", c.nest)+format, args...)
		_ = log.Output(2, s)
		return
	}
	p := pMap[v]
	if p == 0 {
		p = len(pMap) + 1
		pMap[v] = p
	}
	a := append([]interface{}{
		strings.Repeat("..", c.nest),
		p,
		v.Label.SelectorString(c),
		v.Path(),
	}, args...)
	for i := 2; i < len(a); i++ {
		switch x := a[i].(type) {
		case Node:
			a[i] = c.Str(x)
		case Feature:
			a[i] = x.SelectorString(c)
		}
	}
	s := fmt.Sprintf("%s [%d] %s/%v"+format, a...)
	_ = log.Output(2, s)
}

// PathToString creates a pretty-printed path of the given list of features.
func (c *OpContext) PathToString(path []Feature) string {
	var b strings.Builder
	for i, f := range path {
		if i > 0 {
			b.WriteByte('.')
		}
		b.WriteString(f.SelectorString(c))
	}
	return b.String()
}

// Runtime defines an interface for low-level representation conversion and
// lookup.
type Runtime interface {
	// StringIndexer allows for converting string labels to and from a
	// canonical numeric representation.
	StringIndexer

	// LoadImport loads a unique Vertex associated with a given import path. It
	// returns nil if no import for this package could be found.
	LoadImport(importPath string) *Vertex

	// StoreType associates a CUE expression with a Go type.
	StoreType(t reflect.Type, src ast.Expr, expr Expr)

	// LoadType retrieves a previously stored CUE expression for a given Go
	// type if available.
	LoadType(t reflect.Type) (src ast.Expr, expr Expr, ok bool)

	// ConfigureOpCtx configures the [*OpContext] with details such as
	// evaluator version, debug options etc.
	ConfigureOpCtx(ctx *OpContext)
}

type Config struct {
	Runtime
	Format func(Runtime, Node) string
}

// New creates an operation context.
func New(v *Vertex, cfg *Config) *OpContext {
	if cfg.Runtime == nil {
		panic("nil Runtime")
	}

	ctx := &OpContext{
		Runtime:     cfg.Runtime,
		Format:      cfg.Format,
		vertex:      v,
		taskContext: schedConfig,
	}
	cfg.Runtime.ConfigureOpCtx(ctx)
	ctx.stats.EvalVersion = ctx.Version
	if v != nil {
		ctx.e = &Environment{Up: nil, Vertex: v}
	}
	return ctx
}

// See also: [unreachableForDev]
func (c *OpContext) isDevVersion() bool {
	if c.Version == internal.EvalVersionUnset {
		panic("OpContext was not provided with an evaluator version")
	}
	return c.Version == internal.DevVersion
}

// An OpContext implements CUE's unification operation. It only
// operates on values that are created with the Runtime with which an OpContext
// is associated. An OpContext is not goroutine safe and only one goroutine may
// use an OpContext at a time.
type OpContext struct {
	Runtime
	Format func(Runtime, Node) string

	cuedebug.Config
	Version  internal.EvaluatorVersion // Copied from Runtime
	TopoSort bool                      // Copied from Runtime

	taskContext

	nest int

	stats        stats.Counts
	freeListNode *nodeContext

	e         *Environment
	ci        CloseInfo
	src       ast.Node
	errs      *Bottom
	positions []Node // keep track of error positions

	// vertex is used to determine the path location in case of error. Turning
	// this into a stack could also allow determining the cyclic path for
	// structural cycle errors.
	vertex *Vertex

	// list of vertices that need to be finalized.
	// TODO: remove this again once we have a proper way of detecting references
	// across optional boundaries in hasAncestorV3. We can probably do this
	// with an optional depth counter.
	toFinalize []*Vertex

	// These fields are used associate scratch fields for computing closedness
	// of a Vertex. These fields could have been included in StructInfo (like
	// Tomabechi's unification algorithm), but we opted for an indirection to
	// allow concurrent unification.
	//
	// TODO(perf): have two generations: one for each pass of the closedness
	// algorithm, so that the results of the first pass can be reused for all
	// features of a node.
	generation int
	closed     map[*closeInfo]*closeStats
	todo       *closeStats

	// evalDepth indicates the current depth of evaluation. It is used to
	// detect structural cycles and their severity.s
	evalDepth int

	// optionalMark indicates the evalDepth at which the last optional field,
	// pattern constraint or other construct that may contain errors was
	// encountered. A value of 0 indicates we are not within such field.
	optionalMark int

	// inDisjunct indicates that non-monotonic checks should be skipped.
	// This is used if we want to do some extra work to eliminate disjunctions
	// early. The result of unification should be thrown away if this check is
	// used.
	//
	// TODO: replace this with a mechanism to determine the correct set (per
	// conjunct) of StructInfos to include in closedness checking.
	inDisjunct int

	// inConstaint overrides inDisjunct as field matching should always be
	// enabled.
	inConstraint int

	// inDetached indicates that inline structs evaluated in the current context
	// should never be shared. This is the case, for instance, with the source
	// for the for clause in a comprehension.
	inDetached int

	// inValidator defines whether full evaluation need to be enforced, for
	// instance when comparing against bottom.
	inValidator int

	// The current call is a validator. A builtin may return a boolean false
	// along with an error message describing a validation error. If the latter
	// is wrapped in an internal.ValidationError, it will only be interpreted
	// as an error if this is true.
	// TODO: strictly separate validators and functions.
	IsValidator bool

	// ErrorGraphs contains an analysis, represented as a Mermaid graph, for
	// each node that has an error.
	ErrorGraphs map[string]string
}

func (c *OpContext) CloseInfo() CloseInfo { return c.ci }

func (n *nodeContext) skipNonMonotonicChecks() bool {
	if n.ctx.inConstraint > 0 {
		return false
	}
	return n.ctx.inDisjunct > 0
}

// Impl is for internal use only. This will go.
func (c *OpContext) Impl() Runtime {
	return c.Runtime
}

func (c *OpContext) Pos() token.Pos {
	if c.src == nil {
		return token.NoPos
	}
	return c.src.Pos()
}

func (c *OpContext) Source() ast.Node {
	return c.src
}

// NewContext creates an operation context.
func NewContext(r Runtime, v *Vertex) *OpContext {
	return New(v, &Config{Runtime: r})
}

func (c *OpContext) pos() token.Pos {
	if c.src == nil {
		return token.NoPos
	}
	return c.src.Pos()
}

func (c *OpContext) spawn(node *Vertex) *Environment {
	return spawn(c.e, node)
}

func spawn(env *Environment, node *Vertex) *Environment {
	return &Environment{
		Up:     env,
		Vertex: node,
	}
}

func (c *OpContext) Env(upCount int32) *Environment {
	return c.e.up(c, upCount)
}

func (c *OpContext) relNode(upCount int32) *Vertex {
	e := c.e.up(c, upCount)
	c.unify(e.Vertex, oldOnly(partial))
	return e.Vertex
}

func (c *OpContext) relLabel(upCount int32) Feature {
	// locate current label.
	e := c.e.up(c, upCount)
	return e.DynamicLabel
}

func (c *OpContext) concreteIsPossible(op Op, x Expr) bool {
	if !AssertConcreteIsPossible(op, x) {
		// No need to take position of expression.
		c.AddErr(c.NewPosf(token.NoPos,
			"invalid operand %s ('%s' requires concrete value)", x, op))
		return false
	}
	return true
}

// Assert that the given expression can evaluate to a concrete value.
func AssertConcreteIsPossible(op Op, x Expr) bool {
	switch v := x.(type) {
	case *Bottom:
	case *BoundExpr:
		return false
	case Value:
		return v.Concreteness() == Concrete
	}
	return true
}

// HasErr reports whether any error was reported, including whether value
// was incomplete.
func (c *OpContext) HasErr() bool {
	return c.errs != nil
}

func (c *OpContext) Err() *Bottom {
	b := c.errs
	c.errs = nil
	return b
}

func (c *OpContext) addErrf(code ErrorCode, pos token.Pos, msg string, args ...interface{}) {
	err := c.NewPosf(pos, msg, args...)
	c.addErr(code, err)
}

func (c *OpContext) addErr(code ErrorCode, err errors.Error) {
	c.AddBottom(&Bottom{
		Code: code,
		Err:  err,
		Node: c.vertex,
	})
}

// AddBottom records an error in OpContext.
func (c *OpContext) AddBottom(b *Bottom) {
	c.errs = CombineErrors(c.src, c.errs, b)
}

// AddErr records an error in OpContext. It returns errors collected so far.
func (c *OpContext) AddErr(err errors.Error) *Bottom {
	if err != nil {
		c.AddBottom(&Bottom{
			Err:  err,
			Node: c.vertex,
		})
	}
	return c.errs
}

// NewErrf creates a *Bottom value and returns it. The returned uses the
// current source as the point of origin of the error.
func (c *OpContext) NewErrf(format string, args ...interface{}) *Bottom {
	// TODO: consider renaming ot NewBottomf: this is now confusing as we also
	// have Newf.
	err := c.Newf(format, args...)
	return &Bottom{
		Src:  c.src,
		Err:  err,
		Code: EvalError,
		Node: c.vertex,
	}
}

// AddErrf records an error in OpContext. It returns errors collected so far.
func (c *OpContext) AddErrf(format string, args ...interface{}) *Bottom {
	return c.AddErr(c.Newf(format, args...))
}

type frame struct {
	env *Environment
	err *Bottom
	src ast.Node
	ci  CloseInfo
}

func (c *OpContext) PushState(env *Environment, src ast.Node) (saved frame) {
	saved.env = c.e
	saved.err = c.errs
	saved.src = c.src
	saved.ci = c.ci

	c.errs = nil
	if src != nil {
		c.src = src
	}
	c.e = env

	return saved
}

func (c *OpContext) PushConjunct(x Conjunct) (saved frame) {
	src := x.Expr().Source()

	saved.env = c.e
	saved.err = c.errs
	saved.src = c.src
	saved.ci = c.ci

	c.errs = nil
	if src != nil {
		c.src = src
	}
	c.e = x.Env
	c.ci = x.CloseInfo

	return saved
}

func (c *OpContext) PopState(s frame) *Bottom {
	err := c.errs
	c.e = s.env
	c.errs = s.err
	c.src = s.src
	c.ci = s.ci
	return err
}

// PushArc signals c that arc v is currently being processed for the purpose
// of error reporting. PopArc should be called with the returned value once
// processing of v is completed.
func (c *OpContext) PushArc(v *Vertex) (saved *Vertex) {
	c.vertex, saved = v, c.vertex
	return saved
}

// PopArc signals completion of processing the current arc.
func (c *OpContext) PopArc(saved *Vertex) {
	c.vertex = saved
}

// Resolve finds a node in the tree.
//
// Should only be used to insert Conjuncts. TODO: perhaps only return Conjuncts
// and error.
func (c *OpContext) Resolve(x Conjunct, r Resolver) (*Vertex, *Bottom) {
	return c.resolveState(x, r, final(finalized, allKnown))
}

func (c *OpContext) resolveState(x Conjunct, r Resolver, state combinedFlags) (*Vertex, *Bottom) {
	s := c.PushConjunct(x)

	arc := r.resolve(c, state)

	err := c.PopState(s)
	if err != nil {
		return nil, err
	}

	if arc.ChildErrors != nil && arc.ChildErrors.Code == StructuralCycleError {
		return nil, arc.ChildErrors
	}

	// Dereference any vertices that do not contribute to more knownledge about
	// the node.
	arc = arc.DerefNonRooted()

	return arc, err
}

// Lookup looks up r in env without further resolving the value.
func (c *OpContext) Lookup(env *Environment, r Resolver) (*Vertex, *Bottom) {
	s := c.PushState(env, r.Source())

	arc := r.resolve(c, oldOnly(partial))

	err := c.PopState(s)

	if arc != nil && !c.isDevVersion() {
		// TODO(deref): lookup should probably not use DerefValue, but
		// rather only dereference disjunctions.
		arc = arc.DerefValue()
	}

	return arc, err
}

// Validate calls validates value for the given validator.
//
// TODO(errors): return boolean instead: only the caller has enough information
// to generate a proper error message.
func (c *OpContext) Validate(check Conjunct, value Value) *Bottom {
	// TODO: use a position stack to push both values.

	// TODO(evalv3): move to PushConjunct once the migration is complete.
	// Using PushConjunct also saves and restores the error, which may be
	// impactful, so we want to do this in a separate commit.
	// saved := c.PushConjunct(check)

	src := c.src
	ci := c.ci
	c.src = check.Source()
	c.ci = check.CloseInfo

	err := check.x.(Validator).validate(c, value)

	c.src = src
	c.ci = ci

	return err
}

// concrete returns the concrete value of x after evaluating it.
// msg is used to mention the context in which an error occurred, if any.
func (c *OpContext) concrete(env *Environment, x Expr, msg interface{}) (result Value, complete bool) {
	s := c.PushState(env, x.Source())

	state := require(partial, concreteKnown)
	w := c.evalState(x, state)
	_ = c.PopState(s)

	w, ok := c.getDefault(w)
	if !ok {
		return w, false
	}
	v := Unwrap(w)

	complete = w != nil
	if !IsConcrete(v) {
		complete = false
		b := c.NewErrf("non-concrete value %v in operand to %s", w, msg)
		b.Code = IncompleteError
		v = b
	}

	return v, complete
}

// getDefault resolves a disjunction to a single value. If there is no default
// value, or if there is more than one default value, it reports an "incomplete"
// error and return false. In all other cases it will return true, even if
// v is already an error. v may be nil, in which case it will also return nil.
func (c *OpContext) getDefault(v Value) (result Value, ok bool) {
	var d *Disjunction
	switch x := v.(type) {
	default:
		return v, true

	case *Vertex:
		// TODO: return vertex if not disjunction.
		switch t := x.BaseValue.(type) {
		case *Disjunction:
			d = t

		case *Vertex:
			return c.getDefault(t)

		default:
			return x, true
		}

	case *Disjunction:
		d = x
	}

	if d.NumDefaults != 1 {
		c.addErrf(IncompleteError, c.pos(),
			"unresolved disjunction %v (type %s)", d, d.Kind())
		return nil, false
	}
	return c.getDefault(d.Values[0])
}

// Evaluate evaluates an expression within the given environment and indicates
// whether the result is complete. It will always return a non-nil result.
func (c *OpContext) Evaluate(env *Environment, x Expr) (result Value, complete bool) {
	s := c.PushState(env, x.Source())

	val := c.evalState(x, final(partial, concreteKnown))

	complete = true

	if err, _ := val.(*Bottom); err != nil && err.IsIncomplete() {
		complete = false
	}
	if val == nil {
		complete = false
		// TODO ENSURE THIS DOESN"T HAPPEN>
		val = &Bottom{
			Code: IncompleteError,
			Err:  c.Newf("UNANTICIPATED ERROR"),
			Node: env.Vertex,
		}

	}

	_ = c.PopState(s)

	if !complete || val == nil {
		return val, false
	}

	return val, true
}

// EvaluateKeepState does an evaluate, but leaves any errors an cycle info
// within the context.
func (c *OpContext) EvaluateKeepState(x Expr) (result Value) {
	src := c.src
	c.src = x.Source()

	result, ci := c.evalStateCI(x, final(partial, concreteKnown))

	c.src = src
	c.ci = ci

	return result
}

func (c *OpContext) evaluateRec(v Conjunct, state combinedFlags) Value {
	x := v.Expr()
	s := c.PushConjunct(v)

	val := c.evalState(x, state)
	if val == nil {
		// Be defensive: this never happens, but just in case.
		Assertf(c, false, "nil return value: unspecified error")
		val = &Bottom{
			Code: IncompleteError,
			Err:  c.Newf("UNANTICIPATED ERROR"),
			Node: c.vertex,
		}
	}
	_ = c.PopState(s)

	return val
}

// value evaluates expression v within the current environment. The result may
// be nil if the result is incomplete. value leaves errors untouched to that
// they can be collected by the caller.
func (c *OpContext) value(x Expr, state combinedFlags) (result Value) {
	v := c.evalState(x, state)

	v, _ = c.getDefault(v)
	v = Unwrap(v)
	return v
}

func (c *OpContext) evalState(v Expr, state combinedFlags) (result Value) {
	result, _ = c.evalStateCI(v, state)
	return result
}

func (c *OpContext) evalStateCI(v Expr, state combinedFlags) (result Value, ci CloseInfo) {
	savedSrc := c.src
	c.src = v.Source()
	err := c.errs
	c.errs = nil
	// Save the old CloseInfo and restore after evaluate to avoid detecting
	// spurious cycles.
	saved := c.ci

	defer func() {
		c.errs = CombineErrors(c.src, c.errs, err)

		if v, ok := result.(*Vertex); ok {
			if b := v.Bottom(); b != nil {
				switch b.Code {
				case IncompleteError:
				case CycleError:
					if state.vertexStatus() == partial || c.isDevVersion() {
						break
					}
					fallthrough
				default:
					result = b
				}
			}
		}

		// TODO: remove this when we handle errors more principally.
		if b, ok := result.(*Bottom); ok {
			result = c.wrapCycleError(c.src, b)
			if c.errs != result {
				c.errs = CombineErrors(c.src, c.errs, result)
			}
		}
		if c.errs != nil {
			result = c.errs
		}
		c.src = savedSrc

		// TODO(evalv3): this c.ci should be passed to the caller who may need
		// it to continue cycle detection for partially evaluated values.
		// Either this or we must prove that this is covered by structural cycle
		// detection.
		c.ci = saved
	}()

	switch x := v.(type) {
	case Value:
		return x, c.ci

	case Evaluator:
		v := x.evaluate(c, state)
		return v, c.ci

	case Resolver:
		arc := x.resolve(c, state)
		if c.HasErr() {
			return nil, c.ci
		}
		if arc == nil {
			return nil, c.ci
		}
		// TODO(deref): what is the right level of dereferencing here?
		// DerefValue seems to work too.
		arc = arc.DerefNonShared()

		// TODO: consider moving this after markCycle, depending on how we
		// implement markCycle, or whether we need it at all.
		// TODO: is this indirect necessary?
		// arc = arc.Indirect()

		n := arc.state
		if c.isDevVersion() {
			n = arc.getState(c)
			if n != nil {
				c.ci, _ = n.detectCycleV3(arc, nil, x, c.ci)
			}
		} else {
			if n != nil {
				c.ci, _ = n.markCycle(arc, nil, x, c.ci)
			}
		}
		c.ci.Inline = true

		if c.isDevVersion() {
			if s := arc.getState(c); s != nil {
				needs := state.conditions()
				runMode := state.runMode()

				arc.unify(c, needs|arcTypeKnown, attemptOnly) // to set scalar

				if runMode == finalize {
					// arc.unify(c, needs, attemptOnly) // to set scalar
					// Freeze node.
					arc.state.freeze(needs)
				} else {
					arc.unify(c, needs, runMode)
				}

				v := arc
				if v.ArcType == ArcPending {
					if v.status == evaluating {
						for ; v.Parent != nil && v.ArcType == ArcPending; v = v.Parent {
						}
						err := c.Newf("cycle with field %v", x)
						b := &Bottom{Code: CycleError, Err: err}
						s.setBaseValue(b)
						return b, c.ci
						// TODO: use this instead, as is usual for incomplete errors,
						// and also move this block one scope up to also apply to
						// defined arcs. In both cases, though, doing so results in
						// some errors to be misclassified as evaluation error.
						// c.AddBottom(b)
						// return nil
					}
					c.undefinedFieldError(v, IncompleteError)
					return nil, c.ci
				}
			}
		}
		v := c.evaluate(arc, x, state)

		return v, c.ci

	default:
		// This can only happen, really, if v == nil, which is not allowed.
		panic(fmt.Sprintf("unexpected Expr type %T", v))
	}
}

// wrapCycleError converts the sentinel cycleError in a concrete one with
// position information.
func (c *OpContext) wrapCycleError(src ast.Node, b *Bottom) *Bottom {
	if src != nil &&
		b.Code == CycleError &&
		len(errors.Positions(b.Err)) == 0 {
		bb := *b
		bb.Err = errors.Wrapf(b.Err, src.Pos(), "")
		b = &bb
	}
	return b
}

// unifyNode returns a possibly partially evaluated node value.
//
// TODO: maybe return *Vertex, *Bottom
func (c *OpContext) unifyNode(v Expr, state combinedFlags) (result Value) {
	savedSrc := c.src
	c.src = v.Source()
	err := c.errs
	c.errs = nil

	defer func() {
		c.errs = CombineErrors(c.src, c.errs, err)

		if v, ok := result.(*Vertex); ok {
			if b := v.Bottom(); b != nil && !b.IsIncomplete() {
				result = b
			}
		}

		// TODO: remove this when we handle errors more principally.
		if b, ok := result.(*Bottom); ok {
			if c.src != nil &&
				b.Code == CycleError &&
				b.Err.Position() == token.NoPos &&
				len(b.Err.InputPositions()) == 0 {
				bb := *b
				bb.Err = errors.Wrapf(b.Err, c.src.Pos(), "")
				result = &bb
			}
			c.errs = CombineErrors(c.src, c.errs, result)
		}
		if c.errs != nil {
			result = c.errs
		}
		c.src = savedSrc
	}()

	switch x := v.(type) {
	case Value:
		return x

	case Evaluator:
		v := x.evaluate(c, state)
		return v

	case Resolver:
		v := x.resolve(c, state)
		if c.HasErr() {
			return nil
		}
		if v == nil {
			return nil
		}
		v = v.DerefValue()

		// TODO: consider moving this after markCycle, depending on how we
		// implement markCycle, or whether we need it at all.
		// TODO: is this indirect necessary?
		// v = v.Indirect()

		if c.isDevVersion() {
			if n := v.getState(c); n != nil {
				// A lookup counts as new structure. See the commend in Section
				// "Lookups in inline cycles" in cycle.go.
				n.hasNonCycle = true

				// Always yield to not get spurious errors.
				n.process(arcTypeKnown, yield)
			}
		} else {
			if v.isUndefined() || state.vertexStatus() > v.Status() {
				c.unify(v, state)
			}
		}

		return v

	default:
		// This can only happen, really, if v == nil, which is not allowed.
		panic(fmt.Sprintf("unexpected Expr type %T", v))
	}
}

func (c *OpContext) lookup(x *Vertex, pos token.Pos, l Feature, flags combinedFlags) *Vertex {
	if c.isDevVersion() {
		return x.lookup(c, pos, l, flags)
	}

	state := flags.vertexStatus()

	if l == InvalidLabel || x == nil {
		// TODO: is it possible to have an invalid label here? Maybe through the
		// API?
		return &Vertex{}
	}

	// var kind Kind
	// if x.BaseValue != nil {
	// 	kind = x.BaseValue.Kind()
	// }

	switch x.BaseValue.(type) {
	case *StructMarker:
		if l.Typ() == IntLabel {
			c.addErrf(0, pos, "invalid struct selector %v (type int)", l)
			return nil
		}

	case *ListMarker:
		switch {
		case l.Typ() == IntLabel:
			switch {
			case l.Index() < 0:
				c.addErrf(0, pos, "invalid list index %v (index must be non-negative)", l)
				return nil
			case l.Index() > len(x.Arcs):
				c.addErrf(0, pos, "invalid list index %v (out of bounds)", l)
				return nil
			}

		case l.IsDef(), l.IsHidden(), l.IsLet():

		default:
			c.addErrf(0, pos, "invalid list index %v (type string)", l)
			return nil
		}

	case nil:
		// c.addErrf(IncompleteError, pos, "incomplete value %s", x)
		// return nil

	case *Bottom:

	default:
		kind := x.BaseValue.Kind()
		if kind&(ListKind|StructKind) != 0 {
			// c.addErrf(IncompleteError, pos,
			// 	"cannot look up %s in incomplete type %s (type %s)",
			// 	l, x.Source(), kind)
			// return nil
		} else if !l.IsDef() && !l.IsHidden() && !l.IsLet() {
			c.addErrf(0, pos,
				"invalid selector %v for value of type %s", l, kind)
			return nil
		}
	}

	a := x.Lookup(l)

	var hasCycle bool

	if a != nil {
		// Ensure that a's status is at least of the required level. Otherwise,
		// ensure that any remaining unprocessed conjuncts are processed by
		// calling c.Unify(a, Partial). The ensures that need to rely on
		// hasAllConjuncts, but that are finalized too early, get conjuncts
		// processed beforehand.
		if state > a.status {
			c.unify(a, deprecated(c, state))
		} else if a.state != nil {
			c.unify(a, deprecated(c, partial))
		}

		// TODO(refRequired): see comment in unify.go:Vertex.lookup near the
		// namesake TODO.
		if a.ArcType == ArcOptional {
			code := IncompleteError
			if hasCycle {
				code = CycleError
			}
			label := l.SelectorString(c.Runtime)
			c.AddBottom(&Bottom{
				Code:      code,
				Permanent: x.status >= conjuncts,
				Err: c.NewPosf(pos,
					"cannot reference optional field: %s", label),
				Node: x,
			})
		}
	} else {
		if x.state != nil {
			x.state.assertInitialized()

			for _, e := range x.state.exprs {
				if isCyclePlaceholder(e.err) {
					hasCycle = true
				}
			}
		}
		code := IncompleteError
		// As long as we have incomplete information, we cannot mark the
		// inability to look up a field as "final", as it may resolve down the
		// line.
		permanent := x.status >= conjuncts
		if m, _ := x.BaseValue.(*ListMarker); m != nil && !m.IsOpen {
			permanent = true
		}
		if (state > partial || permanent) && !x.Accept(c, l) {
			code = 0
		} else if hasCycle {
			code = CycleError
		}
		// TODO: if the struct was a literal struct, we can also treat it as
		// closed and make this a permanent error.
		label := l.SelectorString(c.Runtime)

		// TODO(errors): add path reference and make message
		//       "undefined field %s in %s"
		var err *ValueError
		switch {
		case isCyclePlaceholder(x.BaseValue):
			err = c.NewPosf(pos, "cycle error referencing %s", label)
			permanent = false
		case l.IsInt():
			err = c.NewPosf(pos, "index out of range [%d] with length %d",
				l.Index(), len(x.Elems()))
		default:
			err = c.NewPosf(pos, "undefined field: %s", label)
		}
		c.AddBottom(&Bottom{
			Code:      code,
			Permanent: permanent,
			Err:       err,
			Node:      x,
		})
	}
	return a
}

func (c *OpContext) undefinedFieldError(v *Vertex, code ErrorCode) {
	label := v.Label.SelectorString(c)
	c.addErrf(code, c.pos(), "undefined field: %s", label)
}

func (c *OpContext) Label(src Expr, x Value) Feature {
	return LabelFromValue(c, src, x)
}

func (c *OpContext) typeError(v Value, k Kind) {
	if isError(v) {
		return
	}
	if !IsConcrete(v) && v.Kind()&k != 0 {
		c.addErrf(IncompleteError, pos(v), "incomplete %s: %s", k, v)
	} else {
		c.AddErrf("cannot use %s (type %s) as type %s", v, v.Kind(), k)
	}
}

func (c *OpContext) typeErrorAs(v Value, k Kind, as interface{}) {
	if as == nil {
		c.typeError(v, k)
		return
	}
	if isError(v) {
		return
	}
	if !IsConcrete(v) && v.Kind()&k != 0 {
		c.addErrf(IncompleteError, pos(v),
			"incomplete %s in %v: %s", k, as, v)
	} else {
		c.AddErrf("cannot use %s (type %s) as type %s in %v", v, v.Kind(), k, as)
	}
}

var emptyNode = &Vertex{}

func pos(x Node) token.Pos {
	if x.Source() == nil {
		return token.NoPos
	}
	return x.Source().Pos()
}

func (c *OpContext) node(orig Node, x Expr, scalar bool, state combinedFlags) *Vertex {
	// TODO: always get the vertex. This allows a whole bunch of trickery
	// down the line.
	v := c.unifyNode(x, state)

	v, ok := c.getDefault(v)
	if !ok {
		// Error already generated by getDefault.
		return emptyNode
	}

	// The two if blocks below are rather subtle. If we have an error of
	// the sentinel value cycle, we have earlier determined that the cycle is
	// allowed and that it can be ignored here. Any other CycleError is an
	// annotated cycle error that could be taken as is.
	// TODO: do something simpler.
	if scalar {
		if w := Unwrap(v); !isCyclePlaceholder(w) {
			v = w
		}
	}

	node, ok := v.(*Vertex)
	if ok && !isCyclePlaceholder(node.BaseValue) {
		v = node.Value()
	}

	switch nv := v.(type) {
	case nil:
		c.addErrf(IncompleteError, pos(x),
			"%s undefined (%s is incomplete)", orig, x)
		return emptyNode

	case *Bottom:
		// TODO: this is a bit messy. In some cases errors are already added
		// and in some cases not. Not a huge deal, as errors will be uniqued
		// down the line, but could be better.
		c.AddBottom(nv)
		return emptyNode

	case *Vertex:
		if node == nil {
			panic("unexpected markers with nil node")
		}

	default:
		if kind := v.Kind(); kind&StructKind != 0 {
			c.addErrf(IncompleteError, pos(x),
				"%s undefined as %s is incomplete (type %s)", orig, x, kind)
			return emptyNode

		} else if !ok {
			c.addErrf(0, pos(x), // TODO(error): better message.
				"invalid operand %s (found %s, want list or struct)",
				x.Source(), v.Kind())
			return emptyNode
		}
	}

	return node
}

// Elems returns the evaluated elements of a list.
func (c *OpContext) Elems(v Value) []*Vertex {
	list := c.list(v)
	list.Finalize(c)
	return list.Elems()
}

// RawElems returns the elements of the list without evaluating them.
func (c *OpContext) RawElems(v Value) []*Vertex {
	list := c.list(v)
	return list.Elems()
}

func (c *OpContext) list(v Value) *Vertex {
	if v != nil {
		if a, ok := c.getDefault(v); ok {
			v = a
		}
	}
	x, ok := v.(*Vertex)
	if !ok || !x.IsList() {
		c.typeError(v, ListKind)
		return emptyNode
	}
	return x
}

func (c *OpContext) scalar(v Value) Value {
	v = Unwrap(v)
	switch v.(type) {
	case *Null, *Bool, *Num, *String, *Bytes:
	default:
		c.typeError(v, ScalarKinds)
	}
	return v
}

var zero = &Num{K: NumberKind}

func (c *OpContext) Num(v Value, as interface{}) *Num {
	v = Unwrap(v)
	if isError(v) {
		return zero
	}
	x, ok := v.(*Num)
	if !ok {
		c.typeErrorAs(v, NumberKind, as)
		return zero
	}
	return x
}

func (c *OpContext) Int64(v Value) int64 {
	v = Unwrap(v)
	if isError(v) {
		return 0
	}
	x, ok := v.(*Num)
	if !ok {
		c.typeError(v, IntKind)
		return 0
	}
	i, err := x.X.Int64()
	if err != nil {
		c.AddErrf("number is not an int64: %v", err)
		return 0
	}
	return i
}

func (c *OpContext) uint64(v Value, as string) uint64 {
	v = Unwrap(v)
	if isError(v) {
		return 0
	}
	x, ok := v.(*Num)
	if !ok {
		c.typeErrorAs(v, IntKind, as)
		return 0
	}
	if x.X.Negative {
		// TODO: improve message
		c.AddErrf("cannot convert negative number to uint64")
		return 0
	}
	if !x.X.Coeff.IsUint64() {
		// TODO: improve message
		c.AddErrf("cannot convert number %s to uint64", &x.X)
		return 0
	}
	return x.X.Coeff.Uint64()
}

func (c *OpContext) BoolValue(v Value) bool {
	return c.boolValue(v, nil)
}

func (c *OpContext) boolValue(v Value, as interface{}) bool {
	v = Unwrap(v)
	if isError(v) {
		return false
	}
	x, ok := v.(*Bool)
	if !ok {
		c.typeErrorAs(v, BoolKind, as)
		return false
	}
	return x.B
}

func (c *OpContext) StringValue(v Value) string {
	return c.stringValue(v, nil)
}

// ToBytes returns the bytes value of a scalar value.
func (c *OpContext) ToBytes(v Value) []byte {
	if x, ok := v.(*Bytes); ok {
		return x.B
	}
	return []byte(c.ToString(v))
}

// ToString returns the string value of a scalar value.
func (c *OpContext) ToString(v Value) string {
	return c.toStringValue(v, StringKind|NumberKind|BytesKind|BoolKind, nil)

}

func (c *OpContext) stringValue(v Value, as interface{}) string {
	return c.toStringValue(v, StringKind, as)
}

func (c *OpContext) toStringValue(v Value, k Kind, as interface{}) string {
	v = Unwrap(v)
	if isError(v) {
		return ""
	}
	if v.Kind()&k == 0 {
		if as == nil {
			c.typeError(v, k)
		} else {
			c.typeErrorAs(v, k, as)
		}
		return ""
	}
	switch x := v.(type) {
	case *String:
		return x.Str

	case *Bytes:
		return bytesToString(x.B)

	case *Num:
		return x.X.String()

	case *Bool:
		if x.B {
			return "true"
		}
		return "false"

	default:
		c.addErrf(IncompleteError, c.pos(),
			"non-concrete value %s (type %s)", v, v.Kind())
	}
	return ""
}

func bytesToString(b []byte) string {
	b, _ = unicode.UTF8.NewDecoder().Bytes(b)
	return string(b)
}

func (c *OpContext) bytesValue(v Value, as interface{}) []byte {
	v = Unwrap(v)
	if isError(v) {
		return nil
	}
	x, ok := v.(*Bytes)
	if !ok {
		c.typeErrorAs(v, BytesKind, as)
		return nil
	}
	return x.B
}

var matchNone = regexp.MustCompile("^$")

func (c *OpContext) regexp(v Value) *regexp.Regexp {
	v = Unwrap(v)
	if isError(v) {
		return matchNone
	}
	switch x := v.(type) {
	case *String:
		if x.RE != nil {
			return x.RE
		}
		// TODO: synchronization
		p, err := regexp.Compile(x.Str)
		if err != nil {
			// FatalError? How to cache error
			c.AddErrf("invalid regexp: %s", err)
			x.RE = matchNone
		} else {
			x.RE = p
		}
		return x.RE

	case *Bytes:
		if x.RE != nil {
			return x.RE
		}
		// TODO: synchronization
		p, err := regexp.Compile(string(x.B))
		if err != nil {
			c.AddErrf("invalid regexp: %s", err)
			x.RE = matchNone
		} else {
			x.RE = p
		}
		return x.RE

	default:
		c.typeError(v, StringKind|BytesKind)
		return matchNone
	}
}

// newNum creates a new number of the given kind. It reports an error value
// instead if any error occurred.
func (c *OpContext) newNum(d *apd.Decimal, k Kind, sources ...Node) Value {
	if c.HasErr() {
		return c.Err()
	}
	return &Num{Src: c.src, X: *d, K: k}
}

func (c *OpContext) NewInt64(n int64, sources ...Node) Value {
	if c.HasErr() {
		return c.Err()
	}
	d := apd.New(n, 0)
	return &Num{Src: c.src, X: *d, K: IntKind}
}

func (c *OpContext) NewString(s string) Value {
	if c.HasErr() {
		return c.Err()
	}
	return &String{Src: c.src, Str: s}
}

func (c *OpContext) newBytes(b []byte) Value {
	if c.HasErr() {
		return c.Err()
	}
	return &Bytes{Src: c.src, B: b}
}

func (c *OpContext) newBool(b bool) Value {
	if c.HasErr() {
		return c.Err()
	}
	return &Bool{Src: c.src, B: b}
}

func (c *OpContext) newList(src ast.Node, parent *Vertex) *Vertex {
	return c.newInlineVertex(parent, &ListMarker{})
}

// Str reports a debug string of x.
func (c *OpContext) Str(x Node) string {
	if c.Format == nil {
		return fmt.Sprintf("%T", x)
	}
	return c.Format(c.Runtime, x)
}

// NewList returns a new list for the given values.
func (c *OpContext) NewList(values ...Value) *Vertex {
	// TODO: consider making this a literal list instead.
	list := &ListLit{}
	v := c.newInlineVertex(nil, nil, Conjunct{Env: nil, x: list})

	for _, x := range values {
		list.Elems = append(list.Elems, x)
	}
	v.Finalize(c)
	return v
}
