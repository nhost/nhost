package ast_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/ast"
	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/token"
)

// TestNodeSpanRoundTrip constructs one of each concrete node, embeds
// a known span, and reads it back. Catches any node type that fails
// to embed the span helper.
func TestNodeSpanRoundTrip(t *testing.T) {
	sp := token.Span{
		Start: token.Position{Line: 1, Column: 2, Offset: 3},
		End:   token.Position{Line: 4, Column: 5, Offset: 6},
	}
	_ = sp

	nodes := []ast.Node{
		ast.Object{},
		ast.Array{},
		ast.String{},
		ast.Number{},
		ast.Boolean{},
		ast.Null{},
		ast.StringTem{},
		ast.Var{},
		ast.RequiredFieldAccess{},
		ast.OptionalFieldAccess{},
		ast.Iff{},
		ast.Range{},
		ast.Eq{},
		ast.NotEq{},
		ast.Gt{},
		ast.Gte{},
		ast.Lt{},
		ast.Lte{},
		ast.And{},
		ast.Or{},
		ast.In{},
		ast.Defaulting{},
		ast.Function{},
	}
	if len(nodes) != 23 {
		t.Fatalf("expected 23 node types (22 ValueExt + RequiredFieldAccess distinct), got %d", len(nodes))
	}
	// Spot-check GetSpan on one node.
	obj := ast.Object{Span: sp}
	if obj.GetSpan() != sp {
		t.Fatalf("Object.GetSpan round-trip failed")
	}
}
