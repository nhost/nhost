package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func graphqlServer(t *testing.T) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		resp := map[string]any{
			"data": map[string]any{
				"users": []any{},
			},
		}

		if err := json.NewEncoder(w).Encode(resp); err != nil {
			t.Fatalf("failed to encode response: %v", err)
		}
	}))

	t.Cleanup(srv.Close)

	return srv
}

type handlerFunc func(
	context.Context,
	mcp.CallToolRequest,
	GraphqlQueryRequest,
) (*mcp.CallToolResult, error)

func TestHandleGraphqlQuery(t *testing.T) {
	t.Parallel()

	srv := graphqlServer(t)
	tool := NewTool(srv.URL, "", "", "")

	runOperationTests(t, tool.handleGraphqlQuery, []operationTestCase{
		{
			name:    "allows queries",
			query:   `query { users { id } }`,
			isError: false,
		},
		{
			name:    "rejects mutations",
			query:   `mutation { insertUser(name: "test") { id } }`,
			isError: true,
		},
		{
			name:    "rejects empty query",
			query:   "",
			isError: true,
		},
	})
}

func TestHandleGraphqlMutation(t *testing.T) {
	t.Parallel()

	srv := graphqlServer(t)
	tool := NewTool(srv.URL, "", "", "")

	runOperationTests(t, tool.handleGraphqlMutation, []operationTestCase{
		{
			name:    "allows mutations",
			query:   `mutation { insertUser(name: "test") { id } }`,
			isError: false,
		},
		{
			name:    "rejects queries",
			query:   `query { users { id } }`,
			isError: true,
		},
		{
			name:    "rejects empty query",
			query:   "",
			isError: true,
		},
	})
}

type operationTestCase struct {
	name    string
	query   string
	isError bool
}

func runOperationTests(
	t *testing.T,
	handler handlerFunc,
	tests []operationTestCase,
) {
	t.Helper()

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := handler(
				context.Background(),
				mcp.CallToolRequest{}, //nolint:exhaustruct
				GraphqlQueryRequest{Query: tc.query, Variables: nil},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.IsError != tc.isError {
				t.Errorf(
					"expected IsError=%v, got IsError=%v",
					tc.isError,
					result.IsError,
				)
			}
		})
	}
}
