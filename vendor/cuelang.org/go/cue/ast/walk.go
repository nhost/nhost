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

package ast

import (
	"fmt"
)

func walkList[N Node](list []N, before func(Node) bool, after func(Node)) {
	for _, node := range list {
		Walk(node, before, after)
	}
}

// Walk traverses an AST in depth-first order: It starts by calling f(node);
// node must not be nil. If before returns true, Walk invokes f recursively for
// each of the non-nil children of node, followed by a call of after. Both
// functions may be nil. If before is nil, it is assumed to always return true.
func Walk(node Node, before func(Node) bool, after func(Node)) {
	if before != nil && !before(node) {
		return
	}

	// TODO: record the comment groups and interleave with the values like for
	// parsing and printing?
	walkList(Comments(node), before, after)

	// walk children
	// (the order of the cases matches the order
	// of the corresponding node types in go)
	switch n := node.(type) {
	// Comments and fields
	case *Comment:
		// nothing to do

	case *CommentGroup:
		walkList(n.List, before, after)

	case *Attribute:
		// nothing to do

	case *Field:
		Walk(n.Label, before, after)
		if n.Value != nil {
			Walk(n.Value, before, after)
		}
		walkList(n.Attrs, before, after)

	case *Func:
		walkList(n.Args, before, after)
		Walk(n.Ret, before, after)

	case *StructLit:
		walkList(n.Elts, before, after)

	// Expressions
	case *BottomLit, *BadExpr, *Ident, *BasicLit:
		// nothing to do

	case *Interpolation:
		walkList(n.Elts, before, after)

	case *ListLit:
		walkList(n.Elts, before, after)

	case *Ellipsis:
		if n.Type != nil {
			Walk(n.Type, before, after)
		}

	case *ParenExpr:
		Walk(n.X, before, after)

	case *SelectorExpr:
		Walk(n.X, before, after)
		Walk(n.Sel, before, after)

	case *IndexExpr:
		Walk(n.X, before, after)
		Walk(n.Index, before, after)

	case *SliceExpr:
		Walk(n.X, before, after)
		if n.Low != nil {
			Walk(n.Low, before, after)
		}
		if n.High != nil {
			Walk(n.High, before, after)
		}

	case *CallExpr:
		Walk(n.Fun, before, after)
		walkList(n.Args, before, after)

	case *UnaryExpr:
		Walk(n.X, before, after)

	case *BinaryExpr:
		Walk(n.X, before, after)
		Walk(n.Y, before, after)

	// Declarations
	case *ImportSpec:
		if n.Name != nil {
			Walk(n.Name, before, after)
		}
		Walk(n.Path, before, after)

	case *BadDecl:
		// nothing to do

	case *ImportDecl:
		walkList(n.Specs, before, after)

	case *EmbedDecl:
		Walk(n.Expr, before, after)

	case *LetClause:
		Walk(n.Ident, before, after)
		Walk(n.Expr, before, after)

	case *Alias:
		Walk(n.Ident, before, after)
		Walk(n.Expr, before, after)

	case *Comprehension:
		walkList(n.Clauses, before, after)
		Walk(n.Value, before, after)

	// Files and packages
	case *File:
		walkList(n.Decls, before, after)

	case *Package:
		Walk(n.Name, before, after)

	case *ForClause:
		if n.Key != nil {
			Walk(n.Key, before, after)
		}
		Walk(n.Value, before, after)
		Walk(n.Source, before, after)

	case *IfClause:
		Walk(n.Condition, before, after)

	default:
		panic(fmt.Sprintf("Walk: unexpected node type %T", n))
	}

	if after != nil {
		after(node)
	}
}
