package values_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

type resolveVariablesCase struct {
	name        string
	input       string
	variables   map[string]any
	want        any
	wantMissing bool
	wantErr     bool
}

func TestResolveVariables(t *testing.T) {
	t.Parallel()

	tests := []resolveVariablesCase{
		{
			name:  "literal",
			input: `{z:desc,a:["first",null,2,true]}`,
			want:  map[string]any{"z": "desc", "a": []any{"first", nil, int64(2), true}},
		},
		{
			name:  "whole object",
			input: `$object`,
			variables: map[string]any{
				"object": map[string]any{"name": "Alice", "ids": []any{"u1", "u2"}},
			},
			want: map[string]any{"name": "Alice", "ids": []any{"u1", "u2"}},
		},
		{
			name:  "nested object and list",
			input: `{z:$direction,a:["first",{ids:[$id,"u2"],data:$data}]}`,
			variables: map[string]any{
				"direction": "desc",
				"id":        "u1",
				"data":      map[string]any{"age": 42},
			},
			want: map[string]any{
				"z": "desc",
				"a": []any{
					"first",
					map[string]any{
						"ids":  []any{"u1", "u2"},
						"data": map[string]any{"age": int64(42)},
					},
				},
			},
		},
		{
			name:      "explicit null",
			input:     `{data:[$value]}`,
			variables: map[string]any{"value": nil},
			want:      map[string]any{"data": []any{nil}},
		},
		{name: "missing variable", input: `$missing`, wantMissing: true, wantErr: true},
		{
			name:        "missing nested variable",
			input:       `{nested:[{id:$missing}]}`,
			wantMissing: true,
			wantErr:     true,
		},
		{
			name:      "unsupported variable value",
			input:     `{nested:[$value]}`,
			variables: map[string]any{"value": make(chan int)},
			wantErr:   true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			checkResolvedVariables(t, tt)
		})
	}
}

func checkResolvedVariables(t *testing.T, tt resolveVariablesCase) {
	t.Helper()

	document, err := parser.ParseQuery(
		&ast.Source{Input: `{field(input:` + tt.input + `)}`},
	)
	if err != nil {
		t.Fatalf("ParseQuery: %v", err)
	}

	field, ok := document.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected a field selection")
	}

	input := field.Arguments[0].Value
	before := input.String()

	got, err := values.ResolveVariables(input, tt.variables)
	if input.String() != before {
		t.Fatal("ResolveVariables mutated the original input")
	}

	if (err != nil) != tt.wantErr {
		t.Fatalf("ResolveVariables error = %v, wantErr %v", err, tt.wantErr)
	}

	if errors.Is(err, values.ErrVariableNotFound) != tt.wantMissing {
		t.Fatalf("missing-variable identity: %v", err)
	}

	if tt.wantErr {
		return
	}

	actual, err := values.ExtractGoValue(got)
	if err != nil {
		t.Fatalf("ExtractGoValue: %v", err)
	}

	if diff := cmp.Diff(tt.want, actual); diff != "" {
		t.Errorf("resolved value (-want +got):\n%s", diff)
	}

	if input.Kind != ast.Variable && len(input.Children) > 0 {
		if got.Children[0].Name != input.Children[0].Name {
			t.Error("literal field order changed")
		}

		if input.Children[0].Value.Kind != ast.Variable &&
			got.Children[0].Value.Kind != input.Children[0].Value.Kind {
			t.Error("literal kind changed")
		}
	}
}
