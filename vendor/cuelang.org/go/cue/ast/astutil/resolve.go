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

// This file implements scopes and the objects they contain.

package astutil

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
)

// An ErrFunc processes errors.
type ErrFunc func(pos token.Pos, msg string, args ...interface{})

// TODO: future development
//
// Resolution currently assigns values along the table below. This is based on
// Go's resolver and is not quite convenient for CUE's purposes. For one, CUE
// allows manually setting resolution and than call astutil.Sanitize to
// normalize the ast.File. Manually assigning resolutions according to the
// below table is rather tedious though.
//
// Instead of using the Scope and Node fields in identifiers, we suggest the
// following assignments:
//
//    Reference Node // an Decl or Clause
//    Ident *Ident   // The identifier in References (optional)
//
// References always refers to the direct element in the scope in which the
// identifier occurs, not the final value, so: *Field, *LetClause, *ForClause,
// etc. In case Ident is defined, it must be the same pointer as the
// referencing identifier. In case it is not defined, the Name of the
// referencing identifier can be used to locate the proper identifier in the
// referenced node.
//
// The Scope field in the original design then loses its function.
//
// Type of reference      Scope          Node
// Let Clause             File/Struct    LetClause
// Alias declaration      File/Struct    Alias (deprecated)
// Illegal Reference      File/Struct
// Value
//   X in a: X=y          Field          Alias
// Fields
//   X in X: y            File/Struct    Expr (y)
//   X in X=x: y          File/Struct    Field
//   X in X=(x): y        File/Struct    Field
//   X in X="\(x)": y     File/Struct    Field
//   X in [X=x]: y        Field          Expr (x)
//   X in X=[x]: y        Field          Field
//
// for k, v in            ForClause      Ident
// let x = y              LetClause      Ident
//
// Fields inside lambda
//    Label               Field          Expr
//    Value               Field          Field
// Pkg                    nil            ImportSpec

// Resolve resolves all identifiers in a file. Unresolved identifiers are
// recorded in Unresolved. It will not overwrite already resolved values.
func Resolve(f *ast.File, errFn ErrFunc) {
	walkVisitor(f, &scope{errFn: errFn, identFn: resolveIdent})
}

// Resolve resolves all identifiers in an expression.
// It will not overwrite already resolved values.
func ResolveExpr(e ast.Expr, errFn ErrFunc) {
	f := &ast.File{}
	walkVisitor(e, &scope{file: f, errFn: errFn, identFn: resolveIdent})
}

// A Scope maintains the set of named language entities declared
// in the scope and a link to the immediately surrounding (outer)
// scope.
type scope struct {
	file    *ast.File
	outer   *scope
	node    ast.Node
	index   map[string]entry
	inField bool

	identFn func(s *scope, n *ast.Ident) bool
	nameFn  func(name string)
	errFn   func(p token.Pos, msg string, args ...interface{})
}

type entry struct {
	node ast.Node
	link ast.Node // Alias, LetClause, or Field
}

func newScope(f *ast.File, outer *scope, node ast.Node, decls []ast.Decl) *scope {
	const n = 4 // initial scope capacity
	s := &scope{
		file:    f,
		outer:   outer,
		node:    node,
		index:   make(map[string]entry, n),
		identFn: outer.identFn,
		nameFn:  outer.nameFn,
		errFn:   outer.errFn,
	}
	for _, d := range decls {
		switch x := d.(type) {
		case *ast.Field:
			label := x.Label

			if a, ok := x.Label.(*ast.Alias); ok {
				name := a.Ident.Name
				if _, ok := a.Expr.(*ast.ListLit); !ok {
					s.insert(name, x, a)
				}
			}

			// default:
			name, isIdent, _ := ast.LabelName(label)
			if isIdent {
				v := x.Value
				// Avoid interpreting value aliases at this point.
				if a, ok := v.(*ast.Alias); ok {
					v = a.Expr
				}
				s.insert(name, v, x)
			}
		case *ast.LetClause:
			name, isIdent, _ := ast.LabelName(x.Ident)
			if isIdent {
				s.insert(name, x, x)
			}
		case *ast.Alias:
			name, isIdent, _ := ast.LabelName(x.Ident)
			if isIdent {
				s.insert(name, x, x)
			}
		case *ast.ImportDecl:
			for _, spec := range x.Specs {
				info, _ := ParseImportSpec(spec)
				s.insert(info.Ident, spec, spec)
			}
		}
	}
	return s
}

