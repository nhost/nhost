package agents

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool"
	"github.com/nhost/nhost/services/ai/hasura"
)

// Sentinel errors for API key configuration.
var (
	ErrAnthropicKeyNotConfigured = errors.New("anthropic API key not configured")
	ErrOpenAIKeyNotConfigured    = errors.New("openai API key not configured")
	ErrGoogleKeyNotConfigured    = errors.New("google API key not configured")
)

var (
	errSessionNotFound = errors.New("session not found")
	errAgentNotFound   = errors.New("agent not found")
	errInvalidSSEEvent = errors.New("invalid SSE event name")
)

// SSEWriter implements EventWriter for SSE responses.
type SSEWriter struct {
	writer  gin.ResponseWriter
	flusher http.Flusher
}

// NewSSEWriter creates a new SSE writer.
func NewSSEWriter(w gin.ResponseWriter) *SSEWriter {
	flusher, _ := w.(http.Flusher)

	return &SSEWriter{
		writer:  w,
		flusher: flusher,
	}
}

// WriteEvent writes an SSE event. Newlines in data are escaped per the SSE
// spec: each line becomes its own "data:" field. The event name must not
// contain CR or LF, otherwise a caller could inject extra SSE frames.
func (s *SSEWriter) WriteEvent(event, data string) error {
	if strings.ContainsAny(event, "\r\n") {
		return fmt.Errorf("%w: %q", errInvalidSSEEvent, event)
	}

	data = strings.ReplaceAll(data, "\r\n", "\n")
	data = strings.ReplaceAll(data, "\r", "\n")
	data = strings.ReplaceAll(data, "\n", "\ndata: ")

	if _, err := fmt.Fprintf(s.writer, "event: %s\ndata: %s\n\n", event, data); err != nil {
		return fmt.Errorf("failed to write SSE event %s: %w", event, err)
	}

	return nil
}

// Flush flushes the response writer.
func (s *SSEWriter) Flush() {
	if s.flusher != nil {
		s.flusher.Flush()
	}
}

type sendMessageRequest struct {
	Message string `json:"message"`
}

// HandleStreamMessage handles the SSE streaming endpoint.
func (s *Service) HandleStreamMessage(c *gin.Context) {
	logger := slog.Default().With("component", "agents.sse")

	sessionID, message, ok := parseStreamRequest(c)
	if !ok {
		return
	}

	if err := s.authorizeRequest(c, sessionID); err != nil {
		handleAuthError(c, logger, err)
		return
	}

	release, locked := s.acquireSessionLockOrRespond(c, logger, sessionID)
	if !locked {
		return
	}
	defer release()

	agent, err := s.loadSessionAgent(c.Request.Context(), sessionID)
	if err != nil {
		handleLoadError(c, logger, err)
		return
	}

	p, ok := s.newProviderForAgent(c, logger, agent)
	if !ok {
		return
	}

	messages, err := s.loadMessages(c.Request.Context(), sessionID)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(), "failed to load messages",
			slog.String("session_id", sessionID), slog.String("error", err.Error()),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load messages"})

		return
	}

	if hasPendingApprovals(messages) {
		c.JSON(http.StatusConflict, gin.H{"error": "session has pending tool approvals"})
		return
	}

	userMsg := provider.Message{
		Role:       provider.RoleUser,
		Content:    message,
		ToolCalls:  nil,
		ToolCallID: "",
		ToolName:   "",
	}
	messages = append(messages, userMsg)

	if !s.persistUserMessageOrRespond(c, logger, sessionID, userMsg) {
		return
	}

	setSSEHeaders(c)

	s.streamAndPersist(c, logger, p, agent, messages, sessionID)
}

// persistUserMessageOrRespond persists the user's message before the agent loop
// starts, so it is always visible in history even if the provider stream errors
// or the client disconnects mid-turn. On failure, writes a JSON error response
// and returns false.
func (s *Service) persistUserMessageOrRespond(
	c *gin.Context,
	logger *slog.Logger,
	sessionID string,
	userMsg provider.Message,
) bool {
	err := s.persistMessages(c.Request.Context(), sessionID, []provider.Message{userMsg})
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(), "failed to persist user message",
			slog.String("session_id", sessionID), slog.String("error", err.Error()),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist message"})

		return false
	}

	return true
}

