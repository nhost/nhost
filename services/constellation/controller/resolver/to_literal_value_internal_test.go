package resolver

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
)

// Cyclomatic/cognitive complexity is high because each table case carries
// its own assertion closure; flattening them into a single check helper
// would obscure intent.
func TestToLiteralValue(t *testing.T) { //nolint:gocognit,cyclop
	t.Parallel()

	tests := []struct {
		name     string
		input    any
		wantKind ast.ValueKind
		wantRaw  string // empty means do not assert
		check    func(t *testing.T, v *ast.Value)
	}{
		{
			name:     "nil",
			input:    nil,
			wantKind: ast.NullValue,
			wantRaw:  "null",
			check:    nil,
		},
		{
			name:     "bool true",
			input:    true,
			wantKind: ast.BooleanValue,
			wantRaw:  "true",
			check:    nil,
		},
		{
			name:     "bool false",
			input:    false,
			wantKind: ast.BooleanValue,
			wantRaw:  "false",
			check:    nil,
		},
		{
			name:     "integer float64",
			input:    float64(42),
			wantKind: ast.IntValue,
			wantRaw:  "42",
			check:    nil,
		},
		{
			name:     "fractional float64",
			input:    3.14,
			wantKind: ast.FloatValue,
			wantRaw:  "",
			check:    nil,
		},
		{
			name:     "string fallback",
			input:    "hello",
			wantKind: ast.StringValue,
			wantRaw:  "hello",
			check:    nil,
		},
		{
			name:     "slice of any",
			input:    []any{float64(1), float64(2), float64(3)},
			wantKind: ast.ListValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 3 {
					t.Fatalf("expected 3 children, got %d", len(v.Children))
				}

				for i, child := range v.Children {
					if child.Value.Kind != ast.IntValue {
						t.Errorf("child %d: expected IntValue, got %v", i, child.Value.Kind)
					}
				}
			},
		},
		{
			name:     "nested slice",
			input:    []any{[]any{float64(1)}, []any{float64(2)}},
			wantKind: ast.ListValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 2 {
					t.Fatalf("expected 2 children, got %d", len(v.Children))
				}

				for i, child := range v.Children {
					if child.Value.Kind != ast.ListValue {
						t.Errorf("child %d: expected ListValue, got %v", i, child.Value.Kind)
					}
				}
			},
		},
		{
			name:     "map of string to any",
			input:    map[string]any{"x": float64(1), "y": "hello"},
			wantKind: ast.ObjectValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 2 {
					t.Fatalf("expected 2 children, got %d", len(v.Children))
				}

				childMap := make(map[string]ast.ValueKind, len(v.Children))
				for _, child := range v.Children {
					childMap[child.Name] = child.Value.Kind
				}

				want := map[string]ast.ValueKind{
					"x": ast.IntValue,
					"y": ast.StringValue,
				}
				if diff := cmp.Diff(want, childMap); diff != "" {
					t.Errorf("child kinds mismatch (-want +got):\n%s", diff)
				}
			},
		},
		{
			name: "nested object in list",
			input: []any{
				map[string]any{"a": float64(1)},
				map[string]any{"b": true},
			},
			wantKind: ast.ListValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 2 {
					t.Fatalf("expected 2 children, got %d", len(v.Children))
				}

				for i, child := range v.Children {
					if child.Value.Kind != ast.ObjectValue {
						t.Errorf("child %d: expected ObjectValue, got %v", i, child.Value.Kind)
					}
				}
			},
		},
		{
			name:     "empty list",
			input:    []any{},
			wantKind: ast.ListValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 0 {
					t.Errorf("expected 0 children, got %d", len(v.Children))
				}
			},
		},
		{
			name:     "empty object",
			input:    map[string]any{},
			wantKind: ast.ObjectValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()

				if len(v.Children) != 0 {
					t.Errorf("expected 0 children, got %d", len(v.Children))
				}
			},
		},
		{
			name:     "round trip string representation",
			input:    []any{float64(1), float64(2), float64(3)},
			wantKind: ast.ListValue,
			wantRaw:  "",
			check: func(t *testing.T, v *ast.Value) {
				t.Helper()
				// Verify that list produces valid GraphQL string, not Go's [1 2 3].
				if diff := cmp.Diff("[1,2,3]", v.String()); diff != "" {
					t.Errorf("list string mismatch (-want +got):\n%s", diff)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := toLiteralValue(tt.input)
			if got.Kind != tt.wantKind {
				t.Errorf("kind mismatch: want %v, got %v", tt.wantKind, got.Kind)
			}

			if tt.wantRaw != "" && got.Raw != tt.wantRaw {
				t.Errorf("raw mismatch: want %q, got %q", tt.wantRaw, got.Raw)
			}

			if tt.check != nil {
				tt.check(t, got)
			}
		})
	}
}
