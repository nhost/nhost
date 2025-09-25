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
	"bytes"
	"fmt"
	"regexp"

	"github.com/cockroachdb/apd/v3"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

var _ Elem = &ConjunctGroup{}

// A ConjunctGroup is an Elem that is used for internal grouping of Conjuncts
// only.
type ConjunctGroup []Conjunct

func (g *ConjunctGroup) Source() ast.Node {
	return nil
}

// A StructLit represents an unevaluated struct literal or file body.
type StructLit struct {
	Src   ast.Node // ast.File or ast.StructLit
	Decls []Decl

	// TODO: record the merge order somewhere.

	// The below fields are redundant to Decls and are computed with Init.

	// field marks the optional conjuncts of all explicit Fields.
	// Required Fields are marked as empty
	Fields []FieldInfo

	Dynamic []*DynamicField

	// excluded are all literal fields that already exist.
	Bulk []*BulkOptionalField

	Additional  []*Ellipsis
	HasEmbed    bool
	IsOpen      bool // has a ...
	initialized bool

	types OptionalType

	// administrative fields like hasreferences.
	// hasReferences bool
}

func (o *StructLit) IsFile() bool {
	_, ok := o.Src.(*ast.File)
	return ok
}

type FieldInfo struct {
	Label Feature
}

func (x *StructLit) HasOptional() bool {
	return x.types&(HasPattern|HasAdditional) != 0
}

func (x *StructLit) Source() ast.Node { return x.Src }

func (x *StructLit) evaluate(c *OpContext, state combinedFlags) Value {
	e := c.Env(0)
	v := c.newInlineVertex(e.Vertex, nil, Conjunct{e, x, c.ci})
	// evaluate may not finalize a field, as the resulting value may be
	// used in a context where more conjuncts are added. It may also lead
	// to disjuncts being in a partially expanded state, leading to
	// misaligned nodeContexts.

	// TODO(evalv3): to be fully compatible correct, we should not always
	// finalize the arcs here. This is a temporary fix. For now, we have to do
	// this as we need a mechanism to set the arcTypeKnown bit without
	// finalizing the arcs, as they may depend on the completion of sub fields.
	// See, for instance:
	//
	// 		chainSuccess: a: {
	// 			raises?: {}
	// 			if raises == _|_ {
	// 				ret: a: 1
	// 			}
	// 			ret?: {}
	// 			if ret != _|_ {
	// 				foo: a: 1
	// 			}
	// 		}
	//
	// This would also require changing the arcType process in ForClause.yield.
	//
	// v.completeArcs(c, state)

	v.CompleteArcsOnly(c)
	return v
}

// TODO: remove this method
func (o *StructLit) MarkField(f Feature) {
	o.Fields = append(o.Fields, FieldInfo{Label: f})
}

func (o *StructLit) Init(ctx *OpContext) {
	if o.initialized {
		return
	}
	o.initialized = true

	if ctx.isDevVersion() {
		return
	}

	for _, d := range o.Decls {
		switch x := d.(type) {
		case *Field:
			if o.fieldIndex(x.Label) < 0 {
				o.Fields = append(o.Fields, FieldInfo{Label: x.Label})
			}
			if x.ArcType > ArcMember {
				o.types |= HasField
			}

		case *LetField:
			if o.fieldIndex(x.Label) >= 0 {
				panic("duplicate let identifier")
			}
			o.Fields = append(o.Fields, FieldInfo{Label: x.Label})

		case *DynamicField:
			o.Dynamic = append(o.Dynamic, x)
			o.types |= HasDynamic

		case Expr:
			o.HasEmbed = true

		case *Comprehension:
			o.HasEmbed = true

		case *LetClause:
			o.HasEmbed = true

		case *BulkOptionalField:
			o.Bulk = append(o.Bulk, x)
			o.types |= HasPattern
			switch x.Filter.(type) {
			case *BasicType, *Top:
			default:
				o.types |= HasComplexPattern
			}

		case *Ellipsis:
			switch x.Value.(type) {
			case nil, *Top:
				o.IsOpen = true
				o.types |= IsOpen

			default:
				// TODO: consider only adding for non-top.
				o.types |= HasAdditional
			}
			o.Additional = append(o.Additional, x)

		default:
			panic("unreachable")
		}
	}
}

func (o *StructLit) fieldIndex(f Feature) int {
	for i := range o.Fields {
		if o.Fields[i].Label == f {
			return i
		}
	}
	return -1
}

func (o *StructLit) OptionalTypes() OptionalType {
	return o.types
}

// FIELDS
//
// Fields can also be used as expressions whereby the value field is the
// expression this allows retaining more context.

// Field represents a regular field or field constraint with a fixed label.
// The label can be a regular field, definition or hidden field.
//
//	foo: bar
//	#foo: bar
//	_foo: bar
type Field struct {
	Src *ast.Field

	ArcType ArcType
	Label   Feature
	Value   Expr
}

func (x *Field) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

// A LetField represents a field that is only visible in the local scope.
//
//	let X = expr
type LetField struct {
	Src   *ast.LetClause
	Label Feature
	// IsMulti is true when this let field should be replicated for each
	// incarnation. This is the case when its expression refers to the
	// variables of a for comprehension embedded within a struct.
	IsMulti bool
	Value   Expr
}

func (x *LetField) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

// A BulkOptionalField represents a set of optional field.
//
//	[expr]: expr
type BulkOptionalField struct {
	Src    *ast.Field // Ellipsis or Field
	Filter Expr
	Value  Expr
	Label  Feature // for reference and formatting
}

func (x *BulkOptionalField) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

// A Ellipsis represents a set of optional fields of a given type.
//
//	...T
type Ellipsis struct {
	Src   *ast.Ellipsis
	Value Expr
}

func (x *Ellipsis) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

// A DynamicField represents a regular field for which the key is computed.
//
//	"\(expr)": expr
//	(expr): expr
type DynamicField struct {
	Src *ast.Field

	ArcType ArcType
	Key     Expr
	Value   Expr
}

func (x *DynamicField) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

// A ListLit represents an unevaluated list literal.
//
//	[a, for x in src { ... }, b, ...T]
type ListLit struct {
	Src *ast.ListLit

	// scalars, comprehensions, ...T
	Elems []Elem

	info *StructLit // Shared closedness info.
}

func (x *ListLit) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *ListLit) evaluate(c *OpContext, state combinedFlags) Value {
	e := c.Env(0)
	// Pass conditions but at least set fieldSetKnown.
	v := c.newInlineVertex(e.Vertex, nil, Conjunct{e, x, c.ci})
	v.CompleteArcsOnly(c)

	// TODO(evalv3): evaluating more aggressively yields some improvements, but
	// breaks other tests. Consider using this approach, though.
	// mode := state.runMode()
	// if mode == finalize {
	// 	v.completeArcs(c, allKnown)
	// } else {
	// 	v.completeArcs(c, fieldSetKnown)
	// }
	return v
}

// Null represents null. It can be used as a Value and Expr.
type Null struct {
	Src ast.Node
}

func (x *Null) Source() ast.Node { return x.Src }
func (x *Null) Kind() Kind       { return NullKind }

