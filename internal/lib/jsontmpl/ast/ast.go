// Package ast defines the jsontmpl AST. Node types mirror upstream
// Kriti's ValueExt constructors (Token.hs:121-148). Every node carries
// a Span for error reporting.
package ast

import (
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// Node is the sealed AST root. Use a type switch to discriminate.
type Node interface {
	isNode()
	GetSpan() token.Span
}

// --- Literal / collection nodes ---------------------------------------------

// ObjectField pairs a key (raw string, post-StringTem) with a value.
// Object preserves insertion order, matching upstream's Compat.Object
// (which is an ordered KeyMap, per Kriti.Aeson.Compat).
type ObjectField struct {
	Key   string
	Value Node
}

type Object struct {
	Span   token.Span
	Fields []ObjectField
}

func (n Object) isNode()             {}
func (n Object) GetSpan() token.Span { return n.Span }

type Array struct {
	Span  token.Span
	Elems []Node
}

func (n Array) isNode()             {}
func (n Array) GetSpan() token.Span { return n.Span }

type String struct {
	Span  token.Span
	Value string
}

func (n String) isNode()             {}
func (n String) GetSpan() token.Span { return n.Span }

// Number stores the raw numeric text. The evaluator parses it to float64
// (see eval/value.go for the documented rationale and precision tradeoff);
// this is a deliberate divergence from upstream's arbitrary-precision
// Scientific.
type Number struct {
	Span token.Span
	Text string
}

func (n Number) isNode()             {}
func (n Number) GetSpan() token.Span { return n.Span }

type Boolean struct {
	Span  token.Span
	Value bool
}

func (n Boolean) isNode()             {}
func (n Boolean) GetSpan() token.Span { return n.Span }

type Null struct {
	Span token.Span
}

func (n Null) isNode()             {}
func (n Null) GetSpan() token.Span { return n.Span }

// StringTem is a string template made of literal fragments and
// embedded expressions. Each Part is either an ast.String literal or
// any other Node (interpolated expression).
type StringTem struct {
	Span  token.Span
	Parts []Node
}

func (n StringTem) isNode()             {}
func (n StringTem) GetSpan() token.Span { return n.Span }

// --- Variables and access ---------------------------------------------------

type Var struct {
	Span token.Span
	Name string
}

func (n Var) isNode()             {}
func (n Var) GetSpan() token.Span { return n.Span }

// FieldKey models upstream's `Either Text ValueExt`: either a static
// name (the .ident or ['name'] forms) or an expression (the [expr]
// form). Exactly one of Name / Expr is set, controlled by IsName.
type FieldKey struct {
	Span   token.Span
	IsName bool
	Name   string
	Expr   Node
}

type RequiredFieldAccess struct {
	Span  token.Span
	Root  Node
	Field FieldKey
}

func (n RequiredFieldAccess) isNode()             {}
func (n RequiredFieldAccess) GetSpan() token.Span { return n.Span }

type OptionalFieldAccess struct {
	Span   token.Span
	Root   Node
	Fields []FieldKey
}

func (n OptionalFieldAccess) isNode()             {}
func (n OptionalFieldAccess) GetSpan() token.Span { return n.Span }

// --- Control flow -----------------------------------------------------------

type Elif struct {
	Span token.Span
	Cond Node
	Then Node
}

type Iff struct {
	Span  token.Span
	Cond  Node
	Then  Node
	Elifs []Elif
	Else  Node
}

func (n Iff) isNode()             {}
func (n Iff) GetSpan() token.Span { return n.Span }

// Range: {{ range idx, bndr := source }} body {{ end }}. IdxName is ""
// when the index was discarded with `_` (matches upstream's
// `Maybe Text` Nothing).
type Range struct {
	Span       token.Span
	IdxName    string
	BinderName string
	Source     Node
	Body       Node
}

func (n Range) isNode()             {}
func (n Range) GetSpan() token.Span { return n.Span }

// --- Binary operators -------------------------------------------------------

type Eq struct {
	Span        token.Span
	Left, Right Node
}

func (n Eq) isNode()             {}
func (n Eq) GetSpan() token.Span { return n.Span }

type NotEq struct {
	Span        token.Span
	Left, Right Node
}

func (n NotEq) isNode()             {}
func (n NotEq) GetSpan() token.Span { return n.Span }

type Gt struct {
	Span        token.Span
	Left, Right Node
}

func (n Gt) isNode()             {}
func (n Gt) GetSpan() token.Span { return n.Span }

type Gte struct {
	Span        token.Span
	Left, Right Node
}

func (n Gte) isNode()             {}
func (n Gte) GetSpan() token.Span { return n.Span }

type Lt struct {
	Span        token.Span
	Left, Right Node
}

func (n Lt) isNode()             {}
func (n Lt) GetSpan() token.Span { return n.Span }

type Lte struct {
	Span        token.Span
	Left, Right Node
}

func (n Lte) isNode()             {}
func (n Lte) GetSpan() token.Span { return n.Span }

type And struct {
	Span        token.Span
	Left, Right Node
}

func (n And) isNode()             {}
func (n And) GetSpan() token.Span { return n.Span }

type Or struct {
	Span        token.Span
	Left, Right Node
}

func (n Or) isNode()             {}
func (n Or) GetSpan() token.Span { return n.Span }

type In struct {
	Span        token.Span
	Left, Right Node
}

func (n In) isNode()             {}
func (n In) GetSpan() token.Span { return n.Span }

type Defaulting struct {
	Span        token.Span
	Left, Right Node
}

func (n Defaulting) isNode()             {}
func (n Defaulting) GetSpan() token.Span { return n.Span }

// Function is a one-arg call: `name(arg)`. `not expr` is desugared to
// Function{Name: "not", Arg: expr} during parsing, matching upstream
// (Grammar.y:99-103).
type Function struct {
	Span token.Span
	Name string
	Arg  Node
}

func (n Function) isNode()             {}
func (n Function) GetSpan() token.Span { return n.Span }
