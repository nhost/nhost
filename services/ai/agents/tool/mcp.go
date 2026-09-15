package tool

//go:generate mockgen -package mock -destination mock/mcp_client.go github.com/mark3labs/mcp-go/client MCPClient

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	mcpclient "github.com/mark3labs/mcp-go/client"
	mcptransport "github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
)

const (
	mcpConnectTimeout = 30 * time.Second
	mcpToolPrefix     = "mcp__"
	mcpServerIDLen    = 8
)

// MCPToolName returns the registry-facing name of an MCP tool: a stable,
// per-server prefix plus the server-supplied tool name. Namespacing is what
// stops a (malicious or careless) MCP server from shadowing a builtin like
// graphql_mutation, and stops two MCP servers exposing the same name from
// colliding in the registry's approval-flag map.
func MCPToolName(serverURL, name string) string {
	h := sha256.Sum256([]byte(serverURL))

	return mcpToolPrefix + hex.EncodeToString(h[:])[:mcpServerIDLen] + "__" + name
}

// MCPToolOverride holds per-tool overrides for an MCP server.
type MCPToolOverride struct {
	RequireApproval bool `json:"require_approval"`
}

// MCPServerConfig holds configuration for an MCP server.
//
// URL is the base URL of the MCP server; "/sse" is appended automatically by
// the client, so do not include it in the configured value.
type MCPServerConfig struct {
	URL             string                     `json:"url"`
	Headers         map[string]string          `json:"headers"`
	RequireApproval bool                       `json:"require_approval"`
	ToolOverrides   map[string]MCPToolOverride `json:"tool_overrides"`
}

// MCPTool implements the Tool interface for MCP server tools.
type MCPTool struct {
	name       string
	definition provider.ToolDefinition
	client     mcpclient.MCPClient
}

// Definition returns the tool definition.
func (m *MCPTool) Definition() provider.ToolDefinition {
	return m.definition
}

// Execute calls the MCP tool.
func (m *MCPTool) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	args := map[string]any{}
	if trimmed := strings.TrimSpace(arguments); trimmed != "" {
		if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
			return "", fmt.Errorf("failed to parse arguments: %w", err)
		}
	}

	logger.InfoContext(ctx, "calling MCP tool", slog.String("tool", m.name))

	request := mcp.CallToolRequest{} //nolint:exhaustruct
	request.Params.Name = m.name
	request.Params.Arguments = args

	result, err := m.client.CallTool(ctx, request)
	if err != nil {
		return "", fmt.Errorf("MCP tool call failed: %w", err)
	}

	var sb strings.Builder

	for _, content := range result.Content {
		if tc, ok := content.(mcp.TextContent); ok {
			sb.WriteString(tc.Text)
		}
	}

	if result.IsError {
		logger.WarnContext(
			ctx, "MCP tool returned error result",
			slog.String("tool", m.name),
		)
	}

	return sb.String(), nil
}

// MCPManager manages MCP client connections for a session.
type MCPManager struct {
	mu          sync.Mutex
	clients     []mcpclient.MCPClient
	tools       []Tool
	serverTools map[string][]string
}

// NewMCPManager creates a new MCP manager.
func NewMCPManager() *MCPManager {
	return &MCPManager{
		mu:          sync.Mutex{},
		clients:     make([]mcpclient.MCPClient, 0),
		tools:       make([]Tool, 0),
		serverTools: make(map[string][]string),
	}
}

// Connect connects to MCP servers and discovers tools. On any failure mid-loop
// the manager tears down already-connected clients so callers never observe a
// half-built state with leaked SSE goroutines.
func (m *MCPManager) Connect(
	ctx context.Context,
	servers []MCPServerConfig,
	logger *slog.Logger,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, server := range servers {
		if err := m.connectServer(ctx, server, logger); err != nil {
			m.closeLocked()

			return err
		}
	}

	return nil
}

