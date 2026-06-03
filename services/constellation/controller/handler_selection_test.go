package controller_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
)

// postQuery drives a GraphQL POST through the admin-secret router and returns
// the decoded JSON body and HTTP status.
func postQuery(t *testing.T, ctrl *controller.Controller, body string) (map[string]any, int) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return readJSONBody(t, w), w.Code
}

func TestHandlerPost_RootFragmentSpreadResolvesData(t *testing.T) {
	t.Parallel()

	body, code := postQuery(
		t, newTestController(t),
		`{"query":"query { ...Roots } fragment Roots on query_root { users { id name } }"}`,
	)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}

	if _, hasErr := body["errors"]; hasErr {
		t.Fatalf("unexpected errors: %v", body["errors"])
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %v", body["data"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Fatalf("root fragment spread dropped data: %v", data)
	}
}

func TestHandlerPost_RootInlineFragmentResolvesData(t *testing.T) {
	t.Parallel()

	body, code := postQuery(
		t, newTestController(t),
		`{"query":"{ ... on query_root { users { id name } } }"}`,
	)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}

	if _, hasErr := body["errors"]; hasErr {
		t.Fatalf("unexpected errors: %v", body["errors"])
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %v", body["data"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Fatalf("root inline fragment dropped data: %v", data)
	}
}

func TestHandlerPost_SkipIncludeRootField(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		query     string
		wantUsers bool
	}{
		{
			name:      "skip true drops field",
			query:     `{ users @skip(if: true) { id } }`,
			wantUsers: false,
		},
		{
			name:      "skip false keeps field",
			query:     `{ users @skip(if: false) { id } }`,
			wantUsers: true,
		},
		{
			name:      "include false drops field",
			query:     `{ users @include(if: false) { id } }`,
			wantUsers: false,
		},
		{
			name:      "include true keeps field",
			query:     `{ users @include(if: true) { id } }`,
			wantUsers: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// The directive queries contain no JSON-special characters, so they
			// embed directly into the request body.
			reqBody := `{"query":"` + tc.query + `"}`

			body, code := postQuery(t, newTestController(t), reqBody)
			if code != http.StatusOK {
				t.Fatalf("expected 200, got %d", code)
			}

			if _, hasErr := body["errors"]; hasErr {
				t.Fatalf("unexpected errors: %v", body["errors"])
			}

			data, _ := body["data"].(map[string]any)
			_, hasUsers := data["users"]

			if hasUsers != tc.wantUsers {
				t.Fatalf("users present=%v, want %v (data=%v)", hasUsers, tc.wantUsers, data)
			}
		})
	}
}

func TestHandlerPost_DirectiveVariablesCoercedWhenRequestVariablesEmpty(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		body            string
		wantErrContains string
		wantUsers       bool
	}{
		{
			name: "missing required directive variable returns validation error",
			body: `{"query":"query Q($includeUsers: Boolean!) { users @include(if: $includeUsers) { id } }",` +
				`"operationName":"Q"}`,
			wantErrContains: "must be defined",
			wantUsers:       false,
		},
		{
			name: "defaulted directive variable is applied",
			body: `{"query":"query Q($includeUsers: Boolean = true) { users @include(if: $includeUsers) { id } }",` +
				`"operationName":"Q"}`,
			wantErrContains: "",
			wantUsers:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body, code := postQuery(t, newTestController(t), tt.body)
			if code != http.StatusOK {
				t.Fatalf("expected 200, got %d", code)
			}

			if tt.wantErrContains != "" {
				errs, ok := body["errors"].([]any)
				if !ok || len(errs) == 0 {
					t.Fatalf("expected a variable validation error, got %v", body)
				}

				errObj, _ := errs[0].(map[string]any)

				msg, _ := errObj["message"].(string)
				if !strings.Contains(msg, tt.wantErrContains) {
					t.Fatalf("expected error containing %q, got %q", tt.wantErrContains, msg)
				}

				if data, hasData := body["data"]; hasData && data != nil {
					t.Fatalf("expected no data on validation error, got %v", data)
				}

				return
			}

			if _, hasErr := body["errors"]; hasErr {
				t.Fatalf("unexpected errors: %v", body["errors"])
			}

			data, ok := body["data"].(map[string]any)
			if !ok {
				t.Fatalf("expected data object, got %v", body["data"])
			}

			_, hasUsers := data["users"]
			if hasUsers != tt.wantUsers {
				t.Fatalf("users present=%v, want %v (data=%v)", hasUsers, tt.wantUsers, data)
			}
		})
	}
}

func TestHandlerPost_UnmatchedOperationNameReturnsNotFound(t *testing.T) {
	t.Parallel()

	body, _ := postQuery(
		t, newTestController(t),
		`{"query":"query A { users { id } } query B { users { name } }","operationName":"C"}`,
	)

	errs, ok := body["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected an error, got %v", body)
	}

	errObj, _ := errs[0].(map[string]any)

	msg, _ := errObj["message"].(string)
	if msg != `no such operation found in the document: "C"` {
		t.Fatalf("expected Hasura not-found message naming the operation, got %q", msg)
	}

	ext, _ := errObj["extensions"].(map[string]any)
	if ext["code"] != "validation-failed" {
		t.Errorf("expected validation-failed code, got %v", ext["code"])
	}
}

func TestHandlerPost_NoNameMultipleOperationsStillReportsAmbiguity(t *testing.T) {
	t.Parallel()

	body, _ := postQuery(
		t, newTestController(t),
		`{"query":"query A { users { id } } query B { users { name } }"}`,
	)

	errs, ok := body["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected an error, got %v", body)
	}

	msg, _ := errs[0].(map[string]any)["message"].(string)
	if !strings.Contains(msg, "exactly one operation has to be present") {
		t.Fatalf("expected the ambiguous-operation message, got %q", msg)
	}
}