// Bool is a boolean value. It can be used as a Value and Expr.
type Bool struct {
	Src ast.Node
	B   bool
}

func (x *Bool) Source() ast.Node { return x.Src }
func (x *Bool) Kind() Kind       { return BoolKind }

// Num is a numeric value. It can be used as a Value and Expr.
type Num struct {
	Src ast.Node
	K   Kind        // needed?
	X   apd.Decimal // Is integer if the apd.Decimal is an integer.
}

// TODO: do we need this?
// func NewNumFromString(src ast.Node, s string) Value {
// 	n := &Num{Src: src, K: IntKind}
// 	if strings.ContainsAny(s, "eE.") {
// 		n.K = FloatKind
// 	}
// 	_, _, err := n.X.SetString(s)
// 	if err != nil {
// 		pos := token.NoPos
// 		if src != nil {
// 			pos = src.Pos()
// 		}
// 		return &Bottom{Err: errors.Newf(pos, "invalid number: %v", err)}
// 	}
// 	return n
// }

func (x *Num) Source() ast.Node { return x.Src }
func (x *Num) Kind() Kind       { return x.K }

// TODO: do we still need this?
// func (x *Num) Specialize(k Kind) Value {
// 	k = k & x.K
// 	if k == x.K {
// 		return x
// 	}
// 	y := *x
// 	y.K = k
// 	return &y
// }

// String is a string value. It can be used as a Value and Expr.
type String struct {
	Src ast.Node
	Str string
	RE  *regexp.Regexp // only set if needed
}

func (x *String) Source() ast.Node { return x.Src }
func (x *String) Kind() Kind       { return StringKind }

// Bytes is a bytes value. It can be used as a Value and Expr.
type Bytes struct {
	Src ast.Node
	B   []byte
	RE  *regexp.Regexp // only set if needed
}

func (x *Bytes) Source() ast.Node { return x.Src }
func (x *Bytes) Kind() Kind       { return BytesKind }

// Composites: the evaluated fields of a composite are recorded in the arc
// vertices.

type ListMarker struct {
	Src    ast.Expr
	IsOpen bool
}

func (x *ListMarker) Source() ast.Node { return x.Src }
func (x *ListMarker) Kind() Kind       { return ListKind }
func (x *ListMarker) node()            {}

type StructMarker struct {
	// NeedClose is used to signal that the evaluator should close this struct.
	// It is only set by the close builtin.
	// TODO(evalv3: remove this field. Once we removed this, and also introduced
	// open by default lists, we can get rid of StructMarker and ListMarker
	// in its entirety in favor of using type bit masks.
	NeedClose bool
}

func (x *StructMarker) Source() ast.Node { return nil }
func (x *StructMarker) Kind() Kind       { return StructKind }
func (x *StructMarker) node()            {}

// Top represents all possible values. It can be used as a Value and Expr.
type Top struct{ Src *ast.Ident }

func (x *Top) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}
func (x *Top) Kind() Kind { return TopKind }

// BasicType represents all values of a certain Kind. It can be used as a Value
// and Expr.
//
//	string
//	int
//	num
//	bool
type BasicType struct {
	Src ast.Node
	K   Kind
}

func (x *BasicType) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}
func (x *BasicType) Kind() Kind { return x.K }

// TODO: do we still need this?
// func (x *BasicType) Specialize(k Kind) Value {
// 	k = x.K & k
// 	if k == x.K {
// 		return x
// 	}
// 	y := *x
// 	y.K = k
// 	return &y
// }

// TODO: should we use UnaryExpr for Bound now we have BoundValue?

// BoundExpr represents an unresolved unary comparator.
//
//	<a
//	=~MyPattern
type BoundExpr struct {
	Src  *ast.UnaryExpr
	Op   Op
	Expr Expr
}

func (x *BoundExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *BoundExpr) evaluate(ctx *OpContext, state combinedFlags) Value {
	// scalarKnown is used here to ensure we know the value. The result does
	// not have to be concrete, though.
	v := ctx.value(x.Expr, require(partial, scalarKnown))
	if isError(v) {
		return v
	}

	switch k := v.Kind(); k {
	case IntKind, FloatKind, NumberKind, StringKind, BytesKind:
	case NullKind:
		if x.Op != NotEqualOp {
			err := ctx.NewPosf(pos(x.Expr),
				"cannot use null for bound %s", x.Op)
			return &Bottom{
				Err:  err,
				Node: ctx.vertex,
			}
		}
	default:
		mask := IntKind | FloatKind | NumberKind | StringKind | BytesKind
		if x.Op == NotEqualOp {
			mask |= NullKind
		}
		if k&mask != 0 {
			ctx.addErrf(IncompleteError, token.NoPos, // TODO(errors): use ctx.pos()?
				"non-concrete value %s for bound %s", x.Expr, x.Op)
			return nil
		}
		err := ctx.NewPosf(pos(x.Expr),
			"invalid value %s (type %s) for bound %s", v, k, x.Op)
		return &Bottom{
			Err:  err,
			Node: ctx.vertex,
		}
	}

	if v, ok := x.Expr.(Value); ok {
		if v == nil || v.Concreteness() > Concrete {
			return ctx.NewErrf("bound has fixed non-concrete value")
		}
		return &BoundValue{x.Src, x.Op, v}
	}

	// This simplifies boundary expressions. It is an alternative to an
	// evaluation strategy that makes nodes increasingly more specific.
	//
	// For instance, a completely different implementation would be to allow
	// the presence of a concrete value to ignore incomplete errors.
	//
	// TODO: consider an alternative approach.
	switch y := v.(type) {
	case *BoundValue:
		switch {
		case y.Op == NotEqualOp:
			switch x.Op {
			case LessEqualOp, LessThanOp, GreaterEqualOp, GreaterThanOp:
				// <(!=3)  =>  number
				// Smaller than an arbitrarily large number is any number.
				return &BasicType{K: y.Kind()}
			case NotEqualOp:
				// !=(!=3) ==> 3
				// Not a value that is anything but a given value is that
				// given value.
				return y.Value
			}

		case x.Op == NotEqualOp:
			// Invert if applicable.
			switch y.Op {
			case LessEqualOp:
				return &BoundValue{x.Src, GreaterThanOp, y.Value}
			case LessThanOp:
				return &BoundValue{x.Src, GreaterEqualOp, y.Value}
			case GreaterEqualOp:
				return &BoundValue{x.Src, LessThanOp, y.Value}
			case GreaterThanOp:
				return &BoundValue{x.Src, LessEqualOp, y.Value}
			}

		case (x.Op == LessThanOp || x.Op == LessEqualOp) &&
			(y.Op == GreaterThanOp || y.Op == GreaterEqualOp),
			(x.Op == GreaterThanOp || x.Op == GreaterEqualOp) &&
				(y.Op == LessThanOp || y.Op == LessEqualOp):
			// <(>=3)
			// Something smaller than an arbitrarily large number is any number.
			return &BasicType{K: y.Kind()}

		case x.Op == LessThanOp &&
			(y.Op == LessEqualOp || y.Op == LessThanOp),
			x.Op == GreaterThanOp &&
				(y.Op == GreaterEqualOp || y.Op == GreaterThanOp):
			// <(<=x)  => <x
			// <(<x)   => <x
			// Less than something that is less or equal to x is less than x.
			return &BoundValue{x.Src, x.Op, y.Value}

		case x.Op == LessEqualOp &&
			(y.Op == LessEqualOp || y.Op == LessThanOp),
			x.Op == GreaterEqualOp &&
				(y.Op == GreaterEqualOp || y.Op == GreaterThanOp):
			// <=(<x)   => <x
			// <=(<=x)  => <=x
			// Less or equal than something that is less than x is less than x.
			return y
		}

	case *BasicType:
		switch x.Op {
		case LessEqualOp, LessThanOp, GreaterEqualOp, GreaterThanOp:
			// TODO: this does not seem correct and results in some weird
			// behavior for bounds.
			ctx.addErrf(IncompleteError, token.NoPos,
				"non-concrete value %s for bound %s", x.Expr, x.Op)
			return nil
		}
	}
	if v.Concreteness() > Concrete {
		// TODO(errors): analyze dependencies of x.Expr to get positions.
		ctx.addErrf(IncompleteError, token.NoPos, // TODO(errors): use ctx.pos()?
			"non-concrete value %s for bound %s", x.Expr, x.Op)
		return nil
	}
	return &BoundValue{x.Src, x.Op, v}
}

