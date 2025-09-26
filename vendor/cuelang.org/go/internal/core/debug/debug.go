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

// Package debug prints a given ADT node.
//
// Note that the result is not valid CUE, but instead prints the internals
// of an ADT node in human-readable form. It uses a simple indentation algorithm
// for improved readability and diffing.
package debug

import (
	"fmt"
	"strconv"
	"strings"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/internal/core/adt"
)

const (
	openTuple  = "\u3008"
	closeTuple = "\u3009"
)

type Config struct {
	Cwd     string
	Compact bool
	Raw     bool
}

// AppendNode writes a string representation of the node to w.
func AppendNode(dst []byte, i adt.StringIndexer, n adt.Node, config *Config) []byte {
	if config == nil {
		config = &Config{}
	}
	p := printer{dst: dst, index: i, cfg: config}
	if config.Compact {
		p := compactPrinter{p}
		p.node(n)
		return p.dst
	}
	p.node(n)
	return p.dst
}

// NodeString returns a string representation of the given node.
// The StringIndexer value i is used to translate elements of n to strings.
// Commonly available implementations of StringIndexer include *adt.OpContext
// and *runtime.Runtime.
func NodeString(i adt.StringIndexer, n adt.Node, config *Config) string {
	var buf [128]byte
	return string(AppendNode(buf[:0], i, n, config))
}

type printer struct {
	dst    []byte
	index  adt.StringIndexer
	indent string
	cfg    *Config

	// keep track of vertices to avoid cycles.
	stack []*adt.Vertex

	// modes:
	// - show vertex
	// - show original conjuncts
	// - show unevaluated
	// - auto
}

func (w *printer) string(s string) {
	if len(w.indent) > 0 {
		s = strings.Replace(s, "\n", "\n"+w.indent, -1)
	}
	w.dst = append(w.dst, s...)
}

func (w *printer) int(i int64) {
	w.dst = strconv.AppendInt(w.dst, i, 10)
}

func (w *printer) label(f adt.Feature) {
	switch {
	case f.IsHidden():
		ident := f.IdentString(w.index)
		if pkgName := f.PkgID(w.index); pkgName != "_" {
			ident = fmt.Sprintf("%s(%s)", ident, pkgName)
		}
		w.string(ident)

	case f.IsLet():
		ident := f.RawString(w.index)
		ident = strings.Replace(ident, "\x00", "#", 1)
		w.string(ident)

	default:
		w.string(f.SelectorString(w.index))
	}
}

func (w *printer) ident(f adt.Feature) {
	w.string(f.IdentString(w.index))
}

func (w *printer) path(v *adt.Vertex) {
	if p := v.Parent; p != nil && p.Label != 0 {
		w.path(v.Parent)
		w.string(".")
	}
	w.label(v.Label)
}

func (w *printer) shared(v *adt.Vertex) {
	w.string("~(")
	w.path(v)
	w.string(")")
}

// printShared prints a reference to a structure-shared node that is a value
// of v, if it is a shared node. It reports the dereferenced node and whether
// the node was printed.
func (w *printer) printShared(v0 *adt.Vertex) (x *adt.Vertex, ok bool) {

	// Handle cyclic shared nodes differently.  If a shared node was part of
	// a disjunction, it will still be wrapped in a disjunct Vertex.
	// Similarly, a shared node should never point to a disjunct directly,
	// but rather to the original arc that subsequently points to a
	// disjunct.
	v0 = v0.DerefDisjunct()
	isCyclic := v0.IsCyclic
	s, ok := v0.BaseValue.(*adt.Vertex)
	v1 := v0.DerefValue()
	useReference := v0.IsShared && !v1.IsDetached() && v1.MayAttach()
	isCyclic = isCyclic || v1.IsCyclic
	_ = isCyclic
	// NOTE(debug): use this line instead of the following to expand shared
	// cases where it is safe to do so.
	// if useReference && isCyclic && ok && len(v.Arcs) > 0 {
	if useReference && ok && len(v1.Arcs) > 0 {
		w.shared(v1)
		return v1, true
	}
	if !w.pushVertex(v1) {
		if s != nil {
			w.shared(s)
			w.string(" =>")
		}
		w.shared(v1)
		return v1, true
	}
	return v1, false
}