// newProviderForAgent resolves the API key and constructs a provider for the
// given agent. On failure it writes the response and returns false.
func (s *Service) newProviderForAgent( //nolint:ireturn,nolintlint
	c *gin.Context,
	logger *slog.Logger,
	agent *hasura.GetAgent_AiAgent,
) (provider.Provider, bool) {
	apiKey, err := s.getAPIKey(agent.Provider)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(), "failed to get API key",
			slog.String("provider", string(agent.Provider)), slog.String("error", err.Error()),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider not available"})

		return nil, false
	}

	newProvider := providerFactory(provider.NewProvider)
	if s.newProvider != nil {
		newProvider = s.newProvider
	}

	p, err := newProvider(c.Request.Context(), agent.Provider, apiKey, agent.Model)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(), "failed to create provider",
			slog.String("provider", string(agent.Provider)), slog.String("error", err.Error()),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider not available"})

		return nil, false
	}

	return p, true
}

func parseStreamRequest(c *gin.Context) (string, string, bool) {
	sid := c.Param("sessionID")
	if sid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
		return "", "", false
	}

	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return "", "", false
	}

	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message is required"})
		return "", "", false
	}

	return sid, req.Message, true
}

func (s *Service) loadSessionAgent(
	ctx context.Context,
	sessionID string,
) (*hasura.GetAgent_AiAgent, error) {
	sessionResp, err := s.hasura.GetAgentSession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to load session: %w", err)
	}

	if sessionResp.AiAgentSession == nil {
		return nil, errSessionNotFound
	}

	agentResp, err := s.hasura.GetAgent(ctx, sessionResp.AiAgentSession.AgentID)
	if err != nil {
		return nil, fmt.Errorf("failed to load agent: %w", err)
	}

	if agentResp.AiAgent == nil {
		return nil, errAgentNotFound
	}

	return agentResp.AiAgent, nil
}

func (s *Service) loadMessages(
	ctx context.Context,
	sessionID string,
) ([]provider.Message, error) {
	where := &hasura.AiAgentMessagesBoolExp{ //nolint:exhaustruct
		SessionID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
			Eq: &sessionID,
		},
	}

	msgsResp, err := s.hasura.GetAgentMessages(ctx, where)
	if err != nil {
		return nil, fmt.Errorf("failed to load messages: %w", err)
	}

	return convertHasuraMessages(msgsResp.AiAgentMessages)
}

func convertHasuraMessages(
	msgs []*hasura.GetAgentMessages_AiAgentMessages,
) ([]provider.Message, error) {
	messages := make([]provider.Message, 0, len(msgs))

	for _, m := range msgs {
		msg := provider.Message{
			Role:       m.Role,
			Content:    m.Content,
			ToolCalls:  nil,
			ToolCallID: "",
			ToolName:   "",
		}

		if len(m.ToolCalls) > 0 {
			var toolCalls []provider.ToolCall

			if err := json.Unmarshal(m.ToolCalls, &toolCalls); err != nil {
				return nil, fmt.Errorf("failed to unmarshal tool calls: %w", err)
			}

			msg.ToolCalls = toolCalls
		}

		if m.ToolCallID != nil {
			msg.ToolCallID = *m.ToolCallID
		}

		if m.ToolName != nil {
			msg.ToolName = *m.ToolName
		}

		messages = append(messages, msg)
	}

	return messages, nil
}

func (s *Service) streamAndPersist(
	c *gin.Context,
	logger *slog.Logger,
	p provider.Provider,
	agent *hasura.GetAgent_AiAgent,
	messages []provider.Message,
	sessionID string,
) {
	registry, mcpMgr := s.buildToolRegistry(c.Request.Context(), agent, logger, c.Request.Header)
	if mcpMgr != nil {
		defer mcpMgr.Close()
	}

	writer := NewSSEWriter(c.Writer)

	// Detach the persistence context from the request: if the SSE client
	// disconnects mid-turn, we still need to record assistant tokens and tool
	// results that were already streamed to the wire, otherwise history is
	// silently corrupted on the next request.
	persistCtx := context.WithoutCancel(c.Request.Context())

	result, err := RunAgentLoop(
		c.Request.Context(),
		p,
		agent.Instructions,
		messages,
		registry,
		writer,
		logger,
	)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(),
			"agent loop error",
			slog.String("error", err.Error()),
		)

		if len(result.Messages) > 0 {
			if perr := s.persistMessages(persistCtx, sessionID, result.Messages); perr != nil {
				logger.ErrorContext(
					persistCtx, "failed to persist partial messages",
					slog.String("error", perr.Error()),
				)
			}
		}

		_ = writer.WriteEvent("error", "internal error")
		writer.Flush()

		return
	}

	s.completeLoop(persistCtx, logger, writer, registry, result, result.Messages, sessionID)
}

