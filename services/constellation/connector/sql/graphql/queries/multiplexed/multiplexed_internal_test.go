package multiplexed

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestExtractSessionVarName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		param    any
		wantName string
		wantOK   bool
	}{
		{
			name:     "session variable marker",
			param:    core.SessionVarValue{Name: "x-hasura-user-id"},
			wantName: "x-hasura-user-id",
			wantOK:   true,
		},
		{
			name:     "single-element any array wrapping a marker",
			param:    []any{core.SessionVarValue{Name: "x-hasura-org-id"}},
			wantName: "x-hasura-org-id",
			wantOK:   true,
		},
		{
			// Regression for the misclassification bug: a user-supplied literal
			// that merely begins with "x-hasura-" is ordinary data, not a
			// session-variable reference, and must NOT be rewritten into a
			// result_vars lookup.
			name:   "plain x-hasura string is not a session variable",
			param:  "x-hasura-legacy",
			wantOK: false,
		},
		{
			name:   "plain x-hasura string inside any array is not a session variable",
			param:  []any{"x-hasura-legacy"},
			wantOK: false,
		},
		{
			name:   "non-session string",
			param:  "some-other-value",
			wantOK: false,
		},
		{
			// A multi-element array (e.g. an _in mixing a session var and a
			// literal) is not a single rewritable marker, so it stays a static
			// parameter rather than becoming a JSON path.
			name:   "multi-element any array with a marker",
			param:  []any{core.SessionVarValue{Name: "x-hasura-a"}, "literal"},
			wantOK: false,
		},
		{
			name:   "integer param",
			param:  42,
			wantOK: false,
		},
		{
			name:   "nil param",
			param:  nil,
			wantOK: false,
		},
		{
			name:   "empty any array",
			param:  []any{},
			wantOK: false,
		},
		{
			name:   "any array with non-marker",
			param:  []any{42},
			wantOK: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			name, ok := extractSessionVarName(tc.param)
			if ok != tc.wantOK {
				t.Errorf("extractSessionVarName(%v) ok = %v, want %v", tc.param, ok, tc.wantOK)
			}

			if name != tc.wantName {
				t.Errorf(
					"extractSessionVarName(%v) name = %q, want %q",
					tc.param,
					name,
					tc.wantName,
				)
			}
		})
	}
}

func TestRewriteSQLForMultiplexing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name               string
		sql                string
		sessionVarIndices  map[int]string
		cursorVarIndices   map[int]string
		staticParamMapping map[int]int
		expected           string
	}{
		{
			name:               "no replacements",
			sql:                `SELECT "id", "name" FROM "users"`,
			sessionVarIndices:  map[int]string{},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{},
			expected:           `SELECT "id", "name" FROM "users"`,
		},
		{
			name:               "session var with type cast",
			sql:                `WHERE "id" = $1::uuid`,
			sessionVarIndices:  map[int]string{1: "x-hasura-user-id"},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{},
			expected:           `WHERE "id" = (("_subs"."result_vars" #>> '{session,x-hasura-user-id}')::uuid)`,
		},
		{
			name:               "cursor var with type cast",
			sql:                `WHERE "created_at" > $1::timestamptz`,
			sessionVarIndices:  map[int]string{},
			cursorVarIndices:   map[int]string{1: "created_at"},
			staticParamMapping: map[int]int{},
			expected:           `WHERE "created_at" > (("_subs"."result_vars" #>> '{cursor,created_at}')::timestamptz)`,
		},
		{
			name:               "static param renumbering with text type strips cast",
			sql:                `WHERE "status" = $2::text`,
			sessionVarIndices:  map[int]string{},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{2: 3},
			expected:           `WHERE "status" = $3`,
		},
		{
			name:               "static param renumbering with non-text type preserves cast",
			sql:                `WHERE "id" = $2::uuid`,
			sessionVarIndices:  map[int]string{},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{2: 3},
			expected:           `WHERE "id" = $3::uuid`,
		},
		{
			name:               "static param renumbering without type",
			sql:                `WHERE "status" = $2`,
			sessionVarIndices:  map[int]string{},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{2: 3},
			expected:           `WHERE "status" = $3`,
		},
		{
			name:               "param without type defaults to text",
			sql:                `WHERE "id" = $1`,
			sessionVarIndices:  map[int]string{1: "x-hasura-user-id"},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{},
			expected:           `WHERE "id" = (("_subs"."result_vars" #>> '{session,x-hasura-user-id}')::text)`,
		},
		{
			name:               "array type with brackets",
			sql:                `WHERE "id" = ANY($1::uuid[])`,
			sessionVarIndices:  map[int]string{1: "x-hasura-allowed-ids"},
			cursorVarIndices:   map[int]string{},
			staticParamMapping: map[int]int{},
			expected:           `WHERE "id" = ANY((("_subs"."result_vars" #>> '{session,x-hasura-allowed-ids}')::uuid[]))`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := rewriteSQLForMultiplexing(
				tc.sql,
				tc.sessionVarIndices,
				tc.cursorVarIndices,
				tc.staticParamMapping,
			)

			if got != tc.expected {
				t.Errorf("rewriteSQLForMultiplexing:\ngot:  %s\nwant: %s", got, tc.expected)
			}
		})
	}
}
