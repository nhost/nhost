package permissions_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestJSONBSessionParameter(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		session, want any
	}{
		{"serialized object", `{}`, json.RawMessage(`{}`)},
		{"serialized string", `"hello"`, json.RawMessage(`"hello"`)},
		{"serialized null", `null`, json.RawMessage(`null`)},
		{
			"structured object",
			map[string]any{"nested": []any{true, nil}},
			map[string]any{"nested": []any{true, nil}},
		},
		{"structured array", []any{"hello", float64(42)}, []any{"hello", float64(42)}},
		{"structured number", float64(42), float64(42)},
		{"structured boolean", true, true},
		{"SQL null", nil, nil},
		{
			"subscription marker",
			core.SessionVarValue{Name: "x-hasura-json"},
			core.SessionVarValue{Name: "x-hasura-json"},
		},
	}

	encoded, err := values.CoerceSQLValue("jsonb", "x-hasura-json")
	if err != nil {
		t.Fatal(err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			for _, list := range []bool{false, true} {
				input, want := encoded, tt.want
				if list {
					input = []any{encoded, json.RawMessage(`"literal"`)}
					want = []any{want, json.RawMessage(`"literal"`)}
				}

				got, err := permissions.SubstituteSessionVariable(
					input,
					map[string]any{"x-hasura-json": tt.session},
				)
				if err != nil {
					t.Fatal(err)
				}

				if diff := cmp.Diff(want, got); diff != "" {
					t.Fatalf("substitution (-want +got): %s", diff)
				}

				if diff := cmp.Diff(json.RawMessage(`"x-hasura-json"`), encoded); diff != "" {
					t.Fatalf("shared template mutated: %s", diff)
				}
			}
		})
	}

	t.Run("missing session", func(t *testing.T) {
		t.Parallel()

		if _, err := permissions.SubstituteSessionVariable(
			encoded,
			nil,
		); !errors.Is(
			err,
			permissions.ErrSessionVariableNotFound,
		) {
			t.Fatalf("missing session error: %v", err)
		}
	})
	t.Run("invalid serialized JSON", func(t *testing.T) {
		t.Parallel()

		if _, err := permissions.SubstituteSessionVariable(
			encoded,
			map[string]any{"x-hasura-json": "invalid"},
		); err == nil {
			t.Fatal("invalid JSON must fail")
		}
	})
	t.Run("literal JSON string", func(t *testing.T) {
		t.Parallel()

		literal := json.RawMessage(`"hello"`)

		got, err := permissions.SubstituteSessionVariable(literal, nil)
		if err != nil {
			t.Fatal(err)
		}

		if diff := cmp.Diff(literal, got); diff != "" {
			t.Fatal(diff)
		}
	})
}
