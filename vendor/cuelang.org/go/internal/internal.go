// Copyright 2018 The CUE Authors
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

// Package internal exposes some cue internals to other packages.
//
// A better name for this package would be technicaldebt.
package internal

// TODO: refactor packages as to make this package unnecessary.

import (
	"bufio"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/cockroachdb/apd/v3"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// A Decimal is an arbitrary-precision binary-coded decimal number.
//
// Right now Decimal is aliased to apd.Decimal. This may change in the future.
type Decimal = apd.Decimal

// Context wraps apd.Context for CUE's custom logic.
//
// Note that it avoids pointers to make it easier to make copies.
type Context struct {
	apd.Context
}

// WithPrecision mirrors upstream, but returning our type without a pointer.
func (c Context) WithPrecision(p uint32) Context {
	c.Context = *c.Context.WithPrecision(p)
	return c
}

// apd/v2 used to call Reduce on the result of Quo and Rem,
// so that the operations always trimmed all but one trailing zeros.
// apd/v3 does not do that at all.
// For now, get the old behavior back by calling Reduce ourselves.
// Note that v3's Reduce also removes all trailing zeros,
// whereas v2's Reduce would leave ".0" behind.
// Get that detail back as well, to consistently show floats with decimal points.
//
// TODO: Rather than reducing all trailing zeros,
// we should keep a number of zeros that makes sense given the operation.

func reduceKeepingFloats(d *apd.Decimal) {
	oldExponent := d.Exponent
	d.Reduce(d)
	// If the decimal had decimal places, like "3.000" and "5.000E+5",
	// Reduce gives us "3" and "5E+5", but we want "3.0" and "5.0E+5".
	if oldExponent < 0 && d.Exponent >= 0 {
		d.Exponent--
		// TODO: we can likely make the NewBigInt(10) a static global to reduce allocs
		d.Coeff.Mul(&d.Coeff, apd.NewBigInt(10))
	}
}

func (c Context) Quo(d, x, y *apd.Decimal) (apd.Condition, error) {
	res, err := c.Context.Quo(d, x, y)
	reduceKeepingFloats(d)
	return res, err
}

func (c Context) Sqrt(d, x *apd.Decimal) (apd.Condition, error) {
	res, err := c.Context.Sqrt(d, x)
	reduceKeepingFloats(d)
	return res, err
}

// ErrIncomplete can be used by builtins to signal the evaluation was
// incomplete.
var ErrIncomplete = errors.New("incomplete value")

// BaseContext is used as CUE's default context for arbitrary-precision decimals.
var BaseContext = Context{*apd.BaseContext.WithPrecision(34)}

// APIVersionSupported is the back version until which deprecated features
// are still supported.
var APIVersionSupported = Version(MinorSupported, PatchSupported)

const (
	MinorCurrent   = 5
	MinorSupported = 4
	PatchSupported = 0
)

func Version(minor, patch int) int {
	return -1000 + 100*minor + patch
}

// EvaluatorVersion is declared here so it can be used everywhere without import cycles,
// but the canonical documentation lives at [cuelang.org/go/cue/cuecontext.EvalVersion].
//
// TODO(mvdan): rename to EvalVersion for consistency with cuecontext.
type EvaluatorVersion int

const (
	// EvalVersionUnset is the zero value, which signals that no evaluator version is provided.
	EvalVersionUnset EvaluatorVersion = 0

	// The values below are documented under [cuelang.org/go/cue/cuecontext.EvalVersion].
	// We should never change or delete the values below, as they describe all known past versions
	// which is useful for understanding old debug output.

	EvalV2 EvaluatorVersion = 2
	EvalV3 EvaluatorVersion = 3

	// The current default and experimental versions.

	DefaultVersion = EvalV2 // TODO(mvdan): rename to EvalDefault for consistency with cuecontext
	DevVersion     = EvalV3 // TODO(mvdan): rename to EvalExperiment for consistency with cuecontext
)

// ListEllipsis reports the list type and remaining elements of a list. If we
// ever relax the usage of ellipsis, this function will likely change. Using
// this function will ensure keeping correct behavior or causing a compiler
// failure.
func ListEllipsis(n *ast.ListLit) (elts []ast.Expr, e *ast.Ellipsis) {
	elts = n.Elts
	if n := len(elts); n > 0 {
		var ok bool
		if e, ok = elts[n-1].(*ast.Ellipsis); ok {
			elts = elts[:n-1]
		}
	}
	return elts, e
}

// Package finds the package declaration from the preamble of a file.
func Package(f *ast.File) *ast.Package {
	for _, d := range f.Decls {
		switch d := d.(type) {
		case *ast.CommentGroup:
		case *ast.Attribute:
		case *ast.Package:
			if d.Name == nil { // malformed package declaration
				return nil
			}
			return d
		default:
			return nil
		}
	}
	return nil
}

func SetPackage(f *ast.File, name string, overwrite bool) {
	if pkg := Package(f); pkg != nil {
		if !overwrite || pkg.Name.Name == name {
			return
		}
		ident := ast.NewIdent(name)
		astutil.CopyMeta(ident, pkg.Name)
		return
	}

	decls := make([]ast.Decl, len(f.Decls)+1)
	k := 0
	for _, d := range f.Decls {
		if _, ok := d.(*ast.CommentGroup); ok {
			decls[k] = d
			k++
			continue
		}
		break
	}
	decls[k] = &ast.Package{Name: ast.NewIdent(name)}
	copy(decls[k+1:], f.Decls[k:])
	f.Decls = decls
}

// NewComment creates a new CommentGroup from the given text.
// Each line is prefixed with "//" and the last newline is removed.
// Useful for ASTs generated by code other than the CUE parser.
func NewComment(isDoc bool, s string) *ast.CommentGroup {
	if s == "" {
		return nil
	}
	cg := &ast.CommentGroup{Doc: isDoc}
	if !isDoc {
		cg.Line = true
		cg.Position = 10
	}
	scanner := bufio.NewScanner(strings.NewReader(s))
	for scanner.Scan() {
		scanner := bufio.NewScanner(strings.NewReader(scanner.Text()))
		scanner.Split(bufio.ScanWords)
		const maxRunesPerLine = 66
		count := 2
		buf := strings.Builder{}
		buf.WriteString("//")
		for scanner.Scan() {
			s := scanner.Text()
			n := len([]rune(s)) + 1
			if count+n > maxRunesPerLine && count > 3 {
				cg.List = append(cg.List, &ast.Comment{Text: buf.String()})
				count = 3
				buf.Reset()
				buf.WriteString("//")
			}
			buf.WriteString(" ")
			buf.WriteString(s)
			count += n
		}
		cg.List = append(cg.List, &ast.Comment{Text: buf.String()})
	}
	if last := len(cg.List) - 1; cg.List[last].Text == "//" {
		cg.List = cg.List[:last]
	}
	return cg
}

func FileComment(f *ast.File) *ast.CommentGroup {
	var cgs []*ast.CommentGroup
	if pkg := Package(f); pkg != nil {
		cgs = pkg.Comments()
	} else if cgs = f.Comments(); len(cgs) > 0 {
		// Use file comment.
	} else {
		// Use first comment before any declaration.
		for _, d := range f.Decls {
			if cg, ok := d.(*ast.CommentGroup); ok {
				return cg
			}
			if cgs = ast.Comments(d); cgs != nil {
				break
			}
			// TODO: what to do here?
			if _, ok := d.(*ast.Attribute); !ok {
				break
			}
		}
	}
	var cg *ast.CommentGroup
	for _, c := range cgs {
		if c.Position == 0 {
			cg = c
		}
	}
	return cg
}

func NewAttr(name, str string) *ast.Attribute {
	buf := &strings.Builder{}
	buf.WriteByte('@')
	buf.WriteString(name)
	buf.WriteByte('(')
	buf.WriteString(str)
	buf.WriteByte(')')
	return &ast.Attribute{Text: buf.String()}
}

// ToExpr converts a node to an expression. If it is a file, it will return
// it as a struct. If is an expression, it will return it as is. Otherwise
// it panics.
func ToExpr(n ast.Node) ast.Expr {
	switch x := n.(type) {
	case nil:
		return nil

	case ast.Expr:
		return x

	case *ast.File:
		start := 0
	outer:
		for i, d := range x.Decls {
			switch d.(type) {
			case *ast.Package, *ast.ImportDecl:
				start = i + 1
			case *ast.CommentGroup, *ast.Attribute:
			default:
				break outer
			}
		}
		decls := x.Decls[start:]
		if len(decls) == 1 {
			if e, ok := decls[0].(*ast.EmbedDecl); ok {
				return e.Expr
			}
		}
		return &ast.StructLit{Elts: decls}

	default:
		panic(fmt.Sprintf("Unsupported node type %T", x))
	}
}

// ToFile converts an expression to a file.
//
// Adjusts the spacing of x when needed.
func ToFile(n ast.Node) *ast.File {
	if n == nil {
		return nil
	}
	switch n := n.(type) {
	case *ast.StructLit:
		f := &ast.File{Decls: n.Elts}
		// Ensure that the comments attached to the struct literal are not lost.
		ast.SetComments(f, ast.Comments(n))
		return f
	case ast.Expr:
		ast.SetRelPos(n, token.NoSpace)
		return &ast.File{Decls: []ast.Decl{&ast.EmbedDecl{Expr: n}}}
	case *ast.File:
		return n
	default:
		panic(fmt.Sprintf("Unsupported node type %T", n))
	}
}

func IsDef(s string) bool {
	return strings.HasPrefix(s, "#") || strings.HasPrefix(s, "_#")
}

func IsHidden(s string) bool {
	return strings.HasPrefix(s, "_")
}

func IsDefOrHidden(s string) bool {
	return strings.HasPrefix(s, "#") || strings.HasPrefix(s, "_")
}

func IsDefinition(label ast.Label) bool {
	switch x := label.(type) {
	case *ast.Alias:
		if ident, ok := x.Expr.(*ast.Ident); ok {
			return IsDef(ident.Name)
		}
	case *ast.Ident:
		return IsDef(x.Name)
	}
	return false
}

func IsRegularField(f *ast.Field) bool {
	var ident *ast.Ident
	switch x := f.Label.(type) {
	case *ast.Alias:
		ident, _ = x.Expr.(*ast.Ident)
	case *ast.Ident:
		ident = x
	}
	if ident == nil {
		return true
	}
	if strings.HasPrefix(ident.Name, "#") || strings.HasPrefix(ident.Name, "_") {
		return false
	}
	return true
}

// ConstraintToken reports which constraint token (? or !) is associated
// with a field (if any), taking into account compatibility of deprecated
// fields.
func ConstraintToken(f *ast.Field) (t token.Token, ok bool) {
	if f.Constraint != token.ILLEGAL {
		return f.Constraint, true
	}
	if f.Optional != token.NoPos {
		return token.OPTION, true
	}
	return f.Constraint, false
}

// SetConstraints sets both the main and deprecated fields of f according to the
// given constraint token.
func SetConstraint(f *ast.Field, t token.Token) {
	f.Constraint = t
	if t == token.ILLEGAL {
		f.Optional = token.NoPos
	} else {
		f.Optional = token.Blank.Pos()
	}
}

func EmbedStruct(s *ast.StructLit) *ast.EmbedDecl {
	e := &ast.EmbedDecl{Expr: s}
	if len(s.Elts) == 1 {
		d := s.Elts[0]
		astutil.CopyPosition(e, d)
		ast.SetRelPos(d, token.NoSpace)
		astutil.CopyComments(e, d)
		ast.SetComments(d, nil)
		if f, ok := d.(*ast.Field); ok {
			ast.SetRelPos(f.Label, token.NoSpace)
		}
	}
	s.Lbrace = token.Newline.Pos()
	s.Rbrace = token.NoSpace.Pos()
	return e
}

// IsEllipsis reports whether the declaration can be represented as an ellipsis.
func IsEllipsis(x ast.Decl) bool {
	// ...
	if _, ok := x.(*ast.Ellipsis); ok {
		return true
	}

	// [string]: _ or [_]: _
	f, ok := x.(*ast.Field)
	if !ok {
		return false
	}
	v, ok := f.Value.(*ast.Ident)
	if !ok || v.Name != "_" {
		return false
	}
	l, ok := f.Label.(*ast.ListLit)
	if !ok || len(l.Elts) != 1 {
		return false
	}
	i, ok := l.Elts[0].(*ast.Ident)
	if !ok {
		return false
	}
	return i.Name == "string" || i.Name == "_"
}

// GenPath reports the directory in which to store generated files.
func GenPath(root string) string {
	return filepath.Join(root, "cue.mod", "gen")
}

var ErrInexact = errors.New("inexact subsumption")
