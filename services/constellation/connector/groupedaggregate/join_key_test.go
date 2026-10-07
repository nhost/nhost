package groupedaggregate_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
)

func TestTupleKey(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name        string
		values      []any
		jsonTargets []bool
		want        string
	}{
		{"cross-scalar id and JSON string", []any{1, "1"}, []bool{false, true}, `["1","json:\"1\""]`},
		{"same ID JSON number", []any{"1", float64(1)}, []bool{false, true}, `["1","json:1"]`},
		{
			"canonical JSON object",
			[]any{2, map[string]any{"b": 2, "a": 1}},
			[]bool{false, true},
			`["2","json:{\"a\":1,\"b\":2}"]`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := groupedaggregate.TupleKey(tc.values, tc.jsonTargets); got != tc.want {
				t.Fatalf("TupleKey=%q, want %q", got, tc.want)
			}
		})
	}
}

func TestJoinKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		value      any
		jsonTarget bool
		want       string
	}{
		{name: "JSON string", value: "1", jsonTarget: true, want: `json:"1"`},
		{name: "JSON number", value: float64(1), jsonTarget: true, want: "json:1"},
		{
			name: "JSON object", value: map[string]any{"b": 2, "a": 1}, jsonTarget: true,
			want: `json:{"a":1,"b":2}`,
		},
		{
			name: "JSON array", value: []any{"first", 1}, jsonTarget: true,
			want: `json:["first",1]`,
		},
		{name: "non-JSON ID string", value: "1", want: "1"},
		{name: "non-JSON ID integer", value: 1, want: "1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := groupedaggregate.JoinKey(tt.value, tt.jsonTarget); got != tt.want {
				t.Errorf("JoinKey(%v, %t) = %q, want %q", tt.value, tt.jsonTarget, got, tt.want)
			}
		})
	}
}