func (s *Service) completeLoop(
	persistCtx context.Context,
	logger *slog.Logger,
	writer EventWriter,
	registry *tool.Registry,
	result LoopResult,
	messagesToPersist []provider.Message,
	sessionID string,
) {
	if err := s.persistMessages(persistCtx, sessionID, messagesToPersist); err != nil {
		logger.ErrorContext(
			persistCtx,
			"failed to persist messages",
			slog.String("error", err.Error()),
		)

		_ = writer.WriteEvent("error", "failed to persist messages")
		writer.Flush()

		return
	}

	if result.PendingCalls != nil {
		s.sendApprovalRequired(persistCtx, writer, registry, result.PendingCalls, logger)
		return
	}

	_ = writer.WriteEvent("done", "")
	writer.Flush()
}

func (s *Service) sendApprovalRequired(
	ctx context.Context,
	writer EventWriter,
	registry *tool.Registry,
	pendingCalls []provider.ToolCall,
	logger *slog.Logger,
) {
	type toolCallInfo struct {
		ID               string `json:"id"`
		Name             string `json:"name"`
		Arguments        string `json:"arguments"`
		RequiresApproval bool   `json:"requires_approval"`
	}

	calls := make([]toolCallInfo, 0, len(pendingCalls))

	for _, tc := range pendingCalls {
		calls = append(calls, toolCallInfo{
			ID:               tc.ID,
			Name:             tc.Name,
			Arguments:        tc.Arguments,
			RequiresApproval: registry.RequiresApproval(tc.Name),
		})
	}

	payload, err := json.Marshal(map[string]any{"tool_calls": calls})
	if err != nil {
		logger.ErrorContext(
			ctx, "failed to marshal approval payload",
			slog.String("error", err.Error()),
		)

		_ = writer.WriteEvent("error", "internal error")
		writer.Flush()

		return
	}

	_ = writer.WriteEvent("tool_approval_required", string(payload))
	writer.Flush()
}

func setSSEHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
}

func (s *Service) getAPIKey(providerName provider.Name) (string, error) {
	switch providerName {
	case provider.ProviderAnthropic:
		if s.providers.AnthropicKey == "" {
			return "", ErrAnthropicKeyNotConfigured
		}

		return s.providers.AnthropicKey, nil
	case provider.ProviderOpenAI:
		if s.providers.OpenAIKey == "" {
			return "", ErrOpenAIKeyNotConfigured
		}

		return s.providers.OpenAIKey, nil
	case provider.ProviderGoogle:
		if s.providers.GoogleKey == "" {
			return "", ErrGoogleKeyNotConfigured
		}

		return s.providers.GoogleKey, nil
	default:
		return "", provider.UnknownProviderError{Provider: providerName}
	}
}

func (s *Service) buildToolRegistry(
	ctx context.Context,
	agent *hasura.GetAgent_AiAgent,
	logger *slog.Logger,
	headers http.Header,
) (*tool.Registry, *tool.MCPManager) {
	registry := tool.NewRegistry()

	if len(agent.ToolsConfig) == 0 {
		return registry, nil
	}

	var config map[string]any
	if err := json.Unmarshal(agent.ToolsConfig, &config); err != nil {
		logger.WarnContext(
			ctx, "failed to parse tools config",
			slog.String("error", err.Error()),
		)

		return registry, nil
	}

	s.registerBuiltinTools(ctx, logger, registry, config, headers)

	mcpMgr := s.connectMCPServers(ctx, config, registry, logger)

	return registry, mcpMgr
}

// registerOrLog registers a tool, logging at warn level on duplicate names.
// Builtins are registered into an empty registry with unique names, so this
// only fires if the registry is reused or invariants drift.
func registerOrLog(
	ctx context.Context,
	logger *slog.Logger,
	registry *tool.Registry,
	t tool.Tool,
) {
	if err := registry.Register(t); err != nil {
		logger.WarnContext(
			ctx, "failed to register tool",
			slog.String("tool", t.Definition().Name),
			slog.String("error", err.Error()),
		)
	}
}

func (s *Service) registerBuiltinTools(
	ctx context.Context,
	logger *slog.Logger,
	registry *tool.Registry,
	config map[string]any,
	headers http.Header,
) {
	s.registerWebSearch(ctx, logger, registry, config)
	registerWebFetch(ctx, logger, registry, config)
	s.registerGraphQL(ctx, logger, registry, config, headers)
}

