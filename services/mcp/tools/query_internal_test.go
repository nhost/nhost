package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

type capturedRequest struct {
	mu         sync.Mutex
	authHeader string
}

func (c *capturedRequest) getAuthHeader() string {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.authHeader
}

func newGraphQLServer(
	t *testing.T,
	response any,
) (*httptest.Server, *capturedRequest) {
	t.Helper()

	captured := &capturedRequest{
		mu:         sync.Mutex{},
		authHeader: "",
	}

	srv := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			captured.mu.Lock()
			captured.authHeader = r.Header.Get("Authorization")
			captured.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")

			if err := json.NewEncoder(w).Encode(response); err != nil {
				t.Fatalf("failed to encode response: %v", err)
			}
		}),
	)

	t.Cleanup(srv.Close)

	return srv, captured
}

func graphqlServer(t *testing.T) (*httptest.Server, *capturedRequest) {
	t.Helper()

	return newGraphQLServer(t, map[string]any{
		"data": map[string]any{
			"users": []any{},
		},
	})
}

func introspectionServer(t *testing.T) (*httptest.Server, *capturedRequest) {
	t.Helper()

	return newGraphQLServer(t, map[string]any{
		"data": map[string]any{
			"__schema": map[string]any{
				"queryType": map[string]any{
					"kind": "OBJECT",
					"name": "query_root",
					"fields": []any{
						map[string]any{
							"name":        "users",
							"description": "fetch users",
							"args":        []any{},
							"type": map[string]any{
								"kind": "NON_NULL",
								"name": nil,
								"ofType": map[string]any{
									"kind": "LIST",
									"name": nil,
									"ofType": map[string]any{
										"kind":   "OBJECT",
										"name":   "users",
										"ofType": nil,
									},
								},
							},
						},
						map[string]any{
							"name":        "posts",
							"description": "fetch posts",
							"args":        []any{},
							"type": map[string]any{
								"kind":   "OBJECT",
								"name":   "posts",
								"ofType": nil,
							},
						},
					},
					"inputFields":   nil,
					"interfaces":    nil,
					"enumValues":    nil,
					"possibleTypes": nil,
				},
				"mutationType": map[string]any{
					"kind": "OBJECT",
					"name": "mutation_root",
					"fields": []any{
						map[string]any{
							"name":        "insert_users",
							"description": "insert users",
							"args":        []any{},
							"type": map[string]any{
								"kind":   "OBJECT",
								"name":   "users_mutation_response",
								"ofType": nil,
							},
						},
					},
					"inputFields":   nil,
					"interfaces":    nil,
					"enumValues":    nil,
					"possibleTypes": nil,
				},
				"types": []any{
					map[string]any{
						"kind":          "SCALAR",
						"name":          "Int",
						"fields":        nil,
						"inputFields":   nil,
						"interfaces":    nil,
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					map[string]any{
						"kind":          "SCALAR",
						"name":          "String",
						"fields":        nil,
						"inputFields":   nil,
						"interfaces":    nil,
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					map[string]any{
						"kind": "OBJECT",
						"name": "users",
						"fields": []any{
							map[string]any{
								"name":        "id",
								"description": nil,
								"args":        []any{},
								"type": map[string]any{
									"kind":   "SCALAR",
									"name":   "Int",
									"ofType": nil,
								},
							},
							map[string]any{
								"name":        "name",
								"description": nil,
								"args":        []any{},
								"type": map[string]any{
									"kind":   "SCALAR",
									"name":   "String",
									"ofType": nil,
								},
							},
						},
						"inputFields":   nil,
						"interfaces":    []any{},
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					map[string]any{
						"kind": "OBJECT",
						"name": "posts",
						"fields": []any{
							map[string]any{
								"name":        "id",
								"description": nil,
								"args":        []any{},
								"type": map[string]any{
									"kind":   "SCALAR",
									"name":   "Int",
									"ofType": nil,
								},
							},
							map[string]any{
								"name":        "title",
								"description": nil,
								"args":        []any{},
								"type": map[string]any{
									"kind":   "SCALAR",
									"name":   "String",
									"ofType": nil,
								},
							},
						},
						"inputFields":   nil,
						"interfaces":    []any{},
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					map[string]any{
						"kind": "OBJECT",
						"name": "users_mutation_response",
						"fields": []any{
							map[string]any{
								"name":        "affected_rows",
								"description": nil,
								"args":        []any{},
								"type": map[string]any{
									"kind":   "SCALAR",
									"name":   "Int",
									"ofType": nil,
								},
							},
						},
						"inputFields":   nil,
						"interfaces":    []any{},
						"enumValues":    nil,
						"possibleTypes": nil,
					},
				},
			},
		},
	})
}

func contextWithAuthorization(t *testing.T, token string) context.Context {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", token)

	return AuthorizationToContext(context.Background(), req)
}

func resultText(t *testing.T, result *mcp.CallToolResult) string {
	t.Helper()

	if len(result.Content) == 0 {
		t.Fatal("expected at least one content item")
	}

	textContent, ok := result.Content[0].(mcp.TextContent)
	if !ok {
		t.Fatalf("expected TextContent, got %T", result.Content[0])
	}

	return textContent.Text
}

type handlerFunc func(
	context.Context,
	mcp.CallToolRequest,
	GraphqlQueryRequest,
) (*mcp.CallToolResult, error)

func TestHandleGraphqlQuery(t *testing.T) {
	t.Parallel()

	srv, _ := graphqlServer(t)
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

	srv, _ := graphqlServer(t)
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

func TestHandleGetSchema(t *testing.T) {
	t.Parallel()

	srv, _ := introspectionServer(t)
	tool := NewTool(srv.URL, "", "", "")

	runSchemaTests(t, tool, []schemaTestCase{
		{
			name:     "returns summary",
			request:  GetSchemaRequest{Summary: new(true), Queries: nil, Mutations: nil},
			contains: []string{"users", "posts", "insert_users"},
		},
		{
			name:     "returns summary (default)",
			request:  GetSchemaRequest{Summary: nil, Queries: nil, Mutations: nil},
			contains: []string{"users", "posts", "insert_users"},
		},
		{
			name:     "returns full schema",
			request:  GetSchemaRequest{Summary: new(false), Queries: nil, Mutations: nil},
			contains: []string{"users", "posts", "insert_users"},
		},
		{
			name: "filters queries",
			request: GetSchemaRequest{
				Summary:   new(false),
				Queries:   []string{"users"},
				Mutations: nil,
			},
			contains: []string{"users"},
		},
		{
			name: "filters mutations",
			request: GetSchemaRequest{
				Summary:   new(false),
				Queries:   nil,
				Mutations: []string{"insert_users"},
			},
			contains: []string{"insert_users"},
		},
	})
}

func TestAuthorizationForwarding(t *testing.T) {
	t.Parallel()

	runAuthTests(t, []authTestCase{
		{
			name:         "forwards authorization header for queries",
			token:        "Bearer test-token-123",
			expectedAuth: "Bearer test-token-123",
			newServer:    graphqlServer,
			call: func(tool *Tool, ctx context.Context) (*mcp.CallToolResult, error) {
				return tool.handleGraphqlQuery(
					ctx,
					mcp.CallToolRequest{}, //nolint:exhaustruct
					GraphqlQueryRequest{Query: `query { users { id } }`, Variables: nil},
				)
			},
		},
		{
			name:         "forwards authorization header for mutations",
			token:        "Bearer mutation-token",
			expectedAuth: "Bearer mutation-token",
			newServer:    graphqlServer,
			call: func(tool *Tool, ctx context.Context) (*mcp.CallToolResult, error) {
				return tool.handleGraphqlMutation(
					ctx,
					mcp.CallToolRequest{}, //nolint:exhaustruct
					GraphqlQueryRequest{
						Query:     `mutation { insertUser(name: "test") { id } }`,
						Variables: nil,
					},
				)
			},
		},
		{
			name:         "forwards authorization header for schema",
			token:        "Bearer schema-token",
			expectedAuth: "Bearer schema-token",
			newServer:    introspectionServer,
			call: func(tool *Tool, ctx context.Context) (*mcp.CallToolResult, error) {
				return tool.handleGetSchema(
					ctx,
					mcp.CallToolRequest{}, //nolint:exhaustruct
					GetSchemaRequest{Summary: new(true), Queries: nil, Mutations: nil},
				)
			},
		},
		{
			name:         "omits authorization header when not in context",
			token:        "",
			expectedAuth: "",
			newServer:    graphqlServer,
			call: func(tool *Tool, ctx context.Context) (*mcp.CallToolResult, error) {
				return tool.handleGraphqlQuery(
					ctx,
					mcp.CallToolRequest{}, //nolint:exhaustruct
					GraphqlQueryRequest{Query: `query { users { id } }`, Variables: nil},
				)
			},
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

type schemaTestCase struct {
	name     string
	request  GetSchemaRequest
	contains []string
}

func runSchemaTests(t *testing.T, tool *Tool, tests []schemaTestCase) {
	t.Helper()

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := tool.handleGetSchema(
				context.Background(),
				mcp.CallToolRequest{}, //nolint:exhaustruct
				tc.request,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.IsError {
				t.Fatal("expected success, got error result")
			}

			text := resultText(t, result)

			for _, name := range tc.contains {
				if !strings.Contains(text, name) {
					t.Errorf("result should contain %q, got:\n%s", name, text)
				}
			}
		})
	}
}

type authTestCase struct {
	name         string
	token        string
	expectedAuth string
	newServer    func(*testing.T) (*httptest.Server, *capturedRequest)
	call         func(*Tool, context.Context) (*mcp.CallToolResult, error)
}

func runAuthTests(t *testing.T, tests []authTestCase) {
	t.Helper()

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv, captured := tc.newServer(t)
			tool := NewTool(srv.URL, "", "", "")

			ctx := context.Background()
			if tc.token != "" {
				ctx = contextWithAuthorization(t, tc.token)
			}

			result, err := tc.call(tool, ctx)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.IsError {
				t.Fatal("expected success, got error result")
			}

			if got := captured.getAuthHeader(); got != tc.expectedAuth {
				t.Errorf(
					"expected Authorization header %q, got %q",
					tc.expectedAuth,
					got,
				)
			}
		})
	}
}
