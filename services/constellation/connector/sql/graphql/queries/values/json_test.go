package values_test

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestCoerceSQLValueJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value any
		want  any
	}{
		{"object-looking string", "{}", json.RawMessage(`"{}"`)},
		{"ordinary string", "hello", json.RawMessage(`"hello"`)},
		{"null-looking string", "null", json.RawMessage(`"null"`)},
		{"empty string", "", json.RawMessage(`""`)},
		{
			"escaped string",
			"quote\" and slash\\ and newline\n",
			json.RawMessage(`"quote\" and slash\\ and newline\n"`),
		},
		{"already encoded string", json.RawMessage(`"hello"`), json.RawMessage(`"hello"`)},
		{
			"already encoded object",
			json.RawMessage(`{ "key": "value" }`),
			json.RawMessage(`{ "key": "value" }`),
		},
		{"internal bytes", []byte(`{"key":1}`), []byte(`{"key":1}`)},
		{"JSON null", json.RawMessage(`null`), json.RawMessage(`null`)},
		{"SQL null", nil, nil},
		{"number", float64(42), float64(42)},
		{"boolean", true, true},
		{"array", []any{"hello", nil}, []any{"hello", nil}},
		{"object", map[string]any{"key": "hello"}, map[string]any{"key": "hello"}},
	}
	for _, sqlType := range []string{"json", "jsonb"} {
		t.Run(sqlType, func(t *testing.T) {
			t.Parallel()

			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					t.Parallel()

					got, err := values.CoerceSQLValue(sqlType, tt.value)
					if err != nil {
						t.Fatalf("CoerceSQLValue: %v", err)
					}

					want := tt.value // SQLite JSON retains its existing stored-text contract.
					if sqlType == "jsonb" {
						want = tt.want
					}

					if diff := cmp.Diff(want, got); diff != "" {
						t.Fatalf("typed parameter (-want +got):\n%s", diff)
					}

					again, err := values.CoerceSQLValue(sqlType, got)
					if err != nil {
						t.Fatalf("repeated CoerceSQLValue: %v", err)
					}

					if diff := cmp.Diff(got, again); diff != "" {
						t.Fatalf("coercion must be idempotent (-first +second):\n%s", diff)
					}
				})
			}
		})
	}
}

func TestCoerceSQLValuesJSON(t *testing.T) {
	t.Parallel()

	input := []any{"{}", "hello", map[string]any{}, nil, json.RawMessage(`"encoded"`)}

	want := []any{
		json.RawMessage(`"{}"`),
		json.RawMessage(`"hello"`),
		map[string]any{},
		nil,
		json.RawMessage(`"encoded"`),
	}
	for _, sqlType := range []string{"json", "jsonb"} {
		t.Run(sqlType, func(t *testing.T) {
			t.Parallel()

			got, err := values.CoerceSQLValues(sqlType, input)
			if err != nil {
				t.Fatalf("CoerceSQLValues: %v", err)
			}

			expected := input
			if sqlType == "jsonb" {
				expected = want
			}

			if diff := cmp.Diff(expected, got); diff != "" {
				t.Errorf("typed parameters (-want +got):\n%s", diff)
			}

			if input[0] != "{}" || input[1] != "hello" {
				t.Error("CoerceSQLValues mutated the input")
			}
		})
	}
}