func (s *Service) registerWebSearch(
	ctx context.Context,
	logger *slog.Logger,
	registry *tool.Registry,
	config map[string]any,
) {
	wsConfig, ok := config["web_search"].(map[string]any)
	if !ok {
		return
	}

	searchProvider, _ := wsConfig["provider"].(string)

	var apiKey string

	switch searchProvider {
	case "brave":
		apiKey = s.providers.BraveKey
	case "tavily":
		apiKey = s.providers.TavilyKey
	}

	if apiKey == "" {
		return
	}

	registerOrLog(ctx, logger, registry, tool.NewWebSearch(tool.WebSearchConfig{
		Provider: searchProvider,
		APIKey:   apiKey,
	}))

	if ra, ok := wsConfig["require_approval"].(bool); ok && ra {
		registry.SetRequiresApproval("web_search")
	}
}

func registerWebFetch(
	ctx context.Context,
	logger *slog.Logger,
	registry *tool.Registry,
	config map[string]any,
) {
	wfConfig, ok := config["web_fetch"].(map[string]any)
	if !ok {
		return
	}

	registerOrLog(ctx, logger, registry, tool.NewWebFetch())

	if ra, ok := wfConfig["require_approval"].(bool); ok && ra {
		registry.SetRequiresApproval("web_fetch")
	}
}

func (s *Service) registerGraphQL(
	ctx context.Context,
	logger *slog.Logger,
	registry *tool.Registry,
	config map[string]any,
	headers http.Header,
) {
	gqlCfg, ok := config["graphql"].(map[string]any)
	if !ok {
		return
	}

	gqlConfig := tool.GraphQLConfig{
		URL:     s.graphqlURL,
		Headers: headers,
	}

	registerOrLog(ctx, logger, registry, tool.NewGraphQLGetSchema(gqlConfig))
	registerOrLog(ctx, logger, registry, tool.NewGraphQLQuery(gqlConfig))
	registerOrLog(ctx, logger, registry, tool.NewGraphQLMutation(gqlConfig))

	if ra, ok := gqlCfg["require_approval_queries"].(bool); ok && ra {
		registry.SetRequiresApproval("graphql_query")
	}

	if ra, ok := gqlCfg["require_approval_mutations"].(bool); ok && ra {
		registry.SetRequiresApproval("graphql_mutation")
	}
}

func (s *Service) connectMCPServers(
	ctx context.Context,
	config map[string]any,
	registry *tool.Registry,
	logger *slog.Logger,
) *tool.MCPManager {
	serversRaw, ok := config["mcp_servers"].([]any)
	if !ok || len(serversRaw) == 0 {
		return nil
	}

	raw, err := json.Marshal(serversRaw)
	if err != nil {
		logger.WarnContext(
			ctx, "failed to marshal mcp_servers config",
			slog.String("error", err.Error()),
		)

		return nil
	}

	var parsed []tool.MCPServerConfig
	if err := json.Unmarshal(raw, &parsed); err != nil {
		logger.WarnContext(
			ctx, "failed to parse mcp_servers config",
			slog.String("error", err.Error()),
		)

		return nil
	}

	servers := dedupeMCPServers(ctx, parsed, logger)
	resolveMCPHeaderSecrets(ctx, servers, logger)

	mcpMgr := tool.NewMCPManager()

	if err := mcpMgr.Connect(ctx, servers, logger); err != nil {
		logger.ErrorContext(
			ctx, "failed to connect to MCP servers",
			slog.String("error", err.Error()),
		)
		mcpMgr.Close()

		return nil
	}

	for _, t := range mcpMgr.Tools() {
		// MCP tool names are namespaced per server (mcp__<id>__<name>) so they
		// cannot shadow a builtin or collide across servers. A residual
		// duplicate (e.g. one server returning the same name twice) is logged
		// and dropped — fail-closed beats silent overwrite.
		if err := registry.Register(t); err != nil {
			logger.WarnContext(
				ctx, "skipping duplicate MCP tool",
				slog.String("tool", t.Definition().Name),
				slog.String("error", err.Error()),
			)
		}
	}

	applyMCPApprovalConfig(registry, mcpMgr.ServerTools(), servers)

	return mcpMgr
}

// resolveMCPHeaderSecrets resolves "env:..." references in each server's
// headers in place. Headers whose env reference is unset are dropped with a
// warning so a missing secret surfaces here instead of as an opaque MCP auth
// failure later.
func resolveMCPHeaderSecrets(
	ctx context.Context,
	servers []tool.MCPServerConfig,
	logger *slog.Logger,
) {
	for i, srv := range servers {
		for k, v := range srv.Headers {
			resolved, ok := resolveSecret(v)
			if !ok {
				logger.WarnContext(
					ctx,
					"MCP server header references unset secret env var; dropping header",
					slog.String("server", srv.URL),
					slog.String("header", k),
					slog.String("reference", v),
				)
				delete(servers[i].Headers, k)

				continue
			}

			servers[i].Headers[k] = resolved
		}
	}
}

