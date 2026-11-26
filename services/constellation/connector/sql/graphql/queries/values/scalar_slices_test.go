package values_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestGoValueToASTScalarSlices(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input any
		want  []any
	}{
		{name: "int", input: []int{3, -1, 2}, want: []any{int64(3), int64(-1), int64(2)}},
		{name: "int32", input: []int32{3, -1, 2}, want: []any{int64(3), int64(-1), int64(2)}},
		{name: "int64", input: []int64{3, -1, 2}, want: []any{int64(3), int64(-1), int64(2)}},
		{name: "float32", input: []float32{1.5, -2.5}, want: []any{1.5, -2.5}},
		{name: "float64", input: []float64{1.5, -2.5}, want: []any{1.5, -2.5}},
		{name: "bool", input: []bool{true, false, true}, want: []any{true, false, true}},
		{name: "empty", input: []float64{}, want: []any{}},
		{name: "nil slice", input: []bool(nil), want: []any{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := values.GoValueToAST(tt.input)
			if err != nil {
				t.Fatalf("GoValueToAST: %v", err)
			}

			if got.Kind != ast.ListValue {
				t.Fatalf("Kind = %v, want ListValue", got.Kind)
			}

			actual, err := values.ExtractGoValue(got)
			if err != nil {
				t.Fatalf("ExtractGoValue: %v", err)
			}

			if diff := cmp.Diff(tt.want, actual); diff != "" {
				t.Errorf("scalar slice (-want +got):\n%s", diff)
			}

			checkResolvedVariables(t, resolveVariablesCase{
				name:      tt.name,
				input:     `{filter:{_in:$xs}}`,
				variables: map[string]any{"xs": tt.input},
				want:      map[string]any{"filter": map[string]any{"_in": tt.want}},
			})
		})
	}
}

func TestGoValueToASTUnsupportedSlice(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input any
		want  string
	}{
		{
			name:  "unsupported scalar",
			input: []uint{1},
			want:  "unsupported value type: []uint",
		},
		{
			name:  "unsupported nested slice",
			input: map[string]any{"filter": []any{[]uint{1}}},
			want:  "failed to convert field filter: failed to convert array item 0: unsupported value type: []uint",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := values.GoValueToAST(tt.input)
			if err == nil || err.Error() != tt.want {
				t.Fatalf("GoValueToAST error = %v, want %q", err, tt.want)
			}
		})
	}
}