// A BoundValue is a fully evaluated unary comparator that can be used to
// validate other values.
//
//	<5
//	=~"Name$"
type BoundValue struct {
	Src   ast.Expr
	Op    Op
	Value Value
}

func (x *BoundValue) Source() ast.Node { return x.Src }
func (x *BoundValue) Kind() Kind {
	k := x.Value.Kind()
	switch k {
	case IntKind, FloatKind, NumberKind:
		return NumberKind

	case NullKind:
		if x.Op == NotEqualOp {
			return TopKind &^ NullKind
		}
	}
	return k
}

func (x *BoundValue) validate(c *OpContext, y Value) *Bottom {
	a := y // Can be list or struct.
	b := c.scalar(x.Value)
	if c.HasErr() {
		return c.Err()
	}

	switch v := BinOp(c, x.Op, a, b).(type) {
	case *Bottom:
		return v

	case *Bool:
		if v.B {
			return nil
		}
		// TODO(errors): use "invalid value %v (not an %s)" if x is a
		// predeclared identifier such as `int`.
		err := c.Newf("invalid value %v (out of bound %s)", y, x)
		err.AddPosition(y)
		return &Bottom{
			Src:  c.src,
			Err:  err,
			Code: EvalError,
			Node: c.vertex,
		}

	default:
		panic(fmt.Sprintf("unsupported type %T", v))
	}
}

func (x *BoundValue) validateStr(c *OpContext, a string) bool {
	if str, ok := x.Value.(*String); ok {
		b := str.Str
		switch x.Op {
		case LessEqualOp:
			return a <= b
		case LessThanOp:
			return a < b
		case GreaterEqualOp:
			return a >= b
		case GreaterThanOp:
			return a > b
		case EqualOp:
			return a == b
		case NotEqualOp:
			return a != b
		case MatchOp:
			return c.regexp(x.Value).MatchString(a)
		case NotMatchOp:
			return !c.regexp(x.Value).MatchString(a)
		}
	}
	return x.validate(c, &String{Str: a}) == nil
}

func (x *BoundValue) validateInt(c *OpContext, a int64) bool {
	switch n := x.Value.(type) {
	case *Num:
		b, err := n.X.Int64()
		if err != nil {
			break
		}
		switch x.Op {
		case LessEqualOp:
			return a <= b
		case LessThanOp:
			return a < b
		case GreaterEqualOp:
			return a >= b
		case GreaterThanOp:
			return a > b
		case EqualOp:
			return a == b
		case NotEqualOp:
			return a != b
		}
	}
	return x.validate(c, c.NewInt64(a)) == nil
}

// A NodeLink is used during computation to refer to an existing Vertex.
// It is used to signal a potential cycle or reference.
// Note that a NodeLink may be used as a value. This should be taken into
// account.
type NodeLink struct {
	Node *Vertex
}

func (x *NodeLink) Kind() Kind {
	return x.Node.Kind()
}
func (x *NodeLink) Source() ast.Node { return x.Node.Source() }

func (x *NodeLink) resolve(c *OpContext, state combinedFlags) *Vertex {
	return x.Node
}

// A FieldReference represents a lexical reference to a field.
//
//	a
type FieldReference struct {
	Src     *ast.Ident
	UpCount int32
	Label   Feature
}

func (x *FieldReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *FieldReference) resolve(c *OpContext, state combinedFlags) *Vertex {
	n := c.relNode(x.UpCount)
	pos := pos(x)
	return c.lookup(n, pos, x.Label, state)
}

// A ValueReference represents a lexical reference to a value.
//
// Example: an X referring to
//
//	a: X=b
type ValueReference struct {
	Src     *ast.Ident
	UpCount int32
	Label   Feature // for informative purposes
}

func (x *ValueReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *ValueReference) resolve(c *OpContext, state combinedFlags) *Vertex {
	if x.UpCount == 0 {
		return c.vertex
	}
	n := c.relNode(x.UpCount - 1)
	return n
}

// A LabelReference refers to the string or integer value of a label.
//
// Example: an X referring to
//
//	[X=Pattern]: b: a
type LabelReference struct {
	Src     *ast.Ident
	UpCount int32
}

// TODO: should this implement resolver at all?

func (x *LabelReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *LabelReference) evaluate(ctx *OpContext, state combinedFlags) Value {
	label := ctx.relLabel(x.UpCount)
	if label == 0 {
		// There is no label. This may happen if a LabelReference is evaluated
		// outside of the context of a parent node, for instance if an
		// "additional" items or properties is evaluated in isolation.
		//
		// TODO: this should return the pattern of the label.
		return &BasicType{K: StringKind}
	}
	return label.ToValue(ctx)
}

// A DynamicReference is like a FieldReference, but with a computed label.
//
// Example: an X referring to
//
//	X=(x): v
//	X="\(x)": v
//	X=[string]: v
type DynamicReference struct {
	Src     *ast.Ident
	UpCount int32
	Label   Expr

	// TODO: only use aliases and store the actual expression only in the scope.
	// The feature is unique for every instance. This will also allow dynamic
	// fields to be ordered among normal fields.
	//
	// This could also be used to assign labels to embedded values, if they
	// don't match a label.
	Alias Feature
}

func (x *DynamicReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *DynamicReference) EvaluateLabel(ctx *OpContext, env *Environment) Feature {
	env = env.up(ctx, x.UpCount)
	frame := ctx.PushState(env, x.Src)
	v := ctx.value(x.Label, require(partial, scalarKnown))
	ctx.PopState(frame)
	return ctx.Label(x, v)
}

func (x *DynamicReference) resolve(ctx *OpContext, state combinedFlags) *Vertex {
	e := ctx.Env(x.UpCount)
	frame := ctx.PushState(e, x.Src)
	v := ctx.value(x.Label, require(partial, scalarKnown))
	ctx.PopState(frame)
	f := ctx.Label(x.Label, v)
	return ctx.lookup(e.Vertex, pos(x), f, state)
}

