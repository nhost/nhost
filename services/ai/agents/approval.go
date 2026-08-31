package agents

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool"
	"github.com/nhost/nhost/services/ai/hasura"
)

var (
	errMissingDecision = errors.New("missing decision for tool call")
	errUnknownDecision = errors.New("decision references unknown tool call")
)

type approveToolsRequest struct {
	Decisions []toolDecision `json:"decisions"`
}

type toolDecision struct {
	ToolCallID string `json:"tool_call_id"`
	Approved   bool   `json:"approved"`
}

// HandleApproveTools handles the tool approval endpoint.
func (s *Service) HandleApproveTools(c *gin.Context) {
	logger := slog.Default().With("component", "agents.approval")

	sessionID, req, ok := parseApprovalRequest(c)
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

	messages, pendingCalls, err := s.loadPendingApprovals(c, logger, sessionID, req.Decisions)
	if err != nil {
		return
	}

	p, ok := s.newProviderForAgent(c, logger, agent)
	if !ok {
		return
	}

	registry, mcpMgr := s.buildToolRegistry(c.Request.Context(), agent, logger, c.Request.Header)
	if mcpMgr != nil {
		defer mcpMgr.Close()
	}

	setSSEHeaders(c)

	writer := NewSSEWriter(c.Writer)

	s.resumeAfterApproval(
		c, logger, writer, p, agent, registry,
		messages, pendingCalls, req.Decisions, sessionID,
	)
}

func parseApprovalRequest(c *gin.Context) (string, approveToolsRequest, bool) {
	sessionID := c.Param("sessionID")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
		return "", approveToolsRequest{Decisions: nil}, false
	}

	var req approveToolsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return "", approveToolsRequest{Decisions: nil}, false
	}

	if len(req.Decisions) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decisions are required"})
		return "", approveToolsRequest{Decisions: nil}, false
	}

	return sessionID, req, true
}

func (s *Service) loadPendingApprovals(
	c *gin.Context,
	logger *slog.Logger,
	sessionID string,
	decisions []toolDecision,
) ([]provider.Message, []provider.ToolCall, error) {
	messages, err := s.loadMessages(c.Request.Context(), sessionID)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(), "failed to load messages",
			slog.String("error", err.Error()),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load messages"})

		return nil, nil, err
	}

	if !hasPendingApprovals(messages) {
		logger.WarnContext(c.Request.Context(), "no pending tool approvals")
		c.JSON(http.StatusBadRequest, gin.H{"error": "no pending tool approvals"})

		return nil, nil, errMissingDecision
	}

	pendingCalls := messages[len(messages)-1].ToolCalls

	if err := validateDecisions(pendingCalls, decisions); err != nil {
		logger.WarnContext(
			c.Request.Context(), "invalid tool decisions",
			slog.String("error", err.Error()),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

		return nil, nil, err
	}

	return messages, pendingCalls, nil
}

func (s *Service) resumeAfterApproval(
	c *gin.Context,
	logger *slog.Logger,
	writer EventWriter,
	p provider.Provider,
	agent *hasura.GetAgent_AiAgent,
	registry *tool.Registry,
	messages []provider.Message,
	pendingCalls []provider.ToolCall,
	decisions []toolDecision,
	sessionID string,
) {
	decisionMap := make(map[string]bool, len(decisions))
	for _, d := range decisions {
		decisionMap[d.ToolCallID] = d.Approved
	}

	toolResults := processDecisions(
		c, pendingCalls, decisionMap, registry, writer, logger,
	)

	var messagesToPersist []provider.Message

	messagesToPersist = append(messagesToPersist, toolResults...)

	allMessages := slices.Concat(messages, toolResults)

	// Detach the persistence context from the request: if the SSE client
	// disconnects mid-turn, tool results and any partial assistant output
	// already streamed to the wire still need to be recorded.
	persistCtx := context.WithoutCancel(c.Request.Context())

	result, err := RunAgentLoop(
		c.Request.Context(),
		p,
		agent.Instructions,
		allMessages,
		registry,
		writer,
		logger,
	)
	if err != nil {
		logger.ErrorContext(
			c.Request.Context(),
			"agent loop error after approval",
			slog.String("error", err.Error()),
		)

		// Order matters: tool results from the approval step first, then any
		// assistant/tool messages the resumed loop produced before failing.
		partial := slices.Concat(messagesToPersist, result.Messages)
		if persistErr := s.persistMessages(persistCtx, sessionID, partial); persistErr != nil {
			logger.ErrorContext(
				persistCtx,
				"failed to persist partial messages after agent loop error",
				slog.String("error", persistErr.Error()),
			)
		}

		_ = writer.WriteEvent("error", "internal error")
		writer.Flush()

		return
	}

	messagesToPersist = append(messagesToPersist, result.Messages...)

	s.completeLoop(persistCtx, logger, writer, registry, result, messagesToPersist, sessionID)
}

func processDecisions(
	c *gin.Context,
	pendingCalls []provider.ToolCall,
	decisionMap map[string]bool,
	registry *tool.Registry,
	writer EventWriter,
	logger *slog.Logger,
) []provider.Message {
	results := make([]provider.Message, 0, len(pendingCalls))

	for _, tc := range pendingCalls {
		if !decisionMap[tc.ID] {
			msg, err := writeToolResultSSE(writer, "tool_denied", tc, "Tool call denied by user")
			if err != nil {
				logger.ErrorContext(c.Request.Context(), "failed to write tool denied SSE event",
					slog.Any("error", err))
			}

			results = append(results, msg)

			continue
		}

		t, err := registry.Get(tc.Name)
		if err != nil {
			results = append(results, provider.Message{
				Role: provider.RoleTool, Content: "Tool not found: " + tc.Name,
				ToolCalls: nil, ToolCallID: tc.ID, ToolName: tc.Name,
			})

			continue
		}

		logger.InfoContext(c.Request.Context(), "executing approved tool",
			slog.String("tool", tc.Name))

		result, err := t.Execute(c.Request.Context(), tc.Arguments, logger)
		if err != nil {
			logger.ErrorContext(c.Request.Context(), "tool execution failed",
				slog.String("tool", tc.Name), slog.String("error", err.Error()))

			result = toolExecutionFailMsg
		}

		msg, err := writeToolResultSSE(writer, "tool_result", tc, result)
		if err != nil {
			logger.ErrorContext(c.Request.Context(), "failed to write tool result SSE event",
				slog.Any("error", err))
		}

		results = append(results, msg)
	}

	return results
}

func validateDecisions(
	pendingCalls []provider.ToolCall,
	decisions []toolDecision,
) error {
	pendingIDs := make(map[string]bool, len(pendingCalls))
	for _, tc := range pendingCalls {
		pendingIDs[tc.ID] = true
	}

	decisionIDs := make(map[string]bool, len(decisions))
	for _, d := range decisions {
		if !pendingIDs[d.ToolCallID] {
			return fmt.Errorf("%w: %s", errUnknownDecision, d.ToolCallID)
		}

		decisionIDs[d.ToolCallID] = true
	}

	for _, tc := range pendingCalls {
		if !decisionIDs[tc.ID] {
			return fmt.Errorf("%w: %s", errMissingDecision, tc.ID)
		}
	}

	return nil
}