// dedupeMCPServers drops MCP server entries with duplicate URLs (keeping the
// first occurrence) and logs a warning for each duplicate. Duplicates would
// otherwise open redundant connections and silently last-write-win in the
// approval-config and ServerTools maps.
func dedupeMCPServers(
	ctx context.Context,
	servers []tool.MCPServerConfig,
	logger *slog.Logger,
) []tool.MCPServerConfig {
	seen := make(map[string]struct{}, len(servers))
	out := make([]tool.MCPServerConfig, 0, len(servers))

	for _, srv := range servers {
		if _, dup := seen[srv.URL]; dup {
			logger.WarnContext(
				ctx, "duplicate MCP server URL",
				slog.String("url", srv.URL),
			)

			continue
		}

		seen[srv.URL] = struct{}{}
		out = append(out, srv)
	}

	return out
}

func applyMCPApprovalConfig(
	registry *tool.Registry,
	serverToolMap map[string][]string,
	servers []tool.MCPServerConfig,
) {
	serverByURL := make(map[string]tool.MCPServerConfig, len(servers))
	for _, srv := range servers {
		serverByURL[srv.URL] = srv
	}

	// serverToolMap returns the original tool names as advertised by each MCP
	// server, while the registry is keyed by the namespaced name. Look up
	// overrides by the original name (that's how operators configure them)
	// but always touch the registry under the namespaced name — otherwise an
	// MCP server's approval flag could clobber a builtin's flag.
	for serverURL, toolNames := range serverToolMap {
		srv, ok := serverByURL[serverURL]
		if !ok {
			continue
		}

		for _, toolName := range toolNames {
			registryName := tool.MCPToolName(serverURL, toolName)

			if override, hasOverride := srv.ToolOverrides[toolName]; hasOverride {
				if override.RequireApproval {
					registry.SetRequiresApproval(registryName)
				} else {
					registry.ClearRequiresApproval(registryName)
				}
			} else if srv.RequireApproval {
				registry.SetRequiresApproval(registryName)
			}
		}
	}
}

func (s *Service) persistMessages(
	ctx context.Context,
	sessionID string,
	messages []provider.Message,
) error {
	objects := make([]*hasura.AiAgentMessagesInsertInput, 0, len(messages))

	for _, msg := range messages {
		object := &hasura.AiAgentMessagesInsertInput{ //nolint:exhaustruct
			SessionID: &sessionID,
			Role:      &msg.Role,
			Content:   &msg.Content,
		}

		if len(msg.ToolCalls) > 0 {
			b, err := json.Marshal(msg.ToolCalls)
			if err != nil {
				return fmt.Errorf("failed to marshal tool calls: %w", err)
			}

			object.ToolCalls = b
		}

		if msg.ToolCallID != "" {
			object.ToolCallID = &msg.ToolCallID
		}

		if msg.ToolName != "" {
			object.ToolName = &msg.ToolName
		}

		objects = append(objects, object)
	}

	if _, err := s.hasura.InsertAgentMessages(ctx, objects); err != nil {
		return fmt.Errorf("failed to insert messages: %w", err)
	}

	return nil
}

func handleAuthError(c *gin.Context, logger *slog.Logger, err error) {
	status := http.StatusUnauthorized
	msg := "unauthorized"

	if errors.Is(err, errForbidden) {
		status = http.StatusForbidden
		msg = "forbidden"
	}

	logger.WarnContext(c.Request.Context(), msg, slog.String("error", err.Error()))
	c.JSON(status, gin.H{"error": msg})
}

func handleLoadError(c *gin.Context, logger *slog.Logger, err error) {
	switch {
	case errors.Is(err, errSessionNotFound):
		logger.WarnContext(
			c.Request.Context(), "session not found",
			slog.String("error", err.Error()),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
	case errors.Is(err, errAgentNotFound):
		logger.WarnContext(
			c.Request.Context(), "agent not found",
			slog.String("error", err.Error()),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
	default:
		logger.ErrorContext(
			c.Request.Context(), "failed to load session agent",
			slog.String("error", err.Error()),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	}
}

func hasPendingApprovals(messages []provider.Message) bool {
	if len(messages) == 0 {
		return false
	}

	last := messages[len(messages)-1]

	return last.Role == provider.RoleAssistant && len(last.ToolCalls) > 0
}
