package agents

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool"
)

const (
	maxIterations             = 25
	toolExecutionFailMsg      = "Tool execution failed"
	maxIterationsExceededMsg  = "tool execution skipped: agent loop iteration limit reached"
	maxIterationsExceededWarn = "max iterations exceeded"
)

var errUnknownProvider = errors.New("unknown provider error")

// EventWriter is the interface for writing SSE events.
//
//go:generate mockgen -package mock -destination mock/event_writer.go . EventWriter
type EventWriter interface {
	WriteEvent(event, data string) error
	Flush()
}

type streamResult struct {
	content    string
	toolCalls  []provider.ToolCall
	stopReason string
}

// LoopResult holds the result of an agent loop execution.
type LoopResult struct {
	Messages     []provider.Message
	PendingCalls []provider.ToolCall
}

// RunAgentLoop runs the streaming agent loop.
// It sends events through the writer and returns the new messages generated.
// If any tool call requires approval, PendingCalls is non-nil and the loop is paused.
func RunAgentLoop(
	ctx context.Context,
	p provider.Provider,
	systemPrompt string,
	messages []provider.Message,
	tools *tool.Registry,
	writer EventWriter,
	logger *slog.Logger,
) (LoopResult, error) {
	var newMessages []provider.Message

	toolDefs := tools.Definitions()
	maxIterReached := true

	for iteration := range maxIterations {
		logger.InfoContext(
			ctx, "agent loop iteration",
			slog.Int("iteration", iteration),
			slog.Int("messages", len(messages)),
		)

		allMessages := slices.Concat(messages, newMessages)

		// Per-iteration cancellation lets us release the provider goroutine
		// promptly when processStreamEvents returns early on error — without
		// it the goroutine would block on its next channel send forever.
		iterCtx, iterCancel := context.WithCancel(ctx)
		eventCh := p.StreamResponse(iterCtx, systemPrompt, allMessages, toolDefs)

		result, err := processStreamEvents(eventCh, writer)

		iterCancel()

		if err != nil {
			newMessages = appendSafePartialAssistantMessage(newMessages, result)

			return LoopResult{Messages: newMessages, PendingCalls: nil}, err
		}

		newMessages = append(newMessages, assistantMessageFromResult(result))

		if result.stopReason != provider.StopReasonToolUse || len(result.toolCalls) == 0 {
			maxIterReached = false
			break
		}

		if tools.AnyRequiresApproval(result.toolCalls) {
			return LoopResult{
				Messages:     newMessages,
				PendingCalls: result.toolCalls,
			}, nil
		}

		toolResults, err := executeToolCalls(ctx, result.toolCalls, tools, writer, logger)

		newMessages = append(newMessages, toolResults...)
		if err != nil {
			return LoopResult{Messages: newMessages, PendingCalls: nil}, err
		}
	}

	if maxIterReached {
		return finalizeMaxIterations(newMessages, writer)
	}

	return LoopResult{Messages: newMessages, PendingCalls: nil}, nil
}

func assistantMessageFromResult(result streamResult) provider.Message {
	return provider.Message{
		Role:       provider.RoleAssistant,
		Content:    result.content,
		ToolCalls:  result.toolCalls,
		ToolCallID: "",
		ToolName:   "",
	}
}

func appendSafePartialAssistantMessage(
	messages []provider.Message,
	result streamResult,
) []provider.Message {
	if result.content == "" {
		return messages
	}

	// Only text deltas are safe to persist after a stream error. A tool-call
	// assistant message is provider-valid only when the loop can pause for
	// approval or pair it with tool result messages, neither of which is true
	// once the provider stream has failed.
	return append(messages, provider.Message{
		Role:       provider.RoleAssistant,
		Content:    result.content,
		ToolCalls:  nil,
		ToolCallID: "",
		ToolName:   "",
	})
}

// finalizeMaxIterations handles the tail of an agent loop that exhausted
// maxIterations. If the last message is an assistant message with unmatched
// tool_calls (defensive — keeps message pairing valid for future refactors),
// it synthesizes tool_result messages so the next user POST does not see the
// session as trapped in pending-approvals state. Always emits an explicit
// error event so the client knows the iteration limit was reached.
func finalizeMaxIterations(
	newMessages []provider.Message,
	writer EventWriter,
) (LoopResult, error) {
	if len(newMessages) > 0 {
		last := newMessages[len(newMessages)-1]
		if last.Role == provider.RoleAssistant && len(last.ToolCalls) > 0 {
			for _, tc := range last.ToolCalls {
				msg, err := writeToolResultSSE(
					writer, "tool_result", tc, maxIterationsExceededMsg,
				)
				if err != nil {
					return LoopResult{Messages: newMessages, PendingCalls: nil}, err
				}

				newMessages = append(newMessages, msg)
			}
		}
	}

	if err := writeEventAndFlush(writer, "error", maxIterationsExceededWarn); err != nil {
		return LoopResult{Messages: newMessages, PendingCalls: nil}, err
	}

	return LoopResult{Messages: newMessages, PendingCalls: nil}, nil
}

