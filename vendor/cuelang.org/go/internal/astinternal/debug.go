// Copyright 2021 CUE Authors
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

package astinternal

import (
	"fmt"
	gotoken "go/token"
	"reflect"
	"strconv"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

// AppendDebug writes a multi-line Go-like representation of a syntax tree node,
// including node position information and any relevant Go types.
func AppendDebug(dst []byte, node ast.Node, config DebugConfig) []byte {
	d := &debugPrinter{
		cfg: config,
		buf: dst,
	}
	if d.value(reflect.ValueOf(node), nil) {
		d.newline()
	}
	return d.buf
}

// DebugConfig configures the behavior of [AppendDebug].
type DebugConfig struct {
	// Filter is called before each value in a syntax tree.
	// Values for which the function returns false are omitted.
	Filter func(reflect.Value) bool

	// OmitEmpty causes empty strings, empty structs, empty lists,
	// nil pointers, invalid positions, and missing tokens to be omitted.
	OmitEmpty bool
}

type debugPrinter struct {
	buf   []byte
	cfg   DebugConfig
	level int
}

// value produces the given value, omitting type information if
// its type is the same as implied type. It reports whether
// anything was produced.
func (d *debugPrinter) value(v reflect.Value, impliedType reflect.Type) bool {
	start := d.pos()
	d.value0(v, impliedType)
	return d.pos() > start
}

func (d *debugPrinter) value0(v reflect.Value, impliedType reflect.Type) {
	if d.cfg.Filter != nil && !d.cfg.Filter(v) {
		return
	}
	// Skip over interfaces and pointers, stopping early if nil.
	concreteType := v.Type()
	for {
		k := v.Kind()
		if k != reflect.Interface && k != reflect.Pointer {
			break
		}
		if v.IsNil() {
			if !d.cfg.OmitEmpty {
				d.printf("nil")
			}
			return
		}
		v = v.Elem()
		if k == reflect.Interface {
			// For example, *ast.Ident can be the concrete type behind an ast.Expr.
			concreteType = v.Type()
		}
	}

	if d.cfg.OmitEmpty && v.IsZero() {
		return
	}

	t := v.Type()
	switch v := v.Interface().(type) {
	// Simple types which can stringify themselves.
	case token.Pos:
		d.printf("%s(%q", t, v)
		// Show relative positions too, if there are any, as they affect formatting.
		if v.HasRelPos() {
			d.printf(", %v", v.RelPos())
		}
		d.printf(")")
		return
	case token.Token:
		d.printf("%s(%q)", t, v)
		return
	}

	switch t.Kind() {
	default:
		// We assume all other kinds are basic in practice, like string or bool.
		if t.PkgPath() != "" {
			// Mention defined and non-predeclared types, for clarity.
			d.printf("%s(%#v)", t, v)
		} else {
			d.printf("%#v", v)
		}

	case reflect.Slice, reflect.Struct:
		valueStart := d.pos()
		// We print the concrete type when it differs from an implied type.
		if concreteType != impliedType {
			d.printf("%s", concreteType)
		}
		d.printf("{")
		d.level++
		var anyElems bool
		if t.Kind() == reflect.Slice {
			anyElems = d.sliceElems(v, t.Elem())
		} else {
			anyElems = d.structFields(v)
		}
		d.level--
		if !anyElems && d.cfg.OmitEmpty {
			d.truncate(valueStart)
		} else {
			if anyElems {
				d.newline()
			}
			d.printf("}")
		}
	}
}

func (d *debugPrinter) sliceElems(v reflect.Value, elemType reflect.Type) (anyElems bool) {
	for i := 0; i < v.Len(); i++ {
		ev := v.Index(i)
		elemStart := d.pos()
		d.newline()
		// Note: a slice literal implies the type of its elements
		// so we can avoid mentioning the type
		// of each element if it matches.
		if d.value(ev, elemType) {
			anyElems = true
		} else {
			d.truncate(elemStart)
		}
	}
	return anyElems
}

func (d *debugPrinter) structFields(v reflect.Value) (anyElems bool) {
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		f := t.Field(i)
		if !gotoken.IsExported(f.Name) {
			continue
		}
		switch f.Name {
		// These fields are cyclic, and they don't represent the syntax anyway.
		case "Scope", "Node", "Unresolved":
			continue
		}
		elemStart := d.pos()
		d.newline()
		d.printf("%s: ", f.Name)
		if d.value(v.Field(i), nil) {
			anyElems = true
		} else {
			d.truncate(elemStart)
		}
	}
	val := v.Addr().Interface()
	if val, ok := val.(ast.Node); ok {
		// Comments attached to a node aren't a regular field, but are still useful.
		// The majority of nodes won't have comments, so skip them when empty.
		if comments := ast.Comments(val); len(comments) > 0 {
			anyElems = true
			d.newline()
			d.printf("Comments: ")
			d.value(reflect.ValueOf(comments), nil)
		}
	}
	return anyElems
}

func (d *debugPrinter) printf(format string, args ...any) {
	d.buf = fmt.Appendf(d.buf, format, args...)
}

func (d *debugPrinter) newline() {
	d.buf = fmt.Appendf(d.buf, "\n%s", strings.Repeat("\t", d.level))
}

func (d *debugPrinter) pos() int {
	return len(d.buf)
}

func (d *debugPrinter) truncate(pos int) {
	d.buf = d.buf[:pos]
}

