package tool

import (
	"context"
	"errors"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool/mock"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
	"go.uber.org/mock/gomock"
)

func TestMCPToolDefinition(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		tool MCPTool
		want provider.ToolDefinition
	}{
		{
			name: "basic definition",
			tool: MCPTool{
				name: "test_tool",
				definition: provider.ToolDefinition{
					Name:        "test_tool",
					Description: "A test tool",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"query": map[string]any{
								"type":        "string",
								"description": "search query",
							},
						},
						"required": []string{"query"},
					},
				},
				client: nil,
			},
			want: provider.ToolDefinition{
				Name:        "test_tool",
				Description: "A test tool",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{
							"type":        "string",
							"description": "search query",
						},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			name: "empty parameters",
			tool: MCPTool{
				name: "simple",
				definition: provider.ToolDefinition{
					Name:        "simple",
					Description: "no params",
					Parameters:  map[string]any{},
				},
				client: nil,
			},
			want: provider.ToolDefinition{
				Name:        "simple",
				Description: "no params",
				Parameters:  map[string]any{},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := tc.tool.Definition()
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("Definition() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestMCPToolExecuteIsErrorReturnedAsResult(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		result  *mcp.CallToolResult
		want    string
		wantErr bool
	}{
		{
			name: "is_error true surfaces text as result",
			result: &mcp.CallToolResult{
				Result: mcp.Result{},
				Content: []mcp.Content{
					mcp.NewTextContent("rate limit exceeded, retry after 30s"),
				},
				StructuredContent: nil,
				IsError:           true,
			},
			want:    "rate limit exceeded, retry after 30s",
			wantErr: false,
		},
		{
			name: "is_error false returns text as result",
			result: &mcp.CallToolResult{
				Result:            mcp.Result{},
				Content:           []mcp.Content{mcp.NewTextContent("ok")},
				StructuredContent: nil,
				IsError:           false,
			},
			want:    "ok",
			wantErr: false,
		},
		{
			name: "is_error true with multiple text parts concatenates",
			result: &mcp.CallToolResult{
				Result: mcp.Result{},
				Content: []mcp.Content{
					mcp.NewTextContent("part1 "),
					mcp.NewTextContent("part2"),
				},
				StructuredContent: nil,
				IsError:           true,
			},
			want:    "part1 part2",
			wantErr: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			client := mock.NewMockMCPClient(ctrl)
			client.EXPECT().
				CallTool(gomock.Any(), gomock.Any()).
				Return(tc.result, nil)

			tool := &MCPTool{
				name: "test_tool",
				definition: provider.ToolDefinition{
					Name:        "test_tool",
					Description: "A test tool",
					Parameters:  map[string]any{},
				},
				client: client,
			}

			got, err := tool.Execute(context.Background(), "{}", slog.Default())
			if (err != nil) != tc.wantErr {
				t.Fatalf("Execute() error = %v, wantErr = %v", err, tc.wantErr)
			}

			if got != tc.want {
				t.Errorf("Execute() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestMCPToolExecuteInvalidJSON(t *testing.T) {
	t.Parallel()

	tool := &MCPTool{
		name: "test_tool",
		definition: provider.ToolDefinition{
			Name:        "test_tool",
			Description: "A test tool",
			Parameters:  map[string]any{},
		},
		client: nil,
	}

	_, err := tool.Execute(context.Background(), "not valid json", slog.Default())
	if err == nil {
		t.Fatal("expected error for invalid JSON arguments")
	}
}

func TestMCPToolExecuteEmptyArguments(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		arguments string
	}{
		{name: "empty string", arguments: ""},
		{name: "whitespace only", arguments: "   "},
		{name: "tabs and newlines", arguments: "\t\n "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			client := mock.NewMockMCPClient(ctrl)
			client.EXPECT().
				CallTool(gomock.Any(), gomock.Any()).
				DoAndReturn(func(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
					if diff := cmp.Diff(map[string]any{}, req.Params.Arguments); diff != "" {
						t.Errorf("Arguments mismatch (-want +got):\n%s", diff)
					}

					return &mcp.CallToolResult{
						Result:            mcp.Result{},
						Content:           []mcp.Content{mcp.NewTextContent("ok")},
						StructuredContent: nil,
						IsError:           false,
					}, nil
				})

			tool := &MCPTool{
				name: "test_tool",
				definition: provider.ToolDefinition{
					Name:        "test_tool",
					Description: "A test tool",
					Parameters:  map[string]any{},
				},
				client: client,
			}

			got, err := tool.Execute(context.Background(), tc.arguments, slog.Default())
			if err != nil {
				t.Fatalf("Execute() unexpected error: %v", err)
			}

			if got != "ok" {
				t.Errorf("Execute() = %q, want %q", got, "ok")
			}
		})
	}
}

func TestNewMCPManager(t *testing.T) {
	t.Parallel()

	mgr := NewMCPManager()
	if mgr == nil {
		t.Fatal("expected non-nil manager")
	}

	if got := len(mgr.Tools()); got != 0 {
		t.Errorf("expected 0 tools, got %d", got)
	}

	if diff := cmp.Diff(map[string][]string{}, mgr.ServerTools()); diff != "" {
		t.Errorf("ServerTools() mismatch (-want +got):\n%s", diff)
	}
}

func TestMCPManagerConnectEmpty(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		servers []MCPServerConfig
	}{
		{name: "nil servers", servers: nil},
		{name: "empty servers", servers: []MCPServerConfig{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mgr := NewMCPManager()

			if err := mgr.Connect(context.Background(), tc.servers, slog.Default()); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestMCPManagerConnectInvalidURL(t *testing.T) {
	t.Parallel()

	mgr := NewMCPManager()

	servers := []MCPServerConfig{
		{
			URL:             "://invalid-url",
			Headers:         nil,
			RequireApproval: false,
			ToolOverrides:   nil,
		},
	}

	if err := mgr.Connect(context.Background(), servers, slog.Default()); err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

// TestMCPManagerConnectRejectsBadSchemes ensures the SSE URL is validated
// at the scheme level before any connection is attempted: tools_config is
// admin-supplied and a malicious operator could otherwise point at file://,
// gopher://, or a protocol-relative URL.
func TestMCPManagerConnectRejectsBadSchemes(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		url  string
	}{
		{name: "file scheme", url: "file:///etc/passwd"},
		{name: "gopher scheme", url: "gopher://example.com/"},
		{name: "ftp scheme", url: "ftp://example.com/"},
		{name: "protocol-relative", url: "//evil.example.com/"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mgr := NewMCPManager()
			t.Cleanup(mgr.Close)

			servers := []MCPServerConfig{
				{
					URL:             tc.url,
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			}

			err := mgr.Connect(context.Background(), servers, slog.Default())
			if err == nil {
				t.Fatalf("expected error for %q, got nil", tc.url)
			}

			if !errors.Is(err, httpsafe.ErrInvalidScheme) &&
				!errors.Is(err, httpsafe.ErrInvalidURL) {
				t.Errorf("expected scheme/url validation error, got %v", err)
			}
		})
	}
}

// TestMCPManagerConnectRejectsPrivateIPs is the integration-level proof that
// the SSRF-safe HTTP client wired into the MCP manager refuses to dial
// private/loopback hosts. The unit-level coverage of the dialer and IP
// allowlist lives in internal/httpsafe.
func TestMCPManagerConnectRejectsPrivateIPs(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(nil)
	t.Cleanup(srv.Close)

	cases := []struct {
		name string
		url  string
	}{
		{name: "loopback test server", url: srv.URL},
		{name: "explicit loopback", url: "http://127.0.0.1:80"},
		{name: "AWS IMDS link-local", url: "http://169.254.169.254"},
		{name: "rfc1918 10.x", url: "http://10.0.0.1"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mgr := NewMCPManager()
			t.Cleanup(mgr.Close)

			servers := []MCPServerConfig{
				{
					URL:             tc.url,
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			}

			err := mgr.Connect(context.Background(), servers, slog.Default())
			if err == nil {
				t.Fatalf("expected SSRF rejection for %q, got nil error", tc.url)
			}

			var ssrfErr httpsafe.ErrPrivateIPAccessError
			if !errors.As(err, &ssrfErr) &&
				!strings.Contains(err.Error(), "private IP") {
				t.Errorf("expected ErrPrivateIPAccess, got %v", err)
			}
		})
	}
}

func TestMCPManagerClose(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		calls int
	}{
		{name: "single close", calls: 1},
		{name: "double close is idempotent", calls: 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mgr := NewMCPManager()
			for range tc.calls {
				mgr.Close()
			}

			if mgr.clients != nil {
				t.Error("expected nil clients after close")
			}

			if mgr.tools != nil {
				t.Error("expected nil tools after close")
			}

			if mgr.serverTools != nil {
				t.Error("expected nil serverTools after close")
			}
		})
	}
}

func TestMCPManagerServerToolsCopiesMap(t *testing.T) {
	t.Parallel()

	mgr := NewMCPManager()
	mgr.serverTools["http://example.com"] = []string{"tool1", "tool2"}

	want := map[string][]string{
		"http://example.com": {"tool1", "tool2"},
	}

	got := mgr.ServerTools()
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ServerTools() mismatch (-want +got):\n%s", diff)
	}

	got["http://other.com"] = []string{"tool3"}

	if len(mgr.serverTools) != 1 {
		t.Error("modifying returned map should not affect original")
	}
}

// TestMCPToolNameStableAndDistinct asserts that the per-server prefix gives
// (a) stable names for the same server+tool, (b) distinct names across
// different servers exposing the same tool, and (c) the documented
// "mcp__<8hex>__" prefix shape that downstream code relies on. Without these
// invariants a malicious MCP server could shadow a builtin like
// graphql_mutation, or two servers exposing "search" would collide in the
// registry.
func TestMCPToolNameStableAndDistinct(t *testing.T) {
	t.Parallel()

	const (
		serverA = "https://server-a.example/mcp"
		serverB = "https://server-b.example/mcp"
	)

	a1 := MCPToolName(serverA, "search")
	a2 := MCPToolName(serverA, "search")
	b := MCPToolName(serverB, "search")
	other := MCPToolName(serverA, "fetch")

	if a1 != a2 {
		t.Errorf("expected stable name across calls, got %q vs %q", a1, a2)
	}

	if a1 == b {
		t.Errorf("expected distinct names across servers, both got %q", a1)
	}

	if a1 == other {
		t.Errorf("expected distinct names across tool names, both got %q", a1)
	}

	for _, name := range []string{a1, b, other} {
		if !strings.HasPrefix(name, "mcp__") {
			t.Errorf("expected mcp__ prefix, got %q", name)
		}

		// Shape: "mcp__" + 8 hex chars + "__" + tool name.
		const fixedPrefix = len("mcp__") + 8 + len("__")
		if len(name) <= fixedPrefix {
			t.Errorf("expected tool name suffix after prefix, got %q", name)
		}
	}

	// Sanity: builtin names are not reachable through the namespacing helper.
	for _, builtin := range []string{
		"web_search", "web_fetch", "graphql_query", "graphql_mutation",
	} {
		if got := MCPToolName(serverA, builtin); got == builtin {
			t.Errorf("namespaced name collides with builtin %q", builtin)
		}
	}
}

var errListToolsForTest = errors.New("network is down")

// TestMCPManagerDiscoverTools covers the ListTools call site. The previous
// implementation swallowed errors and silently left the manager with a
// connected client but no entry in serverTools, so applyMCPApprovalConfig
// no-op'd and admin-supplied approval flags were dropped. The fix propagates
// the error so connectServer can tear the client down.
func TestMCPManagerDiscoverTools(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name            string
		listToolsResult *mcp.ListToolsResult
		listToolsErr    error
		wantErr         bool
		wantToolCount   int
		wantServerTools map[string][]string
	}{
		{
			name: "success populates tools and serverTools",
			listToolsResult: &mcp.ListToolsResult{
				PaginatedResult: mcp.PaginatedResult{NextCursor: ""},
				Tools: []mcp.Tool{
					{
						Name:        "search",
						Description: "search the web",
						InputSchema: mcp.ToolInputSchema{
							Type:       "object",
							Properties: map[string]any{"q": map[string]any{"type": "string"}},
							Required:   []string{"q"},
							Defs:       nil,
						},
						RawInputSchema: nil,
						OutputSchema:   mcp.ToolOutputSchema{},
						Annotations:    mcp.ToolAnnotation{},
						Meta:           nil,
					},
				},
			},
			listToolsErr:    nil,
			wantErr:         false,
			wantToolCount:   1,
			wantServerTools: map[string][]string{"https://example.com": {"search"}},
		},
		{
			name: "success with zero tools still records server",
			listToolsResult: &mcp.ListToolsResult{
				PaginatedResult: mcp.PaginatedResult{NextCursor: ""},
				Tools:           []mcp.Tool{},
			},
			listToolsErr:    nil,
			wantErr:         false,
			wantToolCount:   0,
			wantServerTools: map[string][]string{"https://example.com": {}},
		},
		{
			name:            "ListTools error is propagated",
			listToolsResult: nil,
			listToolsErr:    errListToolsForTest,
			wantErr:         true,
			wantToolCount:   0,
			wantServerTools: map[string][]string{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			client := mock.NewMockMCPClient(ctrl)
			client.EXPECT().
				ListTools(gomock.Any(), gomock.Any()).
				Return(tc.listToolsResult, tc.listToolsErr)

			mgr := NewMCPManager()

			err := mgr.discoverTools(
				context.Background(),
				client,
				"https://example.com",
				slog.Default(),
			)
			if (err != nil) != tc.wantErr {
				t.Fatalf("discoverTools() error = %v, wantErr = %v", err, tc.wantErr)
			}

			if got := len(mgr.tools); got != tc.wantToolCount {
				t.Errorf("tool count = %d, want %d", got, tc.wantToolCount)
			}

			if diff := cmp.Diff(tc.wantServerTools, mgr.serverTools); diff != "" {
				t.Errorf("serverTools mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// TestMCPManagerCloseLockedClosesAllClients pins the cleanup contract used by
// both Close() and Connect()'s mid-loop failure path: every client currently
// held must have Close() called, and in-memory state must be cleared.
func TestMCPManagerCloseLockedClosesAllClients(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		clientCount int
	}{
		{name: "no clients", clientCount: 0},
		{name: "single client", clientCount: 1},
		{name: "multiple clients", clientCount: 3},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			mgr := NewMCPManager()

			for range tc.clientCount {
				c := mock.NewMockMCPClient(ctrl)
				c.EXPECT().Close().Return(nil)
				mgr.clients = append(mgr.clients, c)
			}

			mgr.tools = append(mgr.tools, &MCPTool{
				name: "seeded",
				definition: provider.ToolDefinition{
					Name:        "",
					Description: "",
					Parameters:  nil,
				},
				client: nil,
			})
			mgr.serverTools["http://seeded"] = []string{"seeded"}

			mgr.Close()

			if mgr.clients != nil {
				t.Error("expected nil clients after close")
			}

			if mgr.tools != nil {
				t.Error("expected nil tools after close")
			}

			if mgr.serverTools != nil {
				t.Error("expected nil serverTools after close")
			}
		})
	}
}

// TestMCPManagerConnectCleansUpOnFailure simulates the "Nth server fails"
// scenario: pre-seed the manager with mock clients and tool state (as if
// earlier servers connected successfully), then call Connect with an input
// that will fail in connectServer. The fix guarantees Close() is called on
// every seeded client and state is fully cleared, so callers never observe
// a half-built manager with leaked SSE goroutines.
func TestMCPManagerConnectCleansUpOnFailure(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		servers []MCPServerConfig
	}{
		{
			name: "invalid scheme triggers cleanup",
			servers: []MCPServerConfig{
				{
					URL:             "file:///etc/passwd",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			},
		},
		{
			name: "malformed url triggers cleanup",
			servers: []MCPServerConfig{
				{
					URL:             "://invalid",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			mgr := NewMCPManager()

			seeded := make([]*mock.MockMCPClient, 2)
			for i := range seeded {
				c := mock.NewMockMCPClient(ctrl)
				c.EXPECT().Close().Return(nil)
				seeded[i] = c
				mgr.clients = append(mgr.clients, c)
			}

			mgr.tools = append(mgr.tools, &MCPTool{
				name: "from_earlier_server",
				definition: provider.ToolDefinition{
					Name:        "",
					Description: "",
					Parameters:  nil,
				},
				client: nil,
			})
			mgr.serverTools["http://earlier"] = []string{"from_earlier_server"}

			err := mgr.Connect(context.Background(), tc.servers, slog.Default())
			if err == nil {
				t.Fatal("expected Connect to fail")
			}

			if mgr.clients != nil {
				t.Errorf("expected nil clients after failed Connect, got %d", len(mgr.clients))
			}

			if mgr.tools != nil {
				t.Errorf("expected nil tools after failed Connect, got %d", len(mgr.tools))
			}

			if mgr.serverTools != nil {
				t.Errorf(
					"expected nil serverTools after failed Connect, got %d entries",
					len(mgr.serverTools),
				)
			}
		})
	}
}

func TestMCPManagerToolsAndServerTools(t *testing.T) {
	t.Parallel()

	mgr := NewMCPManager()

	mgr.tools = append(mgr.tools, &MCPTool{
		name: "discovered_tool",
		definition: provider.ToolDefinition{
			Name:        "discovered_tool",
			Description: "A discovered tool",
			Parameters:  map[string]any{},
		},
		client: nil,
	})
	mgr.serverTools["http://example.com"] = []string{"discovered_tool"}

	tools := mgr.Tools()
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}

	wantDef := provider.ToolDefinition{
		Name:        "discovered_tool",
		Description: "A discovered tool",
		Parameters:  map[string]any{},
	}
	if diff := cmp.Diff(wantDef, tools[0].Definition()); diff != "" {
		t.Errorf("tool definition mismatch (-want +got):\n%s", diff)
	}

	wantServerTools := map[string][]string{
		"http://example.com": {"discovered_tool"},
	}
	if diff := cmp.Diff(wantServerTools, mgr.ServerTools()); diff != "" {
		t.Errorf("ServerTools() mismatch (-want +got):\n%s", diff)
	}
}
