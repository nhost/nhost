package ast_test

import (
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl/ast"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// TestNodeSpanRoundTrip constructs one of each concrete node, embeds
// a known span, and reads it back. Catches any node type that fails
// to embed the span helper.
func TestNodeSpanRoundTrip(t *testing.T) {
	sp := token.Span{
		Start: token.Position{Line: 1, Column: 2, Offset: 3},
		End:   token.Position{Line: 4, Column: 5, Offset: 6},
	}

	nodes := []ast.Node{
		ast.Object{Span: sp},
		ast.Array{Span: sp},
		ast.String{Span: sp},
		ast.Number{Span: sp},
		ast.Boolean{Span: sp},
		ast.Null{Span: sp},
		ast.StringTem{Span: sp},
		ast.Var{Span: sp},
		ast.RequiredFieldAccess{Span: sp},
		ast.OptionalFieldAccess{Span: sp},
		ast.Iff{Span: sp},
		ast.Range{Span: sp},
		ast.Eq{Span: sp},
		ast.NotEq{Span: sp},
		ast.Gt{Span: sp},
		ast.Gte{Span: sp},
		ast.Lt{Span: sp},
		ast.Lte{Span: sp},
		ast.And{Span: sp},
		ast.Or{Span: sp},
		ast.In{Span: sp},
		ast.Defaulting{Span: sp},
		ast.Function{Span: sp},
	}
	if len(nodes) != 23 {
		t.Fatalf(
			"expected 23 node types (22 ValueExt + RequiredFieldAccess distinct), got %d",
			len(nodes),
		)
	}
	// Every concrete node must round-trip its embedded span.
	for _, n := range nodes {
		if n.GetSpan() != sp {
			t.Errorf("%T.GetSpan() = %+v, want %+v", n, n.GetSpan(), sp)
		}
	}
}
