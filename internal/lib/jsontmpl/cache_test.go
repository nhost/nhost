package jsontmpl

import (
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl/ast"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

func TestASTCache_LRUEviction(t *testing.T) {
	c := newASTCache(2)
	a := ast.Boolean{Span: token.Span{}, Value: true}
	b := ast.Boolean{Span: token.Span{}, Value: false}
	d := ast.Null{}

	c.put("a", a)
	c.put("b", b)
	c.put("d", d) // evicts a (oldest)

	if _, ok := c.get("a"); ok {
		t.Fatal("a should have been evicted")
	}
	if _, ok := c.get("b"); !ok {
		t.Fatal("b should be present")
	}
	if _, ok := c.get("d"); !ok {
		t.Fatal("d should be present")
	}
}

func TestASTCache_RecencyTouch(t *testing.T) {
	c := newASTCache(2)
	c.put("a", ast.Boolean{Value: true})
	c.put("b", ast.Boolean{Value: false})
	// Touch a — moves to front, so the next insert evicts b.
	_, _ = c.get("a")
	c.put("d", ast.Null{})

	if _, ok := c.get("b"); ok {
		t.Fatal("b should have been evicted after a was touched")
	}
	if _, ok := c.get("a"); !ok {
		t.Fatal("a should still be present")
	}
}