func DebugStr(x interface{}) (out string) {
	if n, ok := x.(ast.Node); ok {
		comments := ""
		for _, g := range ast.Comments(n) {
			comments += DebugStr(g)
		}
		if comments != "" {
			defer func() { out = "<" + comments + out + ">" }()
		}
	}
	switch v := x.(type) {
	case *ast.File:
		out := ""
		out += DebugStr(v.Decls)
		return out

	case *ast.Package:
		out := "package "
		out += DebugStr(v.Name)
		return out

	case *ast.LetClause:
		out := "let "
		out += DebugStr(v.Ident)
		out += "="
		out += DebugStr(v.Expr)
		return out

	case *ast.Alias:
		out := DebugStr(v.Ident)
		out += "="
		out += DebugStr(v.Expr)
		return out

	case *ast.BottomLit:
		return "_|_"

	case *ast.BasicLit:
		return v.Value

	case *ast.Interpolation:
		for _, e := range v.Elts {
			out += DebugStr(e)
		}
		return out

	case *ast.EmbedDecl:
		out += DebugStr(v.Expr)
		return out

	case *ast.ImportDecl:
		out := "import "
		if v.Lparen != token.NoPos {
			out += "( "
			out += DebugStr(v.Specs)
			out += " )"
		} else {
			out += DebugStr(v.Specs)
		}
		return out

	case *ast.Comprehension:
		out := DebugStr(v.Clauses)
		out += DebugStr(v.Value)
		return out

	case *ast.StructLit:
		out := "{"
		out += DebugStr(v.Elts)
		out += "}"
		return out

	case *ast.ListLit:
		out := "["
		out += DebugStr(v.Elts)
		out += "]"
		return out

	case *ast.Ellipsis:
		out := "..."
		if v.Type != nil {
			out += DebugStr(v.Type)
		}
		return out

	case *ast.ForClause:
		out := "for "
		if v.Key != nil {
			out += DebugStr(v.Key)
			out += ": "
		}
		out += DebugStr(v.Value)
		out += " in "
		out += DebugStr(v.Source)
		return out

	case *ast.IfClause:
		out := "if "
		out += DebugStr(v.Condition)
		return out

	case *ast.Field:
		out := DebugStr(v.Label)
		if t, ok := internal.ConstraintToken(v); ok {
			out += t.String()
		}
		if v.Value != nil {
			switch v.Token {
			case token.ILLEGAL, token.COLON:
				out += ": "
			default:
				out += fmt.Sprintf(" %s ", v.Token)
			}
			out += DebugStr(v.Value)
			for _, a := range v.Attrs {
				out += " "
				out += DebugStr(a)
			}
		}
		return out

	case *ast.Attribute:
		return v.Text

	case *ast.Ident:
		return v.Name

	case *ast.SelectorExpr:
		return DebugStr(v.X) + "." + DebugStr(v.Sel)

	case *ast.CallExpr:
		out := DebugStr(v.Fun)
		out += "("
		out += DebugStr(v.Args)
		out += ")"
		return out

	case *ast.ParenExpr:
		out := "("
		out += DebugStr(v.X)
		out += ")"
		return out

	case *ast.UnaryExpr:
		return v.Op.String() + DebugStr(v.X)

	case *ast.BinaryExpr:
		out := DebugStr(v.X)
		op := v.Op.String()
		if 'a' <= op[0] && op[0] <= 'z' {
			op = fmt.Sprintf(" %s ", op)
		}
		out += op
		out += DebugStr(v.Y)
		return out

	case []*ast.CommentGroup:
		var a []string
		for _, c := range v {
			a = append(a, DebugStr(c))
		}
		return strings.Join(a, "\n")

	case *ast.CommentGroup:
		str := "["
		if v.Doc {
			str += "d"
		}
		if v.Line {
			str += "l"
		}
		str += strconv.Itoa(int(v.Position))
		var a = []string{}
		for _, c := range v.List {
			a = append(a, c.Text)
		}
		return str + strings.Join(a, " ") + "] "

	case *ast.IndexExpr:
		out := DebugStr(v.X)
		out += "["
		out += DebugStr(v.Index)
		out += "]"
		return out

	case *ast.SliceExpr:
		out := DebugStr(v.X)
		out += "["
		out += DebugStr(v.Low)
		out += ":"
		out += DebugStr(v.High)
		out += "]"
		return out

	case *ast.ImportSpec:
		out := ""
		if v.Name != nil {
			out += DebugStr(v.Name)
			out += " "
		}
		out += DebugStr(v.Path)
		return out

	case *ast.Func:
		return fmt.Sprintf("func(%v): %v", DebugStr(v.Args), DebugStr(v.Ret))

	case []ast.Decl:
		if len(v) == 0 {
			return ""
		}
		out := ""
		for _, d := range v {
			out += DebugStr(d)
			out += sep
		}
		return out[:len(out)-len(sep)]

	case []ast.Clause:
		if len(v) == 0 {
			return ""
		}
		out := ""
		for _, c := range v {
			out += DebugStr(c)
			out += " "
		}
		return out

	case []ast.Expr:
		if len(v) == 0 {
			return ""
		}
		out := ""
		for _, d := range v {
			out += DebugStr(d)
			out += sep
		}
		return out[:len(out)-len(sep)]

	case []*ast.ImportSpec:
		if len(v) == 0 {
			return ""
		}
		out := ""
		for _, d := range v {
			out += DebugStr(d)
			out += sep
		}
		return out[:len(out)-len(sep)]

	default:
		if v == nil {
			return ""
		}
		return fmt.Sprintf("<%T>", x)
	}
}

const sep = ", "