func (m *MCPManager) connectServer(
	ctx context.Context,
	server MCPServerConfig,
	logger *slog.Logger,
) error {
	logger.InfoContext(
		ctx, "connecting to MCP server",
		slog.String("url", server.URL),
	)

	// Validate the URL up-front (http/https only, non-empty host) before we
	// hand it to the SSE client. The SSRF-safe HTTP client below blocks
	// dialing private IPs and DNS-rebinding attacks; this call covers the
	// scheme/format checks that DialContext alone cannot enforce.
	normalizedURL, err := httpsafe.NormalizeURL(server.URL)
	if err != nil {
		return fmt.Errorf("invalid MCP server URL %q: %w", server.URL, err)
	}

	// No request-level timeout: SSE streams are long-lived. The transport's
	// dial timeout still bounds connection establishment.
	httpClient := &http.Client{ //nolint:exhaustruct
		Transport: httpsafe.NewTransport(mcpConnectTimeout),
	}

	opts := []mcptransport.ClientOption{
		mcpclient.WithHTTPClient(httpClient),
	}
	if len(server.Headers) > 0 {
		opts = append(opts, mcpclient.WithHeaders(server.Headers))
	}

	sseURL, err := url.JoinPath(normalizedURL, "sse")
	if err != nil {
		return fmt.Errorf("failed to build SSE URL for %s: %w", server.URL, err)
	}

	client, err := mcpclient.NewSSEMCPClient(sseURL, opts...)
	if err != nil {
		return fmt.Errorf("failed to create MCP client for %s: %w", server.URL, err)
	}

	if err := client.Start(ctx); err != nil {
		_ = client.Close()

		return fmt.Errorf("failed to start MCP client for %s: %w", server.URL, err)
	}

	initCtx, cancel := context.WithTimeout(ctx, mcpConnectTimeout)
	defer cancel()

	_, err = client.Initialize(initCtx, mcp.InitializeRequest{}) //nolint:exhaustruct
	if err != nil {
		_ = client.Close()

		return fmt.Errorf("failed to initialize MCP server %s: %w", server.URL, err)
	}

	m.clients = append(m.clients, client)

	if err := m.discoverTools(ctx, client, server.URL, logger); err != nil {
		return err
	}

	return nil
}

func (m *MCPManager) discoverTools(
	ctx context.Context,
	client mcpclient.MCPClient,
	serverURL string,
	logger *slog.Logger,
) error {
	toolsResult, err := client.ListTools(ctx, mcp.ListToolsRequest{}) //nolint:exhaustruct
	if err != nil {
		return fmt.Errorf("failed to list MCP tools for %s: %w", serverURL, err)
	}

	toolNames := make([]string, 0, len(toolsResult.Tools))

	for _, t := range toolsResult.Tools {
		params := make(map[string]any)
		if t.InputSchema.Properties != nil {
			params["type"] = "object"
			params["properties"] = t.InputSchema.Properties

			if len(t.InputSchema.Required) > 0 {
				params["required"] = t.InputSchema.Required
			}
		}

		// Definition.Name (visible to the LLM and used as the registry key)
		// is namespaced per server. MCPTool.name keeps the server's original
		// name because that's what gets sent back over the wire in CallTool.
		m.tools = append(m.tools, &MCPTool{
			name: t.Name,
			definition: provider.ToolDefinition{
				Name:        MCPToolName(serverURL, t.Name),
				Description: t.Description,
				Parameters:  params,
			},
			client: client,
		})

		toolNames = append(toolNames, t.Name)
	}

	m.serverTools[serverURL] = toolNames

	logger.InfoContext(
		ctx, "connected to MCP server",
		slog.String("url", serverURL),
		slog.Int("tools", len(toolsResult.Tools)),
	)

	return nil
}

// Tools returns all discovered MCP tools.
func (m *MCPManager) Tools() []Tool {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.tools
}

// ServerTools returns a mapping of server URL to discovered tool names.
func (m *MCPManager) ServerTools() map[string][]string {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := make(map[string][]string, len(m.serverTools))
	maps.Copy(result, m.serverTools)

	return result
}

// Close closes all MCP client connections.
func (m *MCPManager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.closeLocked()
}

// closeLocked closes all clients and clears state. Caller must hold m.mu.
// Used by Close() and by Connect() to tear down partially-built state when a
// later server fails — keeping that path inside the lock avoids reacquiring
// it just to undo our own work.
func (m *MCPManager) closeLocked() {
	for _, client := range m.clients {
		_ = client.Close()
	}

	m.clients = nil
	m.tools = nil
	m.serverTools = nil
}
