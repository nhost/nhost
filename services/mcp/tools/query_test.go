package tools_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/tools"
)

func TestSessionVariables(t *testing.T) {
	t.Parallel()

	operations := []struct {
		name  string
		query string
	}{
		{
			name:  tools.ToolGraphqlQueryName,
			query: `query Users($limit: Int!) { users(limit: $limit) { id } }`,
		},
		{
			name:  tools.ToolGraphqlMutationName,
			query: `mutation InsertUsers($limit: Int!) { insert_users(objects: {id: $limit}) { affected_rows } }`,
		},
	}

	for _, operation := range operations {
		t.Run(operation.name, func(t *testing.T) {
			t.Parallel()
			testSessionVariables(t, operation.name, operation.query)
		})
	}
}

func testSessionVariables(t *testing.T, toolName, query string) {
	t.Helper()

	tests := []struct {
		name             string
		sessionVariables any
		expectedHeaders  http.Header
		errorContains    string
	}{
		{
			name:            "omitted",
			expectedHeaders: http.Header{},
		},
		{
			name:             "empty",
			sessionVariables: map[string]string{},
			expectedHeaders:  http.Header{},
		},
		{
			name: "role and arbitrary variables",
			sessionVariables: map[string]string{
				"role":      "facilitator",
				"something": "else",
				"user-id":   "user-123",
			},
			expectedHeaders: http.Header{
				"X-Hasura-Role":      {"facilitator"},
				"X-Hasura-Something": {"else"},
				"X-Hasura-User-Id":   {"user-123"},
			},
		},
		{
			name:             "empty value",
			sessionVariables: map[string]string{"something": ""},
			expectedHeaders:  http.Header{"X-Hasura-Something": {""}},
		},
		{
			name:             "non-string value",
			sessionVariables: map[string]any{"something": 42},
			errorContains:    "failed to bind arguments",
		},
		{
			name:             "invalid header name",
			sessionVariables: map[string]string{"invalid key": "value"},
			errorContains:    "invalid header field name",
		},
		{
			name:             "invalid header value",
			sessionVariables: map[string]string{"something": "value\r\nInjected: header"},
			errorContains:    "invalid header field value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			testSessionVariableRequest(
				t,
				toolName,
				query,
				tt.sessionVariables,
				tt.expectedHeaders,
				tt.errorContains,
			)
		})
	}
}

func testSessionVariableRequest(
	t *testing.T,
	toolName, query string,
	sessionVariables any,
	expectedHeaders http.Header,
	errorContains string,
) {
	t.Helper()

	headers := make(chan http.Header, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("failed to decode GraphQL request: %v", err)
		}

		if diff := cmp.Diff(map[string]any{
			"query":     query,
			"variables": map[string]any{"limit": float64(3)},
		}, body); diff != "" {
			t.Errorf("GraphQL body mismatch (-want +got):\n%s", diff)
		}

		headers <- r.Header.Clone()

		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).
			Encode(map[string]any{"data": map[string]any{"users": []any{}}}); err != nil {
			t.Errorf("failed to encode GraphQL response: %v", err)
		}
	}))
	t.Cleanup(srv.Close)

	mcpClient := newToolClient(t, srv.URL)
	authRequest := httptest.NewRequest(http.MethodGet, "/", nil)
	authRequest.Header.Set("Authorization", "Bearer session-test-token")
	ctx := tools.AuthorizationToContext(t.Context(), authRequest)

	args := map[string]any{"query": query, "variables": map[string]any{"limit": 3}}
	if sessionVariables != nil {
		args["session_variables"] = sessionVariables
	}

	request := mcp.CallToolRequest{}
	request.Params.Name = toolName
	request.Params.Arguments = args

	result, err := mcpClient.CallTool(ctx, request)
	if err != nil {
		t.Fatalf("failed to call tool: %v", err)
	}

	if errorContains != "" {
		assertToolError(t, result, errorContains)

		select {
		case <-headers:
			t.Fatal("invalid session variables must not reach the GraphQL server")
		default:
		}

		return
	}

	if result.IsError {
		t.Fatalf("expected success, got %+v", result)
	}

	assertSessionHeaders(t, <-headers, expectedHeaders)

	// A subsequent call on the same tool must not inherit session variables.
	delete(args, "session_variables")

	result, err = mcpClient.CallTool(ctx, request)
	if err != nil || result.IsError {
		t.Fatalf("subsequent call failed: result=%+v, error=%v", result, err)
	}

	assertSessionHeaders(t, <-headers, http.Header{})
}

func assertToolError(t *testing.T, result *mcp.CallToolResult, contains string) {
	t.Helper()

	if !result.IsError || len(result.Content) == 0 {
		t.Fatalf("expected error containing %q, got %+v", contains, result)
	}

	text, ok := result.Content[0].(mcp.TextContent)
	if !ok || !strings.Contains(text.Text, contains) {
		t.Fatalf("expected error containing %q, got %+v", contains, result)
	}
}

func assertSessionHeaders(t *testing.T, headers, expected http.Header) {
	t.Helper()

	if got := headers.Get("Authorization"); got != "Bearer session-test-token" {
		t.Errorf("Authorization header not preserved: %q", got)
	}

	sessionHeaders := http.Header{}
	for key, values := range headers {
		if strings.HasPrefix(strings.ToLower(key), "x-hasura-") {
			sessionHeaders[key] = values
		}
	}

	if diff := cmp.Diff(expected, sessionHeaders); diff != "" {
		t.Errorf("session headers mismatch (-want +got):\n%s", diff)
	}
}

func newToolClient(t *testing.T, endpoint string) *client.Client {
	t.Helper()

	s := mcpserver.NewMCPServer("test", "1.0.0")
	tool := tools.NewTool(endpoint, "", "", "")
	tool.RegisterQuery(s)
	tool.RegisterMutation(s)

	mcpClient, err := client.NewInProcessClient(s)
	if err != nil {
		t.Fatalf("failed to create MCP client: %v", err)
	}

	t.Cleanup(func() {
		if err := mcpClient.Close(); err != nil {
			t.Errorf("failed to close MCP client: %v", err)
		}
	})

	if err := mcpClient.Start(t.Context()); err != nil {
		t.Fatalf("failed to start MCP client: %v", err)
	}

	init := mcp.InitializeRequest{}
	init.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	init.Params.ClientInfo = mcp.Implementation{Name: "test", Version: "1.0.0"}

	if _, err := mcpClient.Initialize(t.Context(), init); err != nil {
		t.Fatalf("failed to initialize MCP client: %v", err)
	}

	return mcpClient
}