// An ImportReference refers to an imported package.
//
// Example: strings in
//
//	import "strings"
//
//	strings.ToLower("Upper")
type ImportReference struct {
	Src        *ast.Ident
	ImportPath Feature
	Label      Feature // for informative purposes
}

func (x *ImportReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *ImportReference) resolve(ctx *OpContext, state combinedFlags) *Vertex {
	path := x.ImportPath.StringValue(ctx)
	v := ctx.Runtime.LoadImport(path)
	if v == nil {
		ctx.addErrf(EvalError, x.Src.Pos(), "cannot find package %q", path)
	}
	return v
}

// A LetReference evaluates a let expression in its original environment.
//
// Example: an X referring to
//
//	let X = x
type LetReference struct {
	Src     *ast.Ident
	UpCount int32
	Label   Feature // for informative purposes
	X       Expr
}

func (x *LetReference) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *LetReference) resolve(ctx *OpContext, state combinedFlags) *Vertex {
	e := ctx.Env(x.UpCount)
	n := e.Vertex

	// No need to Unify n, as Let references can only result from evaluating
	// an expression within n, in which case evaluation must already have
	// started.
	if n.status < evaluating && !ctx.isDevVersion() {
		panic("unexpected node state < Evaluating")
	}

	arc := ctx.lookup(n, pos(x), x.Label, state)
	if arc == nil {
		return nil
	}

	// Using a let arc directly saves an allocation, but should not be done
	// in the following circumstances:
	// 1) multiple Environments to be resolved for a single let
	// 2) in case of error: some errors, like structural cycles, may only
	//    occur when an arc is resolved directly, but not when used in an
	//    expression. Consider, for instance:
	//
	//        a: {
	//            b: 1
	//            let X = a  // structural cycle
	//            c: X.b     // not a structural cycle
	//        }
	//
	//     In other words, a Vertex is not necessarily erroneous when a let
	//     field contained in that Vertex is erroneous.

	// We should only partly finalize the result here as it is not safe to
	// finalize any references made by the let.
	if !ctx.isDevVersion() {
		arc.Finalize(ctx)
	}
	b := arc.Bottom()
	if !arc.MultiLet && b == nil {
		return arc
	}

	// Not caching let expressions may lead to exponential behavior.
	// The expr uses the expression of a Let field, which can never be used in
	// any other context.
	c := arc.ConjunctAt(0)
	expr := c.Expr()

	// A let field always has a single expression and thus ConjunctGroups
	// should always have been eliminated. This is critical, as we must
	// ensure that Comprehensions, which may be wrapped in ConjunctGroups,
	// are eliminated.
	_, isGroup := expr.(*ConjunctGroup)
	ctx.Assertf(pos(expr), !isGroup, "unexpected number of expressions")

	key := cacheKey{expr, arc}
	v, ok := e.cache[key]
	if !ok {
		// Link in the right environment to ensure comprehension context is not
		// lost. Use a Vertex to piggyback on cycle processing.
		c.Env = e
		c.x = expr

		if e.cache == nil {
			e.cache = map[cacheKey]Value{}
		}
		n := &Vertex{
			Parent:    arc.Parent,
			Label:     x.Label,
			IsDynamic: b != nil && b.Code == StructuralCycleError,
			Conjuncts: []Conjunct{c},
		}
		v = n
		e.cache[key] = n
		if ctx.isDevVersion() {
			nc := n.getState(ctx)
			// TODO: unlike with the old evaluator, we do not allow the first
			// cycle to be skipped. Doing so can lead to hanging evaluation.
			// As the cycle detection works slightly differently in the new
			// evaluator (and is not entirely completed), this can happen. We
			// should revisit this once we have completed the structural cycle
			// detection.
			// nc.hasNonCycle = true
			// Allow a first cycle to be skipped.
			nc.free()
			n.unify(ctx, allKnown, finalize)
		} else {
			nc := n.getNodeContext(ctx, 0)
			nc.hasNonCycle = true // Allow a first cycle to be skipped.
		}

		// Parents cannot add more conjuncts to a let expression, so set of
		// conjuncts is always complete.
		//
		// NOTE(let finalization): as this let expression is not recorded as
		// a subfield within its parent arc, setParentDone will not be called
		// as part of normal processing. The same is true for finalization.
		// The use of setParentDone has the additional effect that the arc
		// will be finalized where it is needed. See the namesake NOTE for the
		// location where this is triggered.
		n.setParentDone()
	}
	return v.(*Vertex)
}

// A SelectorExpr looks up a fixed field in an expression.
//
//	a.sel
type SelectorExpr struct {
	Src *ast.SelectorExpr
	X   Expr
	Sel Feature
}

func (x *SelectorExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *SelectorExpr) resolve(c *OpContext, state combinedFlags) *Vertex {
	n := c.node(x, x.X, x.Sel.IsRegular(), require(partial, needFieldSetKnown))
	if n == emptyNode {
		return n
	}
	if n.status == partial && !c.isDevVersion() {
		if b := n.state.incompleteErrors(false); b != nil && b.Code < CycleError {
			c.AddBottom(b)
			return n
		}
	}
	// TODO(eval): dynamic nodes should be fully evaluated here as the result
	// will otherwise be discarded and there will be no other chance to check
	// the struct is valid.

	pos := x.Src.Sel.Pos()
	return c.lookup(n, pos, x.Sel, state)
}

// IndexExpr is like a selector, but selects an index.
//
//	a[index]
type IndexExpr struct {
	Src   *ast.IndexExpr
	X     Expr
	Index Expr
}

func (x *IndexExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *IndexExpr) resolve(ctx *OpContext, state combinedFlags) *Vertex {
	// TODO: support byte index.
	n := ctx.node(x, x.X, true, require(partial, needFieldSetKnown))
	i := ctx.value(x.Index, require(partial, scalarKnown))
	if n == emptyNode {
		return n
	}
	if n.status == partial && !ctx.isDevVersion() {
		if b := n.state.incompleteErrors(false); b != nil && b.Code < CycleError {
			ctx.AddBottom(b)
			return n
		}
	}
	// TODO(eval): dynamic nodes should be fully evaluated here as the result
	// will otherwise be discarded and there will be no other chance to check
	// the struct is valid.

	f := ctx.Label(x.Index, i)

	// Within lookup, errors collected in ctx may be associated with n. This is
	// correct if the error is generated within lookup, but not if it has
	// already been generated at this point. We therefore bail out early here if
	// we already have an error.
	// TODO: this code can probably go once we have cleaned up error generation.
	if ctx.errs != nil {
		return nil
	}
	pos := x.Src.Index.Pos()
	return ctx.lookup(n, pos, f, state)
}

// A SliceExpr represents a slice operation. (Not currently in spec.)
//
//	X[Lo:Hi:Stride]
type SliceExpr struct {
	Src    *ast.SliceExpr
	X      Expr
	Lo     Expr
	Hi     Expr
	Stride Expr
}