func processStreamEvents(
	eventCh <-chan provider.Event,
	writer EventWriter,
) (streamResult, error) {
	var (
		contentBuilder strings.Builder
		toolCalls      []provider.ToolCall
		stopReason     string
	)

	for event := range eventCh {
		if err := handleStreamEvent(
			event, writer, &contentBuilder, &toolCalls, &stopReason,
		); err != nil {
			return streamResultFromState(&contentBuilder, toolCalls, stopReason), err
		}
	}

	return streamResultFromState(&contentBuilder, toolCalls, stopReason), nil
}

func streamResultFromState(
	contentBuilder *strings.Builder,
	toolCalls []provider.ToolCall,
	stopReason string,
) streamResult {
	return streamResult{
		content:    contentBuilder.String(),
		toolCalls:  toolCalls,
		stopReason: stopReason,
	}
}

func handleStreamEvent(
	event provider.Event,
	writer EventWriter,
	contentBuilder *strings.Builder,
	toolCalls *[]provider.ToolCall,
	stopReason *string,
) error {
	switch event.Type {
	case provider.EventContentDelta:
		if err := writeEventAndFlush(writer, "content_delta", event.Content); err != nil {
			return err
		}

		contentBuilder.WriteString(event.Content)

		return nil

	case provider.EventToolUseStart:
		if event.ToolCall != nil {
			return writeEventAndFlush(writer, "tool_use_start", event.ToolCall.Name)
		}

	case provider.EventToolUseDelta:
		// Intermediate delta events during tool argument streaming; no action needed.

	case provider.EventToolUseDone:
		if event.ToolCall != nil {
			*toolCalls = append(*toolCalls, *event.ToolCall)

			payload, err := json.Marshal(event.ToolCall)
			if err != nil {
				return fmt.Errorf("failed to marshal tool call: %w", err)
			}

			return writeEventAndFlush(writer, "tool_call", string(payload))
		}

	case provider.EventComplete:
		*stopReason = event.StopReason

		switch event.StopReason {
		case provider.StopReasonMaxTokens, provider.StopReasonRefusal:
			payload, err := json.Marshal(map[string]string{"reason": event.StopReason})
			if err != nil {
				return fmt.Errorf("failed to marshal stop_reason: %w", err)
			}

			return writeEventAndFlush(writer, "stop_reason", string(payload))
		}

	case provider.EventError:
		// The caller emits the single terminal error event for every loop failure.
		if event.Error != nil {
			return event.Error
		}

		return errUnknownProvider
	}

	return nil
}

func writeEventAndFlush(writer EventWriter, event, data string) error {
	if err := writer.WriteEvent(event, data); err != nil {
		return fmt.Errorf("failed to write %s: %w", event, err)
	}

	writer.Flush()

	return nil
}

func writeToolResultSSE(
	writer EventWriter,
	event string,
	tc provider.ToolCall,
	content string,
) (provider.Message, error) {
	msg := provider.Message{
		Role:       provider.RoleTool,
		Content:    content,
		ToolCalls:  nil,
		ToolCallID: tc.ID,
		ToolName:   tc.Name,
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		return msg, fmt.Errorf("failed to marshal %s: %w", event, err)
	}

	if err := writeEventAndFlush(writer, event, string(payload)); err != nil {
		return msg, fmt.Errorf("failed to write %s: %w", event, err)
	}

	return msg, nil
}

func executeToolCalls(
	ctx context.Context,
	toolCalls []provider.ToolCall,
	tools *tool.Registry,
	writer EventWriter,
	logger *slog.Logger,
) ([]provider.Message, error) {
	var results []provider.Message

	for _, tc := range toolCalls {
		t, err := tools.Get(tc.Name)
		if err != nil {
			results = append(results, provider.Message{
				Role:       provider.RoleTool,
				Content:    "Tool not found: " + tc.Name,
				ToolCalls:  nil,
				ToolCallID: tc.ID,
				ToolName:   tc.Name,
			})

			continue
		}

		logger.InfoContext(
			ctx, "executing tool",
			slog.String("tool", tc.Name),
		)

		result, err := t.Execute(ctx, tc.Arguments, logger)
		if err != nil {
			logger.ErrorContext(
				ctx, "tool execution failed",
				slog.String("tool", tc.Name),
				slog.String("error", err.Error()),
			)

			result = toolExecutionFailMsg
		}

		msg, err := writeToolResultSSE(writer, "tool_result", tc, result)

		results = append(results, msg)
		if err != nil {
			return results, err
		}
	}

	return results, nil
}
