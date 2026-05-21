package multiplexed

import (
	"testing"
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
			name:     "direct session variable string",
			param:    "x-hasura-user-id",
			wantName: "x-hasura-user-id",
			wantOK:   true,
		},
		{
			name:     "case insensitive prefix",
			param:    "X-Hasura-Role",
			wantName: "X-Hasura-Role",
			wantOK:   true,
		},
		{
			name:   "non-session string",
			param:  "some-other-value",
			wantOK: false,
		},
		{
			name:     "single-element string array",
			param:    []string{"x-hasura-departments"},
			wantName: "x-hasura-departments",
			wantOK:   true,
		},
		{
			name:   "multi-element string array",
			param:  []string{"x-hasura-a", "x-hasura-b"},
			wantOK: false,
		},
		{
			name:     "single-element any array",
			param:    []any{"x-hasura-org-id"},
			wantName: "x-hasura-org-id",
			wantOK:   true,
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
			name:   "empty string array",
			param:  []string{},
			wantOK: false,
		},
		{
			name:   "any array with non-string",
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
