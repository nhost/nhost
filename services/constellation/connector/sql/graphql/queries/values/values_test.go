package values_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestExtractGoValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    *ast.Value
		expected any
		wantErr  bool
	}{
		{
			name:     "null value",
			input:    &ast.Value{Kind: ast.NullValue},
			expected: nil,
		},
		{
			name:     "integer value",
			input:    &ast.Value{Kind: ast.IntValue, Raw: "42"},
			expected: int64(42),
		},
		{
			name:     "negative integer",
			input:    &ast.Value{Kind: ast.IntValue, Raw: "-7"},
			expected: int64(-7),
		},
		{
			name:     "float value",
			input:    &ast.Value{Kind: ast.FloatValue, Raw: "3.14"},
			expected: 3.14,
		},
		{
			name:     "string value",
			input:    &ast.Value{Kind: ast.StringValue, Raw: "hello"},
			expected: "hello",
		},
		{
			name:     "enum value",
			input:    &ast.Value{Kind: ast.EnumValue, Raw: "ASC"},
			expected: "ASC",
		},
		{
			name:     "boolean true",
			input:    &ast.Value{Kind: ast.BooleanValue, Raw: "true"},
			expected: true,
		},
		{
			name:     "boolean false",
			input:    &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
			expected: false,
		},
		{
			name: "list value",
			input: &ast.Value{
				Kind: ast.ListValue,
				Children: []*ast.ChildValue{
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "2"}},
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "3"}},
				},
			},
			expected: []any{int64(1), int64(2), int64(3)},
		},
		{
			name: "object value",
			input: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "name", Value: &ast.Value{Kind: ast.StringValue, Raw: "Alice"}},
					{Name: "age", Value: &ast.Value{Kind: ast.IntValue, Raw: "30"}},
				},
			},
			expected: map[string]any{"name": "Alice", "age": int64(30)},
		},
		{
			name:    "variable value returns error",
			input:   &ast.Value{Kind: ast.Variable, Raw: "myVar"},
			wantErr: true,
		},
		{
			name:    "invalid integer",
			input:   &ast.Value{Kind: ast.IntValue, Raw: "not-a-number"},
			wantErr: true,
		},
		{
			name:    "invalid float",
			input:   &ast.Value{Kind: ast.FloatValue, Raw: "not-a-float"},
			wantErr: true,
		},
		{
			name:     "empty list",
			input:    &ast.Value{Kind: ast.ListValue, Children: nil},
			expected: []any{},
		},
		{
			name:     "empty object",
			input:    &ast.Value{Kind: ast.ObjectValue, Children: nil},
			expected: map[string]any{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ExtractGoValue(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("extractGoValue mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func validateMapNameTest(t *testing.T, got *ast.Value) {
	t.Helper()

	if len(got.Children) != 2 {
		t.Fatalf("Children count = %d, want 2", len(got.Children))
	}

	childMap := make(map[string]*ast.Value, len(got.Children))
	for _, child := range got.Children {
		childMap[child.Name] = child.Value
	}

	nameChild, ok := childMap["name"]
	if !ok {
		t.Fatal("missing child 'name'")
	}

	if nameChild.Kind != ast.EnumValue || nameChild.Raw != "test" {
		t.Errorf(
			"name child: Kind=%v Raw=%q, want EnumValue/test",
			nameChild.Kind,
			nameChild.Raw,
		)
	}
}

func validateAbcChildren(t *testing.T, got *ast.Value) {
	t.Helper()

	if len(got.Children) != 3 {
		t.Fatalf("Children count = %d, want 3", len(got.Children))
	}

	for i, expected := range []string{"a", "b", "c"} {
		if got.Children[i].Value.Raw != expected {
			t.Errorf("Children[%d].Raw = %q, want %q", i, got.Children[i].Value.Raw, expected)
		}
	}
}

func validateChildCount(want int) func(t *testing.T, got *ast.Value) {
	return func(t *testing.T, got *ast.Value) {
		t.Helper()

		if len(got.Children) != want {
			t.Errorf("Children count = %d, want %d", len(got.Children), want)
		}
	}
}

func TestGoValueToAST(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		input        any
		expectedKind ast.ValueKind
		expectedRaw  string
		validate     func(t *testing.T, got *ast.Value)
		wantErr      bool
	}{
		{
			name:         "nil",
			input:        nil,
			expectedKind: ast.NullValue,
		},
		{
			name:         "string",
			input:        "hello",
			expectedKind: ast.EnumValue,
			expectedRaw:  "hello",
		},
		{
			name:         "int",
			input:        42,
			expectedKind: ast.IntValue,
			expectedRaw:  "42",
		},
		{
			name:         "int32",
			input:        int32(100),
			expectedKind: ast.IntValue,
			expectedRaw:  "100",
		},
		{
			name:         "int64",
			input:        int64(99),
			expectedKind: ast.IntValue,
			expectedRaw:  "99",
		},
		{
			name:         "float32",
			input:        float32(2.5),
			expectedKind: ast.FloatValue,
			expectedRaw:  "2.5",
		},
		{
			name:         "float64",
			input:        3.14,
			expectedKind: ast.FloatValue,
			expectedRaw:  "3.14",
		},
		{
			name:         "bool true",
			input:        true,
			expectedKind: ast.BooleanValue,
			expectedRaw:  "true",
		},
		{
			name:         "bool false",
			input:        false,
			expectedKind: ast.BooleanValue,
			expectedRaw:  "false",
		},
		{
			name:    "unsupported type",
			input:   struct{ X int }{X: 1},
			wantErr: true,
		},
		{
			name:         "map[string]any with string and int",
			input:        map[string]any{"name": "test", "val": 42},
			expectedKind: ast.ObjectValue,
			validate:     validateMapNameTest,
		},
		{
			name:         "[]any of strings",
			input:        []any{"a", "b", "c"},
			expectedKind: ast.ListValue,
			validate:     validateAbcChildren,
		},
		{
			name: "[]map[string]any",
			input: []map[string]any{
				{"id": 1, "name": "a"},
				{"id": 2, "name": "b"},
			},
			expectedKind: ast.ListValue,
			validate:     validateChildCount(2),
		},
		{
			name:         "[]string",
			input:        []string{"a", "b", "c"},
			expectedKind: ast.ListValue,
			validate:     validateAbcChildren,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.GoValueToAST(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.Kind != tc.expectedKind {
				t.Errorf("Kind = %v, want %v", got.Kind, tc.expectedKind)
			}

			if tc.expectedRaw != "" && got.Raw != tc.expectedRaw {
				t.Errorf("Raw = %q, want %q", got.Raw, tc.expectedRaw)
			}

			if tc.validate != nil {
				tc.validate(t, got)
			}
		})
	}
}

func TestGoValueToAST_RoundTrip(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input any
	}{
		{"string", "hello"},
		{"int", int64(42)},
		{"float", 3.14},
		{"bool true", true},
		{"bool false", false},
		{"nil", nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			astVal, err := values.GoValueToAST(tc.input)
			if err != nil {
				t.Fatalf("goValueToAST error: %v", err)
			}

			got, err := values.ExtractGoValue(astVal)
			if err != nil {
				t.Fatalf("extractGoValue error: %v", err)
			}

			expected := tc.input
			if v, ok := expected.(int); ok {
				expected = int64(v)
			}

			if diff := cmp.Diff(expected, got); diff != "" {
				t.Errorf("round-trip mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestExtractArrayValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    *ast.Value
		expected []any
		wantErr  bool
	}{
		{
			name: "list of ints",
			input: &ast.Value{
				Kind: ast.ListValue,
				Children: []*ast.ChildValue{
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "2"}},
				},
			},
			expected: []any{int64(1), int64(2)},
		},
		{
			name:     "scalar coerced to single-element list",
			input:    &ast.Value{Kind: ast.StringValue, Raw: "hello"},
			expected: []any{"hello"},
		},
		{
			name: "empty list",
			input: &ast.Value{
				Kind:     ast.ListValue,
				Children: nil,
			},
			expected: []any{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ExtractArrayValues(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("extractArrayValues mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAnyToString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    any
		expected string
	}{
		{"string", "hello", "hello"},
		{"int64", int64(42), "42"},
		{"float64", float64(3.14), "3.14"},
		{"bool true", true, "true"},
		{"bool false", false, "false"},
		{"nil", nil, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := values.AnyToString(tc.input)
			if got != tc.expected {
				t.Errorf("anyToString(%v) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestExtractStringArrayValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    *ast.Value
		expected []string
	}{
		{
			name: "list of strings",
			input: &ast.Value{
				Kind: ast.ListValue,
				Children: []*ast.ChildValue{
					{Value: &ast.Value{Kind: ast.StringValue, Raw: "a"}},
					{Value: &ast.Value{Kind: ast.StringValue, Raw: "b"}},
				},
			},
			expected: []string{"a", "b"},
		},
		{
			name:     "scalar coerced to single-element list",
			input:    &ast.Value{Kind: ast.StringValue, Raw: "solo"},
			expected: []string{"solo"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ExtractStringArrayValues(tc.input)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("extractStringArrayValues mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestResolveASTValueNestedVariables(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		value     *ast.Value
		variables map[string]any
		want      any
	}{
		{
			name: "object with nested variable (function args repro)",
			value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: ast.ChildValueList{
					{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "inviteId"}},
				},
			},
			variables: map[string]any{
				"inviteId": "3245d508-5c4e-48ce-93d1-fa66dc1154eb",
			},
			want: map[string]any{
				"id": "3245d508-5c4e-48ce-93d1-fa66dc1154eb",
			},
		},
		{
			name: "object with mixed literal and variable children",
			value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: ast.ChildValueList{
					{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "inviteId"}},
					{Name: "literal", Value: &ast.Value{Kind: ast.StringValue, Raw: "static"}},
				},
			},
			variables: map[string]any{
				"inviteId": "uuid-here",
			},
			want: map[string]any{
				"id":      "uuid-here",
				"literal": "static",
			},
		},
		{
			name: "list with nested variables",
			value: &ast.Value{
				Kind: ast.ListValue,
				Children: ast.ChildValueList{
					{Value: &ast.Value{Kind: ast.Variable, Raw: "a"}},
					{Value: &ast.Value{Kind: ast.Variable, Raw: "b"}},
				},
			},
			variables: map[string]any{"a": "one", "b": "two"},
			want:      []any{"one", "two"},
		},
		{
			name: "deeply nested object with variable",
			value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: ast.ChildValueList{
					{
						Name: "outer",
						Value: &ast.Value{
							Kind: ast.ObjectValue,
							Children: ast.ChildValueList{
								{Name: "inner", Value: &ast.Value{Kind: ast.Variable, Raw: "v"}},
							},
						},
					},
				},
			},
			variables: map[string]any{"v": int64(42)},
			want:      map[string]any{"outer": map[string]any{"inner": int64(42)}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ResolveASTValue(tc.value, tc.variables)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("resolveASTValue mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCoerceToChildValueList(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		input        *ast.Value
		expectedKind ast.ValueKind
		wantLen      int
		wantErr      bool
	}{
		{
			name: "list value returns children",
			input: &ast.Value{
				Kind: ast.ListValue,
				Children: []*ast.ChildValue{
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
					{Value: &ast.Value{Kind: ast.IntValue, Raw: "2"}},
				},
			},
			expectedKind: ast.IntValue,
			wantLen:      2,
		},
		{
			name:         "scalar matching kind wrapped in single-element list",
			input:        &ast.Value{Kind: ast.StringValue, Raw: "hello"},
			expectedKind: ast.StringValue,
			wantLen:      1,
		},
		{
			name:         "object matching kind wrapped in single-element list",
			input:        &ast.Value{Kind: ast.ObjectValue, Children: nil},
			expectedKind: ast.ObjectValue,
			wantLen:      1,
		},
		{
			name:         "mismatched kind errors",
			input:        &ast.Value{Kind: ast.IntValue, Raw: "5"},
			expectedKind: ast.StringValue,
			wantErr:      true,
		},
		{
			name: "empty list returns empty slice",
			input: &ast.Value{
				Kind:     ast.ListValue,
				Children: nil,
			},
			expectedKind: ast.IntValue,
			wantLen:      0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.CoerceToChildValueList(tc.input, tc.expectedKind)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(got) != tc.wantLen {
				t.Errorf("len = %d, want %d", len(got), tc.wantLen)
			}
		})
	}
}

func TestExtractJSONBValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    *ast.Value
		expected any
		wantErr  bool
	}{
		{
			name:     "null",
			input:    &ast.Value{Kind: ast.NullValue},
			expected: nil,
		},
		{
			name:     "string",
			input:    &ast.Value{Kind: ast.StringValue, Raw: "hello"},
			expected: "hello",
		},
		{
			name:     "enum",
			input:    &ast.Value{Kind: ast.EnumValue, Raw: "ASC"},
			expected: "ASC",
		},
		{
			name:     "int",
			input:    &ast.Value{Kind: ast.IntValue, Raw: "42"},
			expected: int64(42),
		},
		{
			name:     "float",
			input:    &ast.Value{Kind: ast.FloatValue, Raw: "3.14"},
			expected: 3.14,
		},
		{
			name:     "bool true",
			input:    &ast.Value{Kind: ast.BooleanValue, Raw: "true"},
			expected: true,
		},
		{
			name:     "bool false",
			input:    &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
			expected: false,
		},
		{
			name: "object with mixed value types",
			input: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "name", Value: &ast.Value{Kind: ast.StringValue, Raw: "Alice"}},
					{Name: "age", Value: &ast.Value{Kind: ast.IntValue, Raw: "30"}},
				},
			},
			expected: map[string]any{"name": "Alice", "age": int64(30)},
		},
		{
			name: "list of objects",
			input: &ast.Value{
				Kind: ast.ListValue,
				Children: []*ast.ChildValue{
					{Value: &ast.Value{
						Kind: ast.ObjectValue,
						Children: []*ast.ChildValue{
							{Name: "v", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
						},
					}},
				},
			},
			expected: []any{map[string]any{"v": int64(1)}},
		},
		{
			name:    "invalid int",
			input:   &ast.Value{Kind: ast.IntValue, Raw: "not-a-number"},
			wantErr: true,
		},
		{
			name:    "invalid float",
			input:   &ast.Value{Kind: ast.FloatValue, Raw: "not-a-float"},
			wantErr: true,
		},
		{
			name:    "unsupported kind (variable)",
			input:   &ast.Value{Kind: ast.Variable, Raw: "x"},
			wantErr: true,
		},
		{
			name: "object propagates child error with field context",
			input: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "broken", Value: &ast.Value{Kind: ast.IntValue, Raw: "nope"}},
				},
			},
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ExtractJSONBValue(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("ExtractJSONBValue mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestGoValueToAST_DeterministicMapKeyOrder(t *testing.T) {
	t.Parallel()

	input := map[string]any{
		"zebra":  1,
		"apple":  2,
		"mango":  3,
		"banana": 4,
	}

	// Repeated calls must produce identical key order to keep prepared-statement
	// caching effective and golden tests stable.
	const repetitions = 5

	var first []string

	for range repetitions {
		got, err := values.GoValueToAST(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		order := make([]string, len(got.Children))
		for i, c := range got.Children {
			order[i] = c.Name
		}

		if first == nil {
			first = order

			continue
		}

		if diff := cmp.Diff(first, order); diff != "" {
			t.Errorf("non-deterministic key order (-first +current):\n%s", diff)
		}
	}

	// Verify sorted order explicitly.
	expected := []string{"apple", "banana", "mango", "zebra"}
	if diff := cmp.Diff(expected, first); diff != "" {
		t.Errorf("key order not sorted (-want +got):\n%s", diff)
	}
}

func TestResolveVariable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		value     *ast.Value
		variables map[string]any
		wantErr   bool
		wantRaw   string
	}{
		{
			name:    "non-variable returns unchanged",
			value:   &ast.Value{Kind: ast.StringValue, Raw: "hello"},
			wantRaw: "hello",
		},
		{
			name:      "variable resolved from map",
			value:     &ast.Value{Kind: ast.Variable, Raw: "myVar"},
			variables: map[string]any{"myVar": "resolved"},
			wantRaw:   "resolved",
		},
		{
			name:      "missing variable returns error",
			value:     &ast.Value{Kind: ast.Variable, Raw: "missing"},
			variables: map[string]any{},
			wantErr:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.ResolveVariable(tc.value, tc.variables)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.Raw != tc.wantRaw {
				t.Errorf("Raw = %q, want %q", got.Raw, tc.wantRaw)
			}
		})
	}
}

func TestCoerceSQLValueSpatial(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		sqlType string
		value   any
		want    any
	}{
		{
			name:    "geojson object",
			sqlType: "geometry",
			value: map[string]any{
				"type":        "Point",
				"coordinates": []any{float64(1), float64(2)},
			},
			want: `{"coordinates":[1,2],"type":"Point"}`,
		},
		{
			name:    "geojson string passes through",
			sqlType: "geography",
			value:   `{"type":"Point","coordinates":[1,2]}`,
			want:    `{"type":"Point","coordinates":[1,2]}`,
		},
		{
			name:    "geojson bytes coerced to string",
			sqlType: "geometry",
			value:   []byte(`{"type":"Point","coordinates":[1,2]}`),
			want:    `{"type":"Point","coordinates":[1,2]}`,
		},
		{
			name:    "null passes through",
			sqlType: "geometry",
			value:   nil,
			want:    nil,
		},
		{
			name:    "non spatial identity",
			sqlType: "jsonb",
			value: map[string]any{
				"type": "Point",
			},
			want: map[string]any{
				"type": "Point",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.CoerceSQLValue(tt.sqlType, tt.value)
			if err != nil {
				t.Fatalf("CoerceSQLValue error = %v", err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Fatalf("CoerceSQLValue mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCoerceSQLValuesSpatial(t *testing.T) {
	t.Parallel()

	got, err := values.CoerceSQLValues("geometry", []any{
		map[string]any{"type": "Point", "coordinates": []any{float64(1), float64(2)}},
		map[string]any{"type": "Point", "coordinates": []any{float64(3), float64(4)}},
	})
	if err != nil {
		t.Fatalf("CoerceSQLValues error = %v", err)
	}

	want := []any{
		`{"coordinates":[1,2],"type":"Point"}`,
		`{"coordinates":[3,4],"type":"Point"}`,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("CoerceSQLValues mismatch (-want +got):\n%s", diff)
	}
}