func (s *scope) isLet(n ast.Node) bool {
	if _, ok := s.node.(*ast.Field); ok {
		return true
	}
	switch n.(type) {
	case *ast.LetClause, *ast.Alias, *ast.Field:
		return true
	}
	return false
}

func (s *scope) mustBeUnique(n ast.Node) bool {
	if _, ok := s.node.(*ast.Field); ok {
		return true
	}
	switch n.(type) {
	// TODO: add *ast.ImportSpec when some implementations are moved over to
	// Sanitize.
	case *ast.ImportSpec, *ast.LetClause, *ast.Alias, *ast.Field:
		return true
	}
	return false
}

func (s *scope) insert(name string, n, link ast.Node) {
	if name == "" {
		return
	}
	if s.nameFn != nil {
		s.nameFn(name)
	}
	// TODO: record both positions.
	if outer, _, existing := s.lookup(name); existing.node != nil {
		if s.isLet(n) != outer.isLet(existing.node) {
			s.errFn(n.Pos(), "cannot have both alias and field with name %q in same scope", name)
			return
		} else if s.mustBeUnique(n) || outer.mustBeUnique(existing.node) {
			if outer == s {
				if _, ok := existing.node.(*ast.ImportSpec); ok {
					return
					// TODO:
					// s.errFn(n.Pos(), "conflicting declaration %s\n"+
					// 	"\tprevious declaration at %s",
					// 	name, existing.node.Pos())
				} else {
					s.errFn(n.Pos(), "alias %q redeclared in same scope", name)
				}
				return
			}
			// TODO: Should we disallow shadowing of aliases?
			// This was the case, but it complicates the transition to
			// square brackets. The spec says allow it.
			// s.errFn(n.Pos(), "alias %q already declared in enclosing scope", name)
		}
	}
	s.index[name] = entry{node: n, link: link}
}

func (s *scope) resolveScope(name string, node ast.Node) (scope ast.Node, e entry, ok bool) {
	last := s
	for s != nil {
		if n, ok := s.index[name]; ok && node == n.node {
			if last.node == n.node {
				return nil, n, true
			}
			return s.node, n, true
		}
		s, last = s.outer, s
	}
	return nil, entry{}, false
}

func (s *scope) lookup(name string) (p *scope, obj ast.Node, node entry) {
	// TODO(#152): consider returning nil for obj if it is a reference to root.
	// last := s
	if name == "_" {
		return nil, nil, entry{}
	}
	for s != nil {
		if n, ok := s.index[name]; ok {
			if _, ok := n.node.(*ast.ImportSpec); ok {
				return s, nil, n
			}
			return s, s.node, n
		}
		// s, last = s.outer, s
		s = s.outer
	}
	return nil, nil, entry{}
}