func (x *SliceExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *SliceExpr) evaluate(c *OpContext, state combinedFlags) Value {
	// TODO: strides

	v := c.value(x.X, require(partial, fieldSetKnown))
	const as = "slice index"

	switch v := v.(type) {
	case nil:
		c.addErrf(IncompleteError, c.pos(), "non-concrete slice subject %s", x.X)
		return nil
	case *Vertex:
		if !v.IsList() {
			break
		}

		var (
			lo = uint64(0)
			hi = uint64(len(v.Arcs))
		)
		if x.Lo != nil {
			lo = c.uint64(c.value(x.Lo, require(partial, scalarKnown)), as)
		}
		if x.Hi != nil {
			hi = c.uint64(c.value(x.Hi, require(partial, scalarKnown)), as)
			if hi > uint64(len(v.Arcs)) {
				return c.NewErrf("index %d out of range", hi)
			}
		}
		if lo > hi {
			return c.NewErrf("invalid slice index: %d > %d", lo, hi)
		}

		n := c.newList(c.src, v.Parent)
		for i, a := range v.Arcs[lo:hi] {
			label, err := MakeLabel(a.Source(), int64(i), IntLabel)
			if err != nil {
				c.AddBottom(&Bottom{
					Src:  a.Source(),
					Err:  err,
					Node: v,
				})
				return nil
			}
			if v.IsDynamic {
				// If the list is dynamic, there is no need to recompute the
				// arcs.
				a.Label = label
				n.Arcs = append(n.Arcs, a)
				continue
			}
			arc := *a
			arc.Parent = n
			arc.Label = label
			n.Arcs = append(n.Arcs, &arc)
		}
		n.status = finalized
		return n

	case *Bytes:
		var (
			lo = uint64(0)
			hi = uint64(len(v.B))
		)
		if x.Lo != nil {
			lo = c.uint64(c.value(x.Lo, require(partial, scalarKnown)), as)
		}
		if x.Hi != nil {
			hi = c.uint64(c.value(x.Hi, require(partial, scalarKnown)), as)
			if hi > uint64(len(v.B)) {
				return c.NewErrf("index %d out of range", hi)
			}
		}
		if lo > hi {
			return c.NewErrf("invalid slice index: %d > %d", lo, hi)
		}
		return c.newBytes(v.B[lo:hi])
	}

	if isError(v) {
		return v
	}
	return c.NewErrf("cannot slice %v (type %s)", v, v.Kind())
}

// An Interpolation is a string interpolation.
//
//	"a \(b) c"
type Interpolation struct {
	Src   *ast.Interpolation
	K     Kind   // string or bytes
	Parts []Expr // odd: strings, even sources
}

func (x *Interpolation) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *Interpolation) evaluate(c *OpContext, state combinedFlags) Value {
	buf := bytes.Buffer{}
	for _, e := range x.Parts {
		v := c.value(e, require(partial, scalarKnown))
		if x.K == BytesKind {
			buf.Write(c.ToBytes(v))
		} else {
			buf.WriteString(c.ToString(v))
		}
	}
	if err := c.Err(); err != nil {
		err = &Bottom{
			Code: err.Code,
			Node: c.vertex,
			Err:  errors.Wrapf(err.Err, pos(x), "invalid interpolation"),
		}
		// c.AddBottom(err)
		// return nil
		return err
	}
	if x.K == BytesKind {
		return &Bytes{x.Src, buf.Bytes(), nil}
	}
	return &String{x.Src, buf.String(), nil}
}

// UnaryExpr is a unary expression.
//
//	Op X
//	-X !X +X
type UnaryExpr struct {
	Src *ast.UnaryExpr
	Op  Op
	X   Expr
}

func (x *UnaryExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *UnaryExpr) evaluate(c *OpContext, state combinedFlags) Value {
	if !c.concreteIsPossible(x.Op, x.X) {
		return nil
	}
	v := c.value(x.X, require(partial, scalarKnown))
	if isError(v) {
		return v
	}

	op := x.Op
	k := kind(v)
	expectedKind := k
	switch op {
	case SubtractOp:
		if v, ok := v.(*Num); ok {
			f := *v
			f.X.Neg(&v.X)
			f.Src = x.Src
			return &f
		}
		expectedKind = NumberKind

	case AddOp:
		if v, ok := v.(*Num); ok {
			// TODO: wrap in thunk to save position of '+'?
			return v
		}
		expectedKind = NumberKind

	case NotOp:
		if v, ok := v.(*Bool); ok {
			return &Bool{x.Src, !v.B}
		}
		expectedKind = BoolKind
	}
	if k&expectedKind != BottomKind {
		c.addErrf(IncompleteError, pos(x.X),
			"operand %s of '%s' not concrete (was %s)", x.X, op, k)
		return nil
	}
	return c.NewErrf("invalid operation %v (%s %s)", x, op, k)
}

// BinaryExpr is a binary expression.
//
//	X + Y
//	X & Y
type BinaryExpr struct {
	Src *ast.BinaryExpr
	Op  Op
	X   Expr
	Y   Expr
}

func (x *BinaryExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *BinaryExpr) evaluate(c *OpContext, state combinedFlags) Value {
	env := c.Env(0)
	if x.Op == AndOp {
		v := c.newInlineVertex(nil, nil, makeAnonymousConjunct(env, x, c.ci.Refs))

		// Do not fully evaluate the Vertex: if it is embedded within a
		// struct with arcs that are referenced from within this expression,
		// it will end up adding "locked" fields, resulting in an error.
		// It will be the responsibility of the "caller" to get the result
		// to the required state. If the struct is already dynamic, we will
		// evaluate the struct regardless to ensure that cycle reporting
		// keeps working.
		if env.Vertex.IsDynamic || c.inValidator > 0 {
			v.Finalize(c)
		} else {
			v.CompleteArcsOnly(c)
		}

		return v
	}

	if !c.concreteIsPossible(x.Op, x.X) || !c.concreteIsPossible(x.Op, x.Y) {
		return nil
	}

	// TODO: allow comparing to a literal Bottom only. Find something more
	// principled perhaps. One should especially take care that two values
	// evaluating to Bottom don't evaluate to true. For now we check for
	// Bottom here and require that one of the values be a Bottom literal.
	if x.Op == EqualOp || x.Op == NotEqualOp {
		if isLiteralBottom(x.X) {
			return c.validate(env, x.Src, x.Y, x.Op, state)
		}
		if isLiteralBottom(x.Y) {
			return c.validate(env, x.Src, x.X, x.Op, state)
		}
	}

	left, _ := c.concrete(env, x.X, x.Op)
	right, _ := c.concrete(env, x.Y, x.Op)

	if err := CombineErrors(x.Src, left, right); err != nil {
		return err
	}

	if err := c.Err(); err != nil {
		return err
	}

	return BinOp(c, x.Op, left, right)
}

