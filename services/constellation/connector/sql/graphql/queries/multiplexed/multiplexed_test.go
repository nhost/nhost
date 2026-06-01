package multiplexed_test

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

func TestMultiplex(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		op              core.SQLOperation
		expectedSQL     string
		expectedParams  []any
		expectedNoParam bool
	}{
		{
			name: "no parameters",
			op: core.SQLOperation{
				Name:          "users",
				SQL:           `SELECT json_agg("_root") FROM "public"."users"`,
				Parameters:    nil,
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('users', (` +
				`SELECT json_agg("_root") FROM "public"."users"` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedNoParam: true,
		},
		{
			name: "session vars only",
			op: core.SQLOperation{
				Name: "users",
				SQL:  `SELECT "id", "name" FROM "users" WHERE "user_id" = $1::uuid`,
				Parameters: []any{
					"x-hasura-user-id",
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('users', (` +
				`SELECT "id", "name" FROM "users" WHERE "user_id" = (("_subs"."result_vars" #>> '{session,x-hasura-user-id}')::uuid)` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedNoParam: true,
		},
		{
			name: "mixed params",
			op: core.SQLOperation{
				Name: "users",
				SQL:  `SELECT "id", "name" FROM "users" WHERE "org_id" = $1::uuid AND "status" = $2`,
				Parameters: []any{
					"x-hasura-org-id",
					"active",
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('users', (` +
				`SELECT "id", "name" FROM "users" WHERE "org_id" = (("_subs"."result_vars" #>> '{session,x-hasura-org-id}')::uuid) AND "status" = $3` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedParams: []any{"active"},
		},
		{
			name: "cursor values",
			op: core.SQLOperation{
				Name: "users_stream",
				SQL:  `SELECT "id", "name" FROM "users" WHERE "id" > $1::uuid AND "org_id" = $2::uuid`,
				Parameters: []any{
					core.CursorValue{ColumnName: "id", Value: "initial-id"},
					"x-hasura-org-id",
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('users_stream', (` +
				`SELECT "id", "name" FROM "users" WHERE "id" > (("_subs"."result_vars" #>> '{cursor,id}')::uuid) AND "org_id" = (("_subs"."result_vars" #>> '{session,x-hasura-org-id}')::uuid)` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedNoParam: true,
		},
		{
			name: "function session argument",
			op: core.SQLOperation{
				Name: "session_echoes_for_session",
				SQL: `SELECT "id", "user_id" FROM "public"."session_echoes_for_session"(` +
					`"session" := $1)`,
				Parameters: []any{
					core.FunctionSessionArgument{SQLType: "json"},
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('session_echoes_for_session', (` +
				`SELECT "id", "user_id" FROM "public"."session_echoes_for_session"("session" := (("_subs"."result_vars" -> 'session')::json))` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedNoParam: true,
		},
		{
			name: "function session argument with renumbered static param",
			op: core.SQLOperation{
				Name: "f",
				SQL: `SELECT "id" FROM "public"."f"(` +
					`"session" := $1, "limit_arg" := $2)`,
				Parameters: []any{
					core.FunctionSessionArgument{SQLType: "jsonb"},
					int64(10),
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('f', (` +
				`SELECT "id" FROM "public"."f"("session" := (("_subs"."result_vars" -> 'session')::jsonb), "limit_arg" := $3)` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedParams: []any{int64(10)},
		},
		{
			name: "renumbered static param before function session argument",
			op: core.SQLOperation{
				Name: "f",
				SQL: `SELECT "id" FROM "public"."f"(` +
					`"limit_arg" := $1, "session" := $2)`,
				Parameters: []any{
					int64(10),
					core.FunctionSessionArgument{SQLType: "jsonb"},
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('f', (` +
				`SELECT "id" FROM "public"."f"("limit_arg" := $3, "session" := (("_subs"."result_vars" -> 'session')::jsonb))` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedParams: []any{int64(10)},
		},
		{
			name: "static params only",
			op: core.SQLOperation{
				Name: "items",
				SQL:  `SELECT "id", "name" FROM "items" WHERE "category" = $1 AND "price" > $2`,
				Parameters: []any{
					"electronics",
					99.99,
				},
				StreamCursors: nil,
			},
			expectedSQL: `SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM ` +
				`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") ` +
				`LEFT OUTER JOIN LATERAL (SELECT json_build_object('items', (` +
				`SELECT "id", "name" FROM "items" WHERE "category" = $3 AND "price" > $4` +
				`)) AS "root") AS "_fld_resp" ON ('true')`,
			expectedParams: []any{"electronics", 99.99},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gotSQL, gotParams := multiplexed.Multiplex(tc.op)

			if gotSQL != tc.expectedSQL {
				t.Errorf("sql:\ngot:  %s\nwant: %s", gotSQL, tc.expectedSQL)
			}

			if tc.expectedNoParam {
				if len(gotParams) != 0 {
					t.Errorf("staticParams = %v, want empty", gotParams)
				}

				return
			}

			if diff := cmp.Diff(tc.expectedParams, gotParams); diff != "" {
				t.Errorf("staticParams mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func parseResultVars(t *testing.T, params []any) []string {
	t.Helper()

	resultVars, ok := params[1].([]string)
	if !ok {
		t.Fatalf("params[1] type = %T, want []string", params[1])
	}

	return resultVars
}

func parseResultVarsJSON(t *testing.T, params []any, idx int) map[string]any {
	t.Helper()

	resultVars := parseResultVars(t, params)

	var parsed map[string]any
	if err := json.Unmarshal([]byte(resultVars[idx]), &parsed); err != nil {
		t.Fatalf("resultVars[%d] is not valid JSON: %v", idx, err)
	}

	return parsed
}

func assertBasicSessionVars(t *testing.T, params []any) {
	t.Helper()

	subIDs, ok := params[0].([]string)
	if !ok {
		t.Fatalf("params[0] type = %T, want []string", params[0])
	}

	if diff := cmp.Diff([]string{"sub-1", "sub-2"}, subIDs); diff != "" {
		t.Errorf("subscription IDs mismatch (-want +got):\n%s", diff)
	}

	resultVars := parseResultVars(t, params)
	if len(resultVars) != 2 {
		t.Fatalf("resultVars length = %d, want 2", len(resultVars))
	}

	for i := range resultVars {
		assertSessionVar(t, params, i, "x-hasura-user-id")
	}
}

func assertSessionVar(t *testing.T, params []any, idx int, key string) {
	t.Helper()

	parsed := parseResultVarsJSON(t, params, idx)

	session, ok := parsed["session"].(map[string]any)
	if !ok {
		t.Fatalf("resultVars[%d] missing session key", idx)
	}

	if _, ok := session[key]; !ok {
		t.Errorf("resultVars[%d] missing %s", idx, key)
	}
}

func assertCursorString(t *testing.T, params []any, key, want string) {
	t.Helper()

	parsed := parseResultVarsJSON(t, params, 0)

	cursor, ok := parsed["cursor"].(map[string]any)
	if !ok {
		t.Fatal("missing cursor key in result vars")
	}

	if cursor[key] != want {
		t.Errorf("cursor %s = %v, want %s", key, cursor[key], want)
	}
}

func assertNoCursorKey(t *testing.T, params []any) {
	t.Helper()

	parsed := parseResultVarsJSON(t, params, 0)

	if _, ok := parsed["cursor"]; ok {
		t.Error("expected no cursor key when cursorValues is nil")
	}
}

func assertNumericCursor(t *testing.T, params []any, key string, want float64) {
	t.Helper()

	parsed := parseResultVarsJSON(t, params, 0)

	cursor, ok := parsed["cursor"].(map[string]any)
	if !ok {
		t.Fatal("missing cursor key in result vars")
	}

	// json.Unmarshal into map[string]any decodes JSON numbers to float64.
	num, ok := cursor[key].(float64)
	if !ok {
		t.Fatalf("cursor %s type = %T, want float64 (decoded from JSON number)", key, cursor[key])
	}

	if num != want {
		t.Errorf("cursor %s = %v, want %v", key, num, want)
	}
}

func assertSessionVarString(t *testing.T, params []any, key, want string) {
	t.Helper()

	parsed := parseResultVarsJSON(t, params, 0)

	session, ok := parsed["session"].(map[string]any)
	if !ok {
		t.Fatal("missing session key in result vars")
	}

	got, ok := session[key].(string)
	if !ok {
		t.Fatalf("session value type = %T, want string", session[key])
	}

	if got != want {
		t.Errorf("session value = %q, want %q", got, want)
	}
}

func TestPrepareParams(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		subscriptionIDs  []string
		sessionVarArrays map[string][]any
		cursorValues     map[string]any
		assert           func(t *testing.T, params []any)
	}{
		{
			name:            "basic session vars",
			subscriptionIDs: []string{"sub-1", "sub-2"},
			sessionVarArrays: map[string][]any{
				"x-hasura-user-id": {"user-a", "user-b"},
			},
			cursorValues: nil,
			assert:       assertBasicSessionVars,
		},
		{
			name:            "with cursor values",
			subscriptionIDs: []string{"sub-1"},
			sessionVarArrays: map[string][]any{
				"x-hasura-user-id": {"user-a"},
			},
			cursorValues: map[string]any{"id": "cursor-abc"},
			assert: func(t *testing.T, params []any) {
				t.Helper()
				assertCursorString(t, params, "id", "cursor-abc")
			},
		},
		{
			name:            "nil cursor omits cursor key",
			subscriptionIDs: []string{"sub-1"},
			sessionVarArrays: map[string][]any{
				"x-hasura-user-id": {"user-a"},
			},
			cursorValues: nil,
			assert:       assertNoCursorKey,
		},
		{
			name:             "numeric cursor value is JSON-encoded as a number",
			subscriptionIDs:  []string{"sub-1"},
			sessionVarArrays: map[string][]any{},
			cursorValues:     map[string]any{"id": 42},
			assert: func(t *testing.T, params []any) {
				t.Helper()
				assertNumericCursor(t, params, "id", 42)
			},
		},
		{
			name:            "value containing quotes is escaped, not embedded raw",
			subscriptionIDs: []string{"sub-1"},
			sessionVarArrays: map[string][]any{
				"x-hasura-user-id": {`user "with" quotes`},
			},
			cursorValues: nil,
			assert: func(t *testing.T, params []any) {
				t.Helper()
				assertSessionVarString(t, params, "x-hasura-user-id", `user "with" quotes`)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			params := multiplexed.PrepareParams(
				tc.subscriptionIDs,
				tc.sessionVarArrays,
				tc.cursorValues,
			)

			tc.assert(t, params)
		})
	}
}

func TestExtractInitialCursorValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		cursors  []core.StreamCursorInfo
		expected map[string]any
	}{
		{
			name:     "nil cursors",
			cursors:  nil,
			expected: nil,
		},
		{
			name:     "empty cursors",
			cursors:  []core.StreamCursorInfo{},
			expected: nil,
		},
		{
			name: "single cursor",
			cursors: []core.StreamCursorInfo{
				{
					ColumnName:   "id",
					GraphQLName:  "id",
					InitialValue: "abc-123",
					Ordering:     core.OrderAsc,
				},
			},
			expected: map[string]any{"id": "abc-123"},
		},
		{
			name: "multiple cursors",
			cursors: []core.StreamCursorInfo{
				{
					ColumnName:   "id",
					GraphQLName:  "id",
					InitialValue: "abc",
					Ordering:     core.OrderAsc,
				},
				{
					ColumnName:   "created_at",
					GraphQLName:  "createdAt",
					InitialValue: "2024-01-01",
					Ordering:     core.OrderDesc,
				},
			},
			expected: map[string]any{"id": "abc", "created_at": "2024-01-01"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := multiplexed.ExtractInitialCursorValues(tc.cursors)
			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("ExtractInitialCursorValues mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