func (s *scope) After(n ast.Node) {}
func (s *scope) Before(n ast.Node) (w visitor) {
	switch x := n.(type) {
	case *ast.File:
		s := newScope(x, s, x, x.Decls)
		// Support imports.
		for _, d := range x.Decls {
			walkVisitor(d, s)
		}
		return nil

	case *ast.StructLit:
		return newScope(s.file, s, x, x.Elts)

	case *ast.Comprehension:
		s = scopeClauses(s, x.Clauses)
		walkVisitor(x.Value, s)
		return nil

	case *ast.Field:
		var n ast.Node = x.Label
		alias, ok := x.Label.(*ast.Alias)
		if ok {
			n = alias.Expr
		}

		switch label := n.(type) {
		case *ast.ParenExpr:
			walkVisitor(label, s)

		case *ast.Interpolation:
			walkVisitor(label, s)

		case *ast.ListLit:
			if len(label.Elts) != 1 {
				break
			}
			s = newScope(s.file, s, x, nil)
			if alias != nil {
				if name, _, _ := ast.LabelName(alias.Ident); name != "" {
					s.insert(name, x, alias)
				}
			}

			expr := label.Elts[0]

			if a, ok := expr.(*ast.Alias); ok {
				expr = a.Expr

				// Add to current scope, instead of the value's, and allow
				// references to bind to these illegally.
				// We need this kind of administration anyway to detect
				// illegal name clashes, and it allows giving better error
				// messages. This puts the burden on clients of this library
				// to detect illegal usage, though.
				s.insert(a.Ident.Name, a.Expr, a)
			}

			ast.Walk(expr, nil, func(n ast.Node) {
				if x, ok := n.(*ast.Ident); ok {
					for s := s; s != nil && !s.inField; s = s.outer {
						if _, ok := s.index[x.Name]; ok {
							s.errFn(n.Pos(),
								"reference %q in label expression refers to field against which it would be matched", x.Name)
						}
					}
				}
			})
			walkVisitor(expr, s)
		}

		if n := x.Value; n != nil {
			if alias, ok := x.Value.(*ast.Alias); ok {
				// TODO: this should move into Before once decl attributes
				// have been fully deprecated and embed attributes are introduced.
				s = newScope(s.file, s, x, nil)
				s.insert(alias.Ident.Name, alias, x)
				n = alias.Expr
			}
			s.inField = true
			walkVisitor(n, s)
			s.inField = false
		}

		return nil

	case *ast.LetClause:
		// Disallow referring to the current LHS name.
		name := x.Ident.Name
		saved := s.index[name]
		delete(s.index, name) // The same name may still appear in another scope

		if x.Expr != nil {
			walkVisitor(x.Expr, s)
		}
		s.index[name] = saved
		return nil

	case *ast.Alias:
		// Disallow referring to the current LHS name.
		name := x.Ident.Name
		saved := s.index[name]
		delete(s.index, name) // The same name may still appear in another scope

		if x.Expr != nil {
			walkVisitor(x.Expr, s)
		}
		s.index[name] = saved
		return nil

	case *ast.ImportSpec:
		return nil

	case *ast.Attribute:
		// TODO: tokenize attributes, resolve identifiers and store the ones
		// that resolve in a list.

	case *ast.SelectorExpr:
		walkVisitor(x.X, s)
		return nil

	case *ast.Ident:
		if s.identFn(s, x) {
			return nil
		}
	}
	return s
}

func resolveIdent(s *scope, x *ast.Ident) bool {
	name, ok, _ := ast.LabelName(x)
	if !ok {
		// TODO: generate error
		return false
	}
	if _, obj, node := s.lookup(name); node.node != nil {
		switch x.Node {
		case nil:
			x.Node = node.node
			x.Scope = obj

		case node.node:
			x.Scope = obj

		default: // x.Node != node
			scope, _, ok := s.resolveScope(name, x.Node)
			if !ok {
				s.file.Unresolved = append(s.file.Unresolved, x)
			}
			x.Scope = scope
		}
	} else {
		s.file.Unresolved = append(s.file.Unresolved, x)
	}
	return true
}

func scopeClauses(s *scope, clauses []ast.Clause) *scope {
	for _, c := range clauses {
		switch x := c.(type) {
		case *ast.ForClause:
			walkVisitor(x.Source, s)
			s = newScope(s.file, s, x, nil)
			if x.Key != nil {
				s.insert(x.Key.Name, x.Key, x)
			}
			s.insert(x.Value.Name, x.Value, x)

		case *ast.LetClause:
			walkVisitor(x.Expr, s)
			s = newScope(s.file, s, x, nil)
			s.insert(x.Ident.Name, x.Ident, x)

		default:
			walkVisitor(c, s)
		}
	}
	return s
}

// Debugging support
func (s *scope) String() string {
	var b strings.Builder
	fmt.Fprintf(&b, "scope %p {", s)
	if s != nil && len(s.index) > 0 {
		fmt.Fprintln(&b)
		for name := range s.index {
			fmt.Fprintf(&b, "\t%v\n", name)
		}
	}
	fmt.Fprintf(&b, "}\n")
	return b.String()
}