func (w *printer) pushVertex(v *adt.Vertex) bool {
	for _, x := range w.stack {
		if x == v {
			w.string("<TODO: unmarked structural cycle>")
			return false
		}
	}
	w.stack = append(w.stack, v)
	return true
}

func (w *printer) popVertex() {
	w.stack = w.stack[:len(w.stack)-1]
}

func (w *printer) shortError(errs errors.Error) {
	for {
		msg, args := errs.Msg()
		w.dst = fmt.Appendf(w.dst, msg, args...)

		err := errors.Unwrap(errs)
		if err == nil {
			break
		}

		if errs, _ = err.(errors.Error); errs != nil {
			w.string(err.Error())
			break
		}
	}
}

func (w *printer) interpolation(x *adt.Interpolation) {
	quote := `"`
	if x.K == adt.BytesKind {
		quote = `'`
	}
	w.string(quote)
	for i := 0; i < len(x.Parts); i += 2 {
		switch x.K {
		case adt.StringKind:
			if s, ok := x.Parts[i].(*adt.String); ok {
				w.string(s.Str)
			} else {
				w.string("<bad string>")
			}
		case adt.BytesKind:
			if s, ok := x.Parts[i].(*adt.Bytes); ok {
				w.dst = append(w.dst, s.B...)
			} else {
				w.string("<bad bytes>")
			}
		}
		if i+1 < len(x.Parts) {
			w.string(`\(`)
			w.node(x.Parts[i+1])
			w.string(`)`)
		}
	}
	w.string(quote)
}