func (c *OpContext) validate(env *Environment, src ast.Node, x Expr, op Op, flags combinedFlags) (r Value) {
	state := flags.vertexStatus()

	s := c.PushState(env, src)

	match := op != EqualOp // non-error case

	// Like value(), but retain the original, unwrapped result.
	c.inValidator++
	req := flags
	req = final(state, needTasksDone)
	v := c.evalState(x, req)
	c.inValidator--
	u, _ := c.getDefault(v)
	u = Unwrap(u)

	// If our final (unwrapped) value is potentially a recursive structure, we
	// still need to recursively check for errors. We do so by treating it
	// as the original value, which if it is a Vertex will be evaluated
	// recursively below.
	if u != nil && u.Kind().IsAnyOf(StructKind|ListKind) {
		u = v
	}

	switch v := u.(type) {
	case nil:
	case *Bottom:
		switch v.Code {
		case CycleError:
			c.PopState(s)
			c.AddBottom(v)
			// TODO: add this. This erases some
			// c.verifyNonMonotonicResult(env, x, true)
			return nil

		case IncompleteError:
			c.evalState(x, oldOnly(finalized))

			// We have a nonmonotonic use of a failure. Referenced fields should
			// not be added anymore.
			c.verifyNonMonotonicResult(env, x, true)
		}

		match = op == EqualOp

	case *Vertex:
		// TODO(cycle): if EqualOp:
		// - ensure to pass special status to if clause or keep a track of "hot"
		//   paths.
		// - evaluate hypothetical struct
		// - walk over all fields and verify that fields are not contradicting
		//   previously marked fields.
		//

		if c.hasDepthCycle(v) {
			// Eval V3 logic
			c.verifyNonMonotonicResult(env, x, true)
			match = op == EqualOp
			break
		}
		if v.status == evaluatingArcs {
			unreachableForDev(c) // Eval V2 logic

			// We have a cycle, which may be an error. Cycle errors may occur
			// in chains that are themselves not a cycle. It suffices to check
			// for non-monotonic results at the end for this particular path.
			// TODO(perf): finding the right path through such comprehensions
			// may be expensive. Finding a path in a directed graph is O(n),
			// though, so we should ensure that the implementation conforms to
			// this.
			c.verifyNonMonotonicResult(env, x, true)
			match = op == EqualOp
			break
		}
		v.Finalize(c)

		switch {
		case !v.IsDefined(c):
			c.verifyNonMonotonicResult(env, x, true) // TODO: remove?

			// TODO: mimic comparison to bottom semantics. If it is a valid
			// value, check for concreteness that this level only. This
			// should ultimately be replaced with an exists and valid
			// builtin.
			match = op == EqualOp

		case isFinalError(v):
			// Need to recursively check for errors, so we need to evaluate the
			// Vertex in case it hadn't been evaluated yet.
			match = op == EqualOp
		}

	default:
		if v.Kind().IsAnyOf(CompositeKind) && v.Concreteness() > Concrete && state < conjuncts {
			c.PopState(s)
			c.AddBottom(cycle)
			return nil
		}

		c.verifyNonMonotonicResult(env, x, false)

		if v.Concreteness() > Concrete {
			// TODO: mimic comparison to bottom semantics. If it is a valid
			// value, check for concreteness that this level only. This
			// should ultimately be replaced with an exists and valid
			// builtin.
			match = op == EqualOp
		}

		c.evalState(x, require(state, needTasksDone))
	}

	c.PopState(s)
	return &Bool{src, match}
}

func isFinalError(n *Vertex) bool {
	n = n.DerefValue()
	if b, ok := Unwrap(n).(*Bottom); ok && b.Code < IncompleteError {
		return true
	}
	return false
}

// verifyNonMonotonicResult re-evaluates the given expression at a later point
// to ensure that the result has not changed. This is relevant when a function
// uses reflection, as in `if a != _|_`, where the result of an evaluation may
// change after the fact.
// expectError indicates whether the value should evaluate to an error or not.
func (c *OpContext) verifyNonMonotonicResult(env *Environment, x Expr, expectError bool) {
	if n := env.Vertex.state; n != nil {
		n.postChecks = append(n.postChecks, envCheck{
			env:         env,
			expr:        x,
			expectError: expectError,
		})
	}
}

// A CallExpr represents a call to a builtin.
//
//	len(x)
//	strings.ToLower(x)
type CallExpr struct {
	Src  *ast.CallExpr
	Fun  Expr
	Args []Expr
}

func (x *CallExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *CallExpr) evaluate(c *OpContext, state combinedFlags) Value {
	fun := c.value(x.Fun, require(partial, concreteKnown))
	var b *Builtin
	switch f := fun.(type) {
	case *Builtin:
		b = f
		if f.RawFunc != nil {
			if !b.checkArgs(c, pos(x), len(x.Args)) {
				return nil
			}
			return f.RawFunc(c, x.Args)
		}

	case *BuiltinValidator:
		// We allow a validator that takes no arguments except the validated
		// value to be called with zero arguments.
		switch {
		case f.Src != nil:
			c.AddErrf("cannot call previously called validator %s", x.Fun)

		case f.Builtin.IsValidator(len(x.Args)):
			v := *f
			v.Src = x
			return &v

		default:
			b = f.Builtin
		}

	default:
		c.AddErrf("cannot call non-function %s (type %s)", x.Fun, kind(fun))
		return nil
	}
	args := []Value{}
	for i, a := range x.Args {
		saved := c.errs
		c.errs = nil
		// XXX: XXX: clear id.closeContext per argument and remove from runTask?

		runMode := state.runMode()
		cond := state.conditions() | allAncestorsProcessed | concreteKnown
		state = combineMode(cond, runMode).withVertexStatus(state.vertexStatus())

		var expr Value
		if b.NonConcrete {
			expr = c.evalState(a, state)
		} else {
			expr = c.value(a, state)
		}

		switch v := expr.(type) {
		case nil:
			if c.errs == nil {
				// There SHOULD be an error in the context. If not, we generate
				// one.
				c.Assertf(pos(x.Fun), c.HasErr(),
					"argument %d to function %s is incomplete", i, x.Fun)
			}

		case *Bottom:
			// TODO(errors): consider adding an argument index for this errors.
			c.errs = CombineErrors(a.Source(), c.errs, v)

		default:
			args = append(args, expr)
		}
		c.errs = CombineErrors(a.Source(), saved, c.errs)
	}
	if c.HasErr() {
		return nil
	}
	if b.IsValidator(len(args)) {
		return &BuiltinValidator{x, b, args}
	}
	result := b.call(c, pos(x), false, args)
	if result == nil {
		return nil
	}
	v, ci := c.evalStateCI(result, state.withVertexStatus(partial))
	c.ci = ci
	return v
}

// A Builtin is a value representing a native function call.
type Builtin struct {
	// TODO:  make these values for better type checking.
	Params []Param
	Result Kind

	// NonConcrete should be set to true if a builtin supports non-concrete
	// arguments. By default, all arguments are checked to be concrete.
	NonConcrete bool

	Func func(c *OpContext, args []Value) Expr

	// RawFunc gives low-level control to CUE's internals for builtins.
	// It should be used when fine control over the evaluation process is
	// needed. Note that RawFuncs are responsible for returning a Value. This
	// gives them fine control over how exactly such value gets evaluated.
	// A RawFunc may pass CycleInfo, errors and other information through
	// the Context.
	RawFunc func(c *OpContext, args []Expr) Value

	Package Feature
	Name    string
}

type Param struct {
	Name  Feature // name of the argument; mostly for documentation
	Value Value   // Could become Value later, using disjunctions for defaults.
}

// Kind returns the kind mask of this parameter.
func (p Param) Kind() Kind {
	return p.Value.Kind()
}

