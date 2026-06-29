package eval_test

import (
	json "encoding/json/v2"
	"errors"
	"testing"

	"github.com/nhost/nhost/internal/lib/jsontmpl/ast"
	"github.com/nhost/nhost/internal/lib/jsontmpl/eval"
	"github.com/nhost/nhost/internal/lib/jsontmpl/token"
)

// marshal renders a Value to its canonical JSON encoding for comparison.
func marshal(t *testing.T, v eval.Value) string {
	t.Helper()

	b, err := json.Marshal(v, json.Deterministic(true))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	return string(b)
}

func num(text string) ast.Node   { return ast.Number{Span: token.Span{}, Text: text} }
func str(value string) ast.Node  { return ast.String{Span: token.Span{}, Value: value} }
func boolean(b bool) ast.Node    { return ast.Boolean{Span: token.Span{}, Value: b} }
func variable(n string) ast.Node { return ast.Var{Span: token.Span{}, Name: n} }

func TestEval_Literals(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		node ast.Node
		want string
	}{
		{"string", str("hi"), `"hi"`},
		{"number", num("42"), `42`},
		{"bool", boolean(true), `true`},
		{"null", ast.Null{}, `null`},
		{"array", ast.Array{Elems: []ast.Node{num("1"), str("a")}}, `[1,"a"]`},
		{
			"object",
			ast.Object{Fields: []ast.ObjectField{
				{Key: "b", Value: num("2")},
				{Key: "a", Value: num("1")},
			}},
			`{"b":2,"a":1}`, // insertion order preserved, not sorted
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := eval.Eval(tc.node, nil, nil)
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}

			if s := marshal(t, got); s != tc.want {
				t.Fatalf("got %s, want %s", s, tc.want)
			}
		})
	}
}

func TestEval_VarLookupLastWins(t *testing.T) {
	t.Parallel()

	// Later bindings shadow earlier ones.
	bindings := []eval.Binding{
		{Name: "x", Value: "first"},
		{Name: "x", Value: "second"},
	}

	got, err := eval.Eval(variable("x"), bindings, nil)
	if err != nil {
		t.Fatalf("Eval: %v", err)
	}

	if s := marshal(t, got); s != `"second"` {
		t.Fatalf("got %s, want \"second\"", s)
	}
}

func TestEval_Operators(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		node ast.Node
		want string
	}{
		{"eq true", ast.Eq{Left: num("1"), Right: num("1")}, `true`},
		{"eq false", ast.Eq{Left: num("1"), Right: num("2")}, `false`},
		{"and", ast.And{Left: boolean(true), Right: boolean(false)}, `false`},
		{"or", ast.Or{Left: boolean(false), Right: boolean(true)}, `true`},
		{"lt", ast.Lt{Left: num("1"), Right: num("2")}, `true`},
		{"defaulting picks left", ast.Defaulting{Left: num("3"), Right: num("9")}, `3`},
		{"defaulting picks right on null", ast.Defaulting{Left: ast.Null{}, Right: num("9")}, `9`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := eval.Eval(tc.node, nil, nil)
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}

			if s := marshal(t, got); s != tc.want {
				t.Fatalf("got %s, want %s", s, tc.want)
			}
		})
	}
}

func TestEval_If(t *testing.T) {
	t.Parallel()

	node := ast.Iff{
		Cond: boolean(false),
		Then: str("then"),
		Else: str("else"),
	}

	got, err := eval.Eval(node, nil, nil)
	if err != nil {
		t.Fatalf("Eval: %v", err)
	}

	if s := marshal(t, got); s != `"else"` {
		t.Fatalf("got %s, want \"else\"", s)
	}
}

func TestEval_Function(t *testing.T) {
	t.Parallel()

	funcs := map[string]eval.Func{
		"double": func(arg eval.Value) (eval.Value, error) {
			n, ok := arg.(float64)
			if !ok {
				return nil, errors.New("double: not a number")
			}

			return n * 2, nil
		},
	}

	node := ast.Function{Name: "double", Arg: num("21")}

	got, err := eval.Eval(node, nil, funcs)
	if err != nil {
		t.Fatalf("Eval: %v", err)
	}

	if s := marshal(t, got); s != `42` {
		t.Fatalf("got %s, want 42", s)
	}
}

func TestEval_Errors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		node     ast.Node
		wantCode eval.ErrorCode
	}{
		{"unbound var", variable("missing"), eval.CodeName},
		{
			"type error: non-boolean operand to &&",
			ast.And{Left: num("1"), Right: boolean(true)},
			eval.CodeType,
		},
		{
			"attribute on non-object",
			ast.RequiredFieldAccess{
				Root:  num("1"),
				Field: ast.FieldKey{IsName: true, Name: "x"},
			},
			eval.CodeType,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := eval.Eval(tc.node, nil, nil)
			if err == nil {
				t.Fatalf("expected error, got nil")
			}

			var ee *eval.Error
			if !errors.As(err, &ee) {
				t.Fatalf("error is not *eval.Error: %T", err)
			}

			if ee.Code != tc.wantCode {
				t.Fatalf("got code %q, want %q", ee.Code, tc.wantCode)
			}
		})
	}
}

