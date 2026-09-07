package provider

import (
	"context"
	"errors"

	"github.com/nhost/nhost/services/ai/hasura"
)

// ErrEmptyModel is returned when a provider is created with an empty model.
var ErrEmptyModel = errors.New("model must not be empty")

// ErrEmptyAPIKey is returned when a provider is created with an empty API key.
// We reject empty keys explicitly because some upstream SDKs (notably Google's
// genai client) silently fall back to ambient credentials, which can charge the
// wrong account or succeed in environments where the operator did not intend.
var ErrEmptyAPIKey = errors.New("apiKey must not be empty")

// Role constants for message roles.
const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
	RoleTool      = "tool"
)

// Stop reason constants.
const (
	StopReasonEndTurn   = "end_turn"
	StopReasonToolUse   = "tool_use"
	StopReasonMaxTokens = "max_tokens"
	StopReasonRefusal   = "refusal"
)

// Message represents a message in the conversation.
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolName   string     `json:"tool_name,omitempty"`
}

// ToolCall represents a tool call requested by the model.
type ToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// EventType represents the type of streaming event.
type EventType int

const (
	EventContentDelta EventType = iota
	EventToolUseStart
	EventToolUseDelta
	EventToolUseDone
	EventComplete
	EventError
)

// Event represents a streaming event from a provider.
type Event struct {
	Type       EventType
	Content    string
	ToolCall   *ToolCall
	Error      error
	StopReason string
}

// NewContentDeltaEvent creates a content delta event.
func NewContentDeltaEvent(content string) Event {
	return Event{
		Type: EventContentDelta, Content: content,
		ToolCall: nil, Error: nil, StopReason: "",
	}
}

// NewToolEvent creates a tool-related event.
func NewToolEvent(typ EventType, tc *ToolCall) Event {
	return Event{
		Type: typ, Content: "",
		ToolCall: tc, Error: nil, StopReason: "",
	}
}

// NewCompleteEvent creates a completion event.
func NewCompleteEvent(stopReason string) Event {
	return Event{
		Type: EventComplete, Content: "",
		ToolCall: nil, Error: nil, StopReason: stopReason,
	}
}

// NewErrorEvent creates an error event.
func NewErrorEvent(err error) Event {
	return Event{
		Type: EventError, Content: "",
		ToolCall: nil, Error: err, StopReason: "",
	}
}

// send delivers evt on ch, returning false (without delivering) if ctx is
// cancelled. Provider streaming goroutines must bail out of their loops when
// this returns false so the underlying HTTP body and goroutine are released
// promptly when the consumer has stopped draining (e.g. after an early-return
// error in the caller).
func send(ctx context.Context, ch chan<- Event, evt Event) bool {
	select {
	case ch <- evt:
		return true
	case <-ctx.Done():
		return false
	}
}

// ToolDefinition defines a tool that can be used by the model.
type ToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// Provider is the interface for LLM providers.
//
// StreamResponse returns a channel of streaming events. The implementation
// owns a background goroutine that closes the channel when streaming ends.
// Callers MUST cancel ctx when they stop consuming events; otherwise the
// goroutine may block on its next channel send and leak. Cancelling ctx is
// the only safe way to abort a stream early.
//
//go:generate mockgen -package mock -destination mock/provider.go . Provider
type Provider interface {
	StreamResponse(
		ctx context.Context,
		systemPrompt string,
		messages []Message,
		tools []ToolDefinition,
	) <-chan Event
}

// NewProvider creates a new provider instance based on the provider name.
func NewProvider( //nolint:ireturn,nolintlint
	ctx context.Context,
	providerName Name,
	apiKey, model string,
) (Provider, error) {
	if model == "" {
		return nil, ErrEmptyModel
	}

	if apiKey == "" {
		return nil, ErrEmptyAPIKey
	}

	switch providerName {
	case ProviderAnthropic:
		return NewAnthropic(apiKey, model), nil
	case ProviderOpenAI:
		return NewOpenAI(apiKey, model), nil
	case ProviderGoogle:
		return NewGoogle(ctx, apiKey, model)
	default:
		return nil, UnknownProviderError{Provider: providerName}
	}
}

// Name identifies a supported LLM provider.
type Name = hasura.AiAgentProvidersEnum

const (
	ProviderAnthropic Name = hasura.AiAgentProvidersEnumAnthropic
	ProviderOpenAI    Name = hasura.AiAgentProvidersEnumOpenai
	ProviderGoogle    Name = hasura.AiAgentProvidersEnumGoogle
)

// UnknownProviderError is returned when an unknown provider name is used.
type UnknownProviderError struct {
	Provider Name
}

func (e UnknownProviderError) Error() string {
	return "unknown provider: " + string(e.Provider)
}