// Default reports the default value for this Param or nil if there is none.
func (p Param) Default() Value {
	d, ok := p.Value.(*Disjunction)
	if !ok || d.NumDefaults != 1 {
		return nil
	}
	return d.Values[0]
}

func (x *Builtin) qualifiedName(c *OpContext) string {
	if x.Package != InvalidLabel {
		return x.Package.StringValue(c) + "." + x.Name
	}
	return x.Name
}

// Kind here represents the case where Builtin is used as a Validator.
func (x *Builtin) Kind() Kind {
	return FuncKind
}

func (x *Builtin) BareValidator() *BuiltinValidator {
	if len(x.Params) != 1 ||
		(x.Result != BoolKind && x.Result != BottomKind) {
		return nil
	}
	return &BuiltinValidator{Builtin: x}
}

// IsValidator reports whether b should be interpreted as a Validator for the
// given number of arguments.
func (b *Builtin) IsValidator(numArgs int) bool {
	return numArgs == len(b.Params)-1 &&
		b.Result&^BoolKind == 0 &&
		b.Params[numArgs].Default() == nil
}

func bottom(v Value) *Bottom {
	if x, ok := v.(*Vertex); ok {
		v = x.Value()
	}
	b, _ := v.(*Bottom)
	return b
}

func (x *Builtin) checkArgs(c *OpContext, p token.Pos, numArgs int) bool {
	if numArgs > len(x.Params) {
		c.addErrf(0, p,
			"too many arguments in call to %v (have %d, want %d)",
			x, numArgs, len(x.Params))
		return false
	}
	if numArgs < len(x.Params) {
		// Assume that all subsequent params have a default as well.
		v := x.Params[numArgs].Default()
		if v == nil {
			c.addErrf(0, p,
				"not enough arguments in call to %v (have %d, want %d)",
				x, numArgs, len(x.Params))
			return false
		}
	}
	return true
}

func (x *Builtin) call(c *OpContext, p token.Pos, validate bool, args []Value) Expr {
	fun := x // right now always x.
	if !x.checkArgs(c, p, len(args)) {
		return nil
	}
	for i := len(args); i < len(x.Params); i++ {
		args = append(args, x.Params[i].Default())
	}
	for i, a := range args {
		if x.Params[i].Kind() == BottomKind {
			continue
		}
		if b := bottom(a); b != nil {
			return b
		}
		if k := kind(a); x.Params[i].Kind()&k == BottomKind {
			code := EvalError
			b, _ := args[i].(*Bottom)
			if b != nil {
				code = b.Code
			}
			c.addErrf(code, pos(a),
				"cannot use %s (type %s) as %s in argument %d to %v",
				a, k, x.Params[i].Kind(), i+1, fun)
			return nil
		}
		v := x.Params[i].Value
		if _, ok := v.(*BasicType); !ok {
			env := c.Env(0)
			x := &BinaryExpr{Op: AndOp, X: v, Y: a}
			n := c.newInlineVertex(nil, nil, Conjunct{env, x, c.ci})
			n.Finalize(c)
			if n.IsErr() {
				c.addErrf(0, pos(a),
					"cannot use %s as %s in argument %d to %v",
					a, v, i+1, fun)
				return nil
			}
			args[i] = n
		}
	}
	saved := c.IsValidator
	c.IsValidator = validate
	ret := x.Func(c, args)
	c.IsValidator = saved

	return ret
}

func (x *Builtin) Source() ast.Node { return nil }

// A BuiltinValidator is a Value that results from evaluation a partial call
// to a builtin (using CallExpr).
//
//	strings.MinRunes(4)
type BuiltinValidator struct {
	Src     *CallExpr
	Builtin *Builtin
	Args    []Value // any but the first value
}

func (x *BuiltinValidator) Source() ast.Node {
	if x.Src == nil {
		return x.Builtin.Source()
	}
	return x.Src.Source()
}

func (x *BuiltinValidator) Pos() token.Pos {
	if src := x.Source(); src != nil {
		return src.Pos()
	}
	return token.NoPos
}

func (x *BuiltinValidator) Kind() Kind {
	return x.Builtin.Params[0].Kind()
}

func (x *BuiltinValidator) validate(c *OpContext, v Value) *Bottom {
	args := make([]Value, len(x.Args)+1)
	args[0] = v
	copy(args[1:], x.Args)

	return validateWithBuiltin(c, x.Pos(), x.Builtin, args)
}

func validateWithBuiltin(c *OpContext, src token.Pos, b *Builtin, args []Value) *Bottom {
	var severeness ErrorCode
	var err errors.Error

	res := b.call(c, src, true, args)
	switch v := res.(type) {
	case nil:
		return nil

	case *Bottom:
		if v == nil {
			return nil // caught elsewhere, but be defensive.
		}
		severeness = v.Code
		err = v.Err

	case *Bool:
		if v.B {
			return nil
		}

	default:
		return c.NewErrf("invalid validator %s", b.qualifiedName(c))
	}

	// If the validator returns an error and we already had an error, just
	// return the original error.
	if b, ok := Unwrap(args[0]).(*Bottom); ok {
		return b
	}
	// failed:
	var buf bytes.Buffer
	buf.WriteString(b.qualifiedName(c))

	// Note: when the builtin accepts non-concrete arguments, omit them because
	// they can easily be very large.
	if !b.NonConcrete && len(args) > 1 {
		buf.WriteString("(")
		for i, a := range args[1:] {
			if i > 0 {
				_, _ = buf.WriteString(", ")
			}
			buf.WriteString(c.Str(a))
		}
		buf.WriteString(")")
	}

	vErr := c.NewPosf(src, "invalid value %s (does not satisfy %s)", args[0], buf.String())

	for _, v := range args {
		vErr.AddPosition(v)
	}

	return &Bottom{
		Code: severeness,
		Err:  errors.Wrap(vErr, err),
		Node: c.vertex,
	}
}

// A Disjunction represents a disjunction, where each disjunct may or may not
// be marked as a default.
type DisjunctionExpr struct {
	Src    *ast.BinaryExpr
	Values []Disjunct

	HasDefaults bool
}

// A Disjunct is used in Disjunction.
type Disjunct struct {
	Val     Expr
	Default bool
}

func (x *DisjunctionExpr) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *DisjunctionExpr) evaluate(c *OpContext, state combinedFlags) Value {
	e := c.Env(0)
	v := c.newInlineVertex(nil, nil, Conjunct{e, x, c.ci})
	v.Finalize(c) // TODO: also partial okay?
	// TODO: if the disjunction result originated from a literal value, we may
	// consider the result closed to create more permanent errors.
	return v
}

// A Conjunction is a conjunction of values that cannot be represented as a
// single value. It is the result of unification.
type Conjunction struct {
	Src    ast.Expr
	Values []Value
}

func (x *Conjunction) Source() ast.Node { return x.Src }
func (x *Conjunction) Kind() Kind {
	k := TopKind
	for _, v := range x.Values {
		k &= v.Kind()
	}
	return k
}

// A disjunction is a disjunction of values. It is the result of expanding
// a DisjunctionExpr if the expression cannot be represented as a single value.
type Disjunction struct {
	Src ast.Expr

	// Values are the non-error disjuncts of this expression. The first
	// NumDefaults values are default values.
	Values []Value

	Errors *Bottom // []bottom

	// NumDefaults indicates the number of default values.
	NumDefaults int
	HasDefaults bool
}

