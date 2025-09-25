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

package dep

import (
	"fmt"

	"cuelang.org/go/internal/core/adt"
)

// dynamic visits conjuncts of structs that are defined by the root for all
// of its fields, recursively.
//
// The current algorithm visits all known conjuncts and descends into the
// evaluated Vertex. A more correct and more performant algorithm would be to
// descend into the conjuncts and evaluate the necessary values, like fields
// and comprehension sources.
func (v *visitor) dynamic(n *adt.Vertex, top bool) {
	found := false
	// TODO: Consider if we should only visit the conjuncts of the disjunction
	// for dynamic mode.
	n.VisitLeafConjuncts(func(c adt.Conjunct) bool {
		if v.marked[c.Expr()] {
			found = true
			return false
		}
		return true
	})

	if !found {
		return
	}

	if v.visit(n, top) != nil {
		return
	}

	n = n.DerefValue()
	for _, a := range n.Arcs {
		if !a.IsDefined(v.ctxt) || a.Label.IsLet() {
			continue
		}
		v.dynamic(a, false)
	}
}

type marked map[adt.Expr]bool

// TODO: factor out the below logic as either a low-level dependency analyzer or
// some walk functionality.

// markExpr visits all nodes in an expression to mark dependencies.
func (m marked) markExpr(x adt.Expr) {
	m[x] = true

	switch x := x.(type) {
	default:

	case nil:
	case *adt.Vertex:
		x.VisitLeafConjuncts(func(c adt.Conjunct) bool {
			m.markExpr(c.Expr())
			return true
		})

	case *adt.BinaryExpr:
		if x.Op == adt.AndOp {
			m.markExpr(x.X)
			m.markExpr(x.Y)
		}

	case *adt.StructLit:
		for _, e := range x.Decls {
			switch x := e.(type) {
			case *adt.Field:
				m.markExpr(x.Value)

			case *adt.BulkOptionalField:
				m.markExpr(x.Value)

			case *adt.LetField:
				m.markExpr(x.Value)

			case *adt.DynamicField:
				m.markExpr(x.Value)

			case *adt.Ellipsis:
				m.markExpr(x.Value)

			case adt.Expr:
				m.markExpr(x)

			case *adt.Comprehension:
				m.markComprehension(x)

			default:
				panic(fmt.Sprintf("unreachable %T", x))
			}
		}

	case *adt.ListLit:
		for _, e := range x.Elems {
			switch x := e.(type) {
			case adt.Expr:
				m.markExpr(x)

			case *adt.Comprehension:
				m.markComprehension(x)

			case *adt.Ellipsis:
				m.markExpr(x.Value)

			default:
				panic(fmt.Sprintf("unreachable %T", x))
			}
		}

	case *adt.DisjunctionExpr:
		for _, d := range x.Values {
			m.markExpr(d.Val)
		}
	}
}

func (m marked) markComprehension(y *adt.Comprehension) {
	m.markExpr(adt.ToExpr(y.Value))
}