func TestFromJSON_RoundTrip(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"null", `null`, `null`},
		{"bool", `true`, `true`},
		{"number", `3.5`, `3.5`},
		{"string", `"hi"`, `"hi"`},
		{"array", `[1,2,3]`, `[1,2,3]`},
		{"object preserves key order", `{"z":1,"a":2}`, `{"z":1,"a":2}`},
		{"nested", `{"a":[{"b":1}]}`, `{"a":[{"b":1}]}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			v, err := eval.FromJSON([]byte(tc.in))
			if err != nil {
				t.Fatalf("FromJSON: %v", err)
			}

			if s := marshal(t, v); s != tc.want {
				t.Fatalf("got %s, want %s", s, tc.want)
			}
		})
	}
}

func TestFromJSON_Edge(t *testing.T) {
	t.Parallel()

	t.Run("empty input is null value", func(t *testing.T) {
		t.Parallel()

		v, err := eval.FromJSON([]byte("   "))
		if err != nil {
			t.Fatalf("FromJSON: %v", err)
		}

		if v != nil {
			t.Fatalf("got %v, want nil", v)
		}
	})

	t.Run("trailing tokens rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := eval.FromJSON([]byte(`1 2`)); err == nil {
			t.Fatal("expected error for trailing tokens")
		}
	})

	t.Run("malformed rejected", func(t *testing.T) {
		t.Parallel()

		if _, err := eval.FromJSON([]byte(`{`)); err == nil {
			t.Fatal("expected error for malformed JSON")
		}
	})
}

func TestEqual(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		a, b eval.Value
		want bool
	}{
		{"null == null", nil, nil, true},
		{"bool equal", true, true, true},
		{"bool unequal", true, false, false},
		{"number equal", 1.0, 1.0, true},
		{"string equal", "x", "x", true},
		{"cross type", 1.0, "1", false},
		{"array equal", []eval.Value{1.0, 2.0}, []eval.Value{1.0, 2.0}, true},
		{"array length differs", []eval.Value{1.0}, []eval.Value{1.0, 2.0}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := eval.Equal(tc.a, tc.b); got != tc.want {
				t.Fatalf("Equal(%v,%v)=%v, want %v", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func TestEqual_Object(t *testing.T) {
	t.Parallel()

	a := eval.NewObject()
	a.Set("x", 1.0)
	a.Set("y", 2.0)

	b := eval.NewObject()
	b.Set("y", 2.0) // different insertion order, same content
	b.Set("x", 1.0)

	if !eval.Equal(a, b) {
		t.Fatal("objects with same content should be equal regardless of key order")
	}

	b.Set("x", 9.0)

	if eval.Equal(a, b) {
		t.Fatal("objects with differing values should not be equal")
	}
}

func TestCompare(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		a, b eval.Value
		want int
	}{
		{"equal numbers", 1.0, 1.0, 0},
		{"less number", 1.0, 2.0, -1},
		{"greater number", 2.0, 1.0, 1},
		{"false < true", false, true, -1},
		{"string order", "a", "b", -1},
		// Cross-type uses constructor rank: Null < Bool < Number < String.
		{"null < bool", nil, true, -1},
		{"bool < number", true, 1.0, -1},
		{"number < string", 1.0, "1", -1},
		{"string > number", "1", 1.0, 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := eval.Compare(tc.a, tc.b); got != tc.want {
				t.Fatalf("Compare(%v,%v)=%d, want %d", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func TestObject_OrderAndOverwrite(t *testing.T) {
	t.Parallel()

	o := eval.NewObject()
	o.Set("b", 1.0)
	o.Set("a", 2.0)
	o.Set("b", 3.0) // overwrite keeps original position

	if v, ok := o.Get("b"); !ok || v != 3.0 {
		t.Fatalf(`Get("b")=%v,%v; want 3,true`, v, ok)
	}

	if _, ok := o.Get("missing"); ok {
		t.Fatal(`Get("missing") should report absent`)
	}

	got := marshal(t, o)
	if got != `{"b":3,"a":2}` {
		t.Fatalf("got %s, want {\"b\":3,\"a\":2}", got)
	}
}

func TestTypeName(t *testing.T) {
	t.Parallel()

	cases := []struct {
		v    eval.Value
		want string
	}{
		{nil, "Null"},
		{true, "Boolean"},
		{1.0, "Number"},
		{"s", "String"},
		{[]eval.Value{}, "Array"},
		{eval.NewObject(), "Object"},
	}

	for _, tc := range cases {
		t.Run(tc.want, func(t *testing.T) {
			t.Parallel()

			if got := eval.TypeName(tc.v); got != tc.want {
				t.Fatalf("TypeName=%q, want %q", got, tc.want)
			}
		})
	}
}

func TestAsInt(t *testing.T) {
	t.Parallel()

	if i, ok := eval.AsInt(3.0); !ok || i != 3 {
		t.Fatalf("AsInt(3.0)=%d,%v; want 3,true", i, ok)
	}

	if _, ok := eval.AsInt(3.5); ok {
		t.Fatal("AsInt(3.5) should report non-integer")
	}
}

func TestEncodeForStringTem(t *testing.T) {
	t.Parallel()

	// Strings are emitted raw (no surrounding quotes).
	if s, err := eval.EncodeForStringTem("hi"); err != nil || s != "hi" {
		t.Fatalf("EncodeForStringTem(string)=%q,%v; want \"hi\",nil", s, err)
	}

	// Non-strings use their compact JSON encoding.
	if s, err := eval.EncodeForStringTem(1.0); err != nil || s != "1" {
		t.Fatalf("EncodeForStringTem(number)=%q,%v; want \"1\",nil", s, err)
	}
}