func (x *Disjunction) Source() ast.Node { return x.Src }
func (x *Disjunction) Kind() Kind {
	k := BottomKind
	for _, v := range x.Values {
		k |= v.Kind()
	}
	return k
}

type Comprehension struct {
	Syntax ast.Node

	// Clauses is the list of for, if, and other clauses of a comprehension,
	// not including the yielded value (in curly braces).
	Clauses []Yielder

	// Value can be either a StructLit if this is a compiled expression or
	// a Field if this is a computed Comprehension. Value holds a Field,
	// rather than an Expr, in the latter case to preserve as much position
	// information as possible.
	Value Node

	// The type of field as which the comprehension is added.
	arcType ArcType

	// The closeContext into which the comprehension is added. Upon a successful
	// completion of the comprehension, the arcType should be updated in this
	// closeContext. After this is done, the corresponding parent closeContext
	// must be closed.
	arcCC *closeContext

	// This is incremented by the Comprehension upon creation, and decremented
	// once it is known whether the comprehension succeeded.
	cc *closeContext

	// Only used for partial comprehensions.
	comp   *envComprehension
	parent *Comprehension // comprehension from which this one was derived, if any
	arc    *Vertex        // arc to which this comprehension was added.
}

// Nest returns the nesting level of void arcs of this comprehension.
func (c *Comprehension) Nest() int {
	count := 0
	for ; c.parent != nil; c = c.parent {
		count++
	}
	return count
}

// Envs returns all Environments yielded from an evaluated comprehension.
// Together with the Comprehension value, each Environment represents a
// result value of the comprehension.
func (c *Comprehension) Envs() []*Environment {
	if c.comp == nil {
		return nil
	}
	return c.comp.envs
}

// DidResolve reports whether a comprehension was processed and resulted in at
// least one yielded value.
func (x *Comprehension) DidResolve() bool {
	return x.comp.done && len(x.comp.envs) > 0
}

func (x *Comprehension) Source() ast.Node {
	if x.Syntax == nil {
		return nil
	}
	return x.Syntax
}

// A ForClause represents a for clause of a comprehension. It can be used
// as a struct or list element.
//
//	for k, v in src {}
type ForClause struct {
	Syntax *ast.ForClause
	Key    Feature
	Value  Feature
	Src    Expr
}

func (x *ForClause) Source() ast.Node {
	if x.Syntax == nil {
		return nil
	}
	return x.Syntax
}

func (c *OpContext) forSource(x Expr) *Vertex {
	state := require(conjuncts, needFieldSetKnown)

	// TODO: always get the vertex. This allows a whole bunch of trickery
	// down the line.
	c.inDetached++
	v := c.unifyNode(x, state)
	c.inDetached--

	node, ok := v.(*Vertex)
	if ok && c.isDevVersion() {
		node.unify(c, state.conditions(), yield)
	}

	v, ok = c.getDefault(v)

	if !ok {
		// Error already generated by getDefault.
		return emptyNode
	}

	// TODO: skip in new evaluator? Check once we introduce disjunctions.
	if w := Unwrap(v); !isCyclePlaceholder(w) {
		v = w
	}
	node, ok = v.(*Vertex)
	if ok && !isCyclePlaceholder(node.BaseValue) {
		v = node.Value()
	}

	switch nv := v.(type) {
	case nil:
		c.addErrf(IncompleteError, pos(x),
			"cannot range over %s (incomplete)", x)
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
				"cannot range over %s (incomplete type %s)", x, kind)
			return emptyNode

		} else if !ok {
			c.addErrf(0, pos(x), // TODO(error): better message.
				"cannot range over %s (found %s, want list or struct)",
				x.Source(), v.Kind())
			return emptyNode
		}
	}

	return node
}

func (x *ForClause) yield(s *compState) {
	c := s.ctx
	n := c.forSource(x.Src)

	if c.isDevVersion() {
		if s := n.getState(c); s != nil {
			s.freeze(fieldSetKnown)
		}
	} else {
		if n.status == evaluating && !n.LockArcs {
			c.AddBottom(&Bottom{
				Code:     CycleError,
				ForCycle: true,
				Value:    n,
				Node:     n,
				Err:      errors.Newf(pos(x.Src), "comprehension source references itself"),
			})
			return
		}
		if c.HasErr() {
			return
		}
		n.LockArcs = true
	}

	for _, a := range n.Arcs {
		if !a.Label.IsRegular() {
			continue
		}

		if c.isDevVersion() {
			// TODO(evalv3): See comment in StructLit.evaluate.
			if state := a.getState(c); state != nil {
				state.process(arcTypeKnown, attemptOnly)
			}
		} else {
			if !a.isDefined() {
				a.Finalize(c)
			}
			if !a.definitelyExists() {
				continue
			}
		}

		switch a.ArcType {
		case ArcMember:
		case ArcRequired:
			c.AddBottom(newRequiredFieldInComprehensionError(c, x, a))
			continue
		default:
			continue
		}

		n := &Vertex{
			Parent: c.Env(0).Vertex,

			// Using Finalized here ensures that no nodeContext is allocated,
			// preventing a leak, as this "helper" struct bypasses normal
			// processing, eluding the deallocation step.
			status:    finalized,
			IsDynamic: true,
			anonymous: true,
			ArcType:   ArcMember,
		}

		if x.Value != InvalidLabel {
			b := &Vertex{
				Label:     x.Value,
				BaseValue: a,
				IsDynamic: true,
				anonymous: true,
				ArcType:   ArcPending,
			}
			n.Arcs = append(n.Arcs, b)
		}

		if x.Key != InvalidLabel {
			v := &Vertex{
				Label:     x.Key,
				IsDynamic: true,
				anonymous: true,
			}
			key := a.Label.ToValue(c)
			v.AddConjunct(MakeRootConjunct(c.Env(0), key))
			v.SetValue(c, key)
			n.Arcs = append(n.Arcs, v)
		}

		sub := c.spawn(n)
		if !s.yield(sub) {
			break
		}
	}
}

// An IfClause represents an if clause of a comprehension. It can be used
// as a struct or list element.
//
//	if cond {}
type IfClause struct {
	Src       *ast.IfClause
	Condition Expr
}

func (x *IfClause) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *IfClause) yield(s *compState) {
	ctx := s.ctx
	if ctx.BoolValue(ctx.value(x.Condition, require(s.state, scalarKnown))) {
		s.yield(ctx.e)
	}
}

// A LetClause represents a let clause in a comprehension.
//
//	let x = y
type LetClause struct {
	Src   *ast.LetClause
	Label Feature
	Expr  Expr
}

func (x *LetClause) Source() ast.Node {
	if x.Src == nil {
		return nil
	}
	return x.Src
}

func (x *LetClause) yield(s *compState) {
	c := s.ctx
	n := &Vertex{Arcs: []*Vertex{
		{
			Label:     x.Label,
			IsDynamic: true,
			anonymous: true,
			Conjuncts: []Conjunct{{c.Env(0), x.Expr, c.ci}},
		},
	}}

	s.yield(c.spawn(n))
}