func (w *printer) node(n adt.Node) {
	switch x := n.(type) {
	case *adt.Vertex:
		x, ok := w.printShared(x)
		if ok {
			return
		}
		defer w.popVertex()

		var kind adt.Kind
		if x.BaseValue != nil {
			kind = x.BaseValue.Kind()
		}

		kindStr := kind.String()

		// TODO: replace with showing full closedness data.
		if x.IsClosedList() || x.IsClosedStruct() {
			if kind == adt.ListKind || kind == adt.StructKind {
				kindStr = "#" + kindStr
			}
		}

		w.dst = fmt.Appendf(w.dst, "(%s){", kindStr)

		saved := w.indent
		w.indent += "  "
		defer func() { w.indent = saved }()

		switch v := x.BaseValue.(type) {
		case nil:
		case *adt.Bottom:
			// TODO: reuse bottom.
			saved := w.indent
			w.indent += "// "
			w.string("\n")
			w.dst = fmt.Appendf(w.dst, "[%v]", v.Code)
			if !v.ChildError {
				msg := errors.Details(v.Err, &errors.Config{
					Cwd:     w.cfg.Cwd,
					ToSlash: true,
				})
				msg = strings.TrimSpace(msg)
				if msg != "" {
					w.string(" ")
					w.string(msg)
				}

				// TODO: we could consider removing CycleError here. It does
				// seem safer, however, as sometimes structural cycles are
				// detected as regular cycles.
				// Alternatively, we could consider to never report arcs if
				// there is any error.
				if v.Code == adt.CycleError || v.Code == adt.StructuralCycleError {
					goto endVertex
				}
			}
			w.indent = saved

		case *adt.StructMarker, *adt.ListMarker:
			// if len(x.Arcs) == 0 {
			// 	// w.string("}")
			// 	// return
			// }

		case adt.Value:
			if len(x.Arcs) == 0 {
				w.string(" ")
				w.node(v)
				w.string(" }")
				return
			}
			w.string("\n")
			w.node(v)
		}

		for _, a := range x.Arcs {
			if a.ArcType == adt.ArcNotPresent {
				continue
			}
			if a.Label.IsLet() {
				w.string("\n")
				w.string("let ")
				w.label(a.Label)
				if a.MultiLet {
					w.string("multi")
				}
				w.string(" = ")
				if c := a.ConjunctAt(0); a.MultiLet {
					w.node(c.Expr())
					continue
				}
				w.node(a)
			} else {
				w.string("\n")
				w.label(a.Label)
				w.string(a.ArcType.Suffix())
				w.string(": ")
				w.node(a)
			}
		}

		if x.BaseValue == nil {
			w.indent += "// "
			w.string("// ")
			for i, c := range x.Conjuncts {
				if c.CloseInfo.FromDef || c.CloseInfo.FromEmbed {
					w.string("[")
					if c.CloseInfo.FromDef {
						w.string("d")
					}
					if c.CloseInfo.FromEmbed {
						w.string("e")
					}
					w.string("]")
				}
				if i > 0 {
					w.string(" & ")
				}
				w.node(c.Elem()) // TODO: also include env?
			}
		}

	endVertex:

		w.indent = saved
		w.string("\n")
		w.string("}")

	case *adt.StructMarker:
		w.string("struct")

	case *adt.ListMarker:
		w.string("list")

	case *adt.StructLit:
		if len(x.Decls) == 0 {
			w.string("{}")
			break
		}
		w.string("{")
		w.indent += "  "
		for _, d := range x.Decls {
			w.string("\n")
			w.node(d)
		}
		w.indent = w.indent[:len(w.indent)-2]
		w.string("\n}")

	case *adt.ListLit:
		if len(x.Elems) == 0 {
			w.string("[]")
			break
		}
		w.string("[")
		w.indent += "  "
		for _, d := range x.Elems {
			w.string("\n")
			w.node(d)
			w.string(",")
		}
		w.indent = w.indent[:len(w.indent)-2]
		w.string("\n]")

	case *adt.Field:
		w.label(x.Label)
		w.string(x.ArcType.Suffix())
		w.string(":")
		w.string(" ")
		w.node(x.Value)

	case *adt.LetField:
		w.string("let ")
		w.label(x.Label)
		if x.IsMulti {
			w.string("multi")
		}
		w.string(" = ")
		w.node(x.Value)

	case *adt.BulkOptionalField:
		w.string("[")
		w.node(x.Filter)
		w.string("]: ")
		w.node(x.Value)

	case *adt.DynamicField:
		w.node(x.Key)
		w.string(x.ArcType.Suffix())
		w.string(": ")
		w.node(x.Value)

	case *adt.Ellipsis:
		w.string("...")
		if x.Value != nil {
			w.node(x.Value)
		}

	case *adt.Bottom:
		w.string(`_|_`)
		if x.Err != nil {
			w.string("(")
			w.shortError(x.Err)
			w.string(")")
		}

	case *adt.Null:
		w.string("null")

	case *adt.Bool:
		w.dst = strconv.AppendBool(w.dst, x.B)

	case *adt.Num:
		w.string(x.X.String())

	case *adt.String:
		w.dst = literal.String.Append(w.dst, x.Str)

	case *adt.Bytes:
		w.dst = literal.Bytes.Append(w.dst, string(x.B))

	case *adt.Top:
		w.string("_")

	case *adt.BasicType:
		w.string(x.K.String())

	case *adt.BoundExpr:
		w.string(x.Op.String())
		w.node(x.Expr)

	case *adt.BoundValue:
		w.string(x.Op.String())
		w.node(x.Value)

	case *adt.NodeLink:
		w.string(openTuple)
		for i, f := range x.Node.Path() {
			if i > 0 {
				w.string(".")
			}
			w.label(f)
		}
		w.string(closeTuple)

	case *adt.FieldReference:
		w.string(openTuple)
		w.int(int64(x.UpCount))
		w.string(";")
		w.label(x.Label)
		w.string(closeTuple)

	case *adt.ValueReference:
		w.string(openTuple)
		w.int(int64(x.UpCount))
		w.string(closeTuple)

	case *adt.LabelReference:
		w.string(openTuple)
		w.int(int64(x.UpCount))
		w.string(";-")
		w.string(closeTuple)

	case *adt.DynamicReference:
		w.string(openTuple)
		w.int(int64(x.UpCount))
		w.string(";(")
		w.node(x.Label)
		w.string(")")
		w.string(closeTuple)

	case *adt.ImportReference:
		w.string(openTuple + "import;")
		w.label(x.ImportPath)
		w.string(closeTuple)

	case *adt.LetReference:
		w.string(openTuple)
		w.int(int64(x.UpCount))
		w.string(";let ")
		w.label(x.Label)
		w.string(closeTuple)

	case *adt.SelectorExpr:
		w.node(x.X)
		w.string(".")
		w.label(x.Sel)

	case *adt.IndexExpr:
		w.node(x.X)
		w.string("[")
		w.node(x.Index)
		w.string("]")

	case *adt.SliceExpr:
		w.node(x.X)
		w.string("[")
		if x.Lo != nil {
			w.node(x.Lo)
		}
		w.string(":")
		if x.Hi != nil {
			w.node(x.Hi)
		}
		if x.Stride != nil {
			w.string(":")
			w.node(x.Stride)
		}
		w.string("]")

	case *adt.Interpolation:
		w.interpolation(x)

	case *adt.UnaryExpr:
		w.string(x.Op.String())
		w.node(x.X)

	case *adt.BinaryExpr:
		w.string("(")
		w.node(x.X)
		w.string(" ")
		w.string(x.Op.String())
		w.string(" ")
		w.node(x.Y)
		w.string(")")

	case *adt.CallExpr:
		w.node(x.Fun)
		w.string("(")
		for i, a := range x.Args {
			if i > 0 {
				w.string(", ")
			}
			w.node(a)
		}
		w.string(")")

	case *adt.Builtin:
		if x.Package != 0 {
			w.label(x.Package)
			w.string(".")
		}
		w.string(x.Name)

	case *adt.BuiltinValidator:
		w.node(x.Builtin)
		w.string("(")
		for i, a := range x.Args {
			if i > 0 {
				w.string(", ")
			}
			w.node(a)
		}
		w.string(")")

	case *adt.DisjunctionExpr:
		w.string("(")
		for i, a := range x.Values {
			if i > 0 {
				w.string("|")
			}
			// Disjunct
			if a.Default {
				w.string("*")
			}
			w.node(a.Val)
		}
		w.string(")")

	case *adt.Conjunction:
		w.string("&(")
		for i, c := range x.Values {
			if i > 0 {
				w.string(", ")
			}
			w.node(c)
		}
		w.string(")")

	case *adt.ConjunctGroup:
		w.string("&[")
		for i, c := range *x {
			if i > 0 {
				w.string(", ")
			}
			w.node(c.Expr())
		}
		w.string("]")

	case *adt.Disjunction:
		w.string("|(")
		for i, c := range x.Values {
			if i > 0 {
				w.string(", ")
			}
			if i < x.NumDefaults {
				w.string("*")
			}
			w.node(c)
		}
		w.string(")")

	case *adt.Comprehension:
		for _, c := range x.Clauses {
			w.node(c)
		}
		w.node(adt.ToExpr(x.Value))

	case *adt.ForClause:
		w.string("for ")
		w.ident(x.Key)
		w.string(", ")
		w.ident(x.Value)
		w.string(" in ")
		w.node(x.Src)
		w.string(" ")

	case *adt.IfClause:
		w.string("if ")
		w.node(x.Condition)
		w.string(" ")

	case *adt.LetClause:
		w.string("let ")
		w.ident(x.Label)
		w.string(" = ")
		w.node(x.Expr)
		w.string(" ")

	case *adt.ValueClause:

	default:
		panic(fmt.Sprintf("unknown type %T", x))
	}
}
