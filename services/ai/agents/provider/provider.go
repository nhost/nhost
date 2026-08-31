package provider

import (
	"context"
	"errors"

	"github.com/nhost/nhost/services/ai/hasura"
)

// ErrEmptyModel is returned when a StreamRequest carries an empty Model.
// Providers deliver it as the only EventError on a closed stream channel because
// the model is selected per request rather than at provider construction.
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

// StreamRequest contains the request-scoped configuration and conversation
// passed to a provider. Provider credentials and client options belong in the
// provider-specific constructor instead.
type StreamRequest struct {
	Model        string
	SystemPrompt string
	Messages     []Message
	Tools        []ToolDefinition
}

// Validate checks whether the request can be sent to a provider.
func (r StreamRequest) Validate() error {
	if r.Model == "" {
		return ErrEmptyModel
	}

	return nil
}

func requestErrorChannel(err error) <-chan Event {
	ch := make(chan Event, 1)
	ch <- NewErrorEvent(err)

	close(ch)

	return ch
}

// Provider is the interface for LLM providers.
//
// StreamResponse returns a channel of streaming events. A valid request starts
// a background goroutine that closes the channel when streaming ends. A request
// that fails validation instead returns a closed channel containing exactly one
// EventError and starts no goroutine.
//
// Callers MUST cancel ctx when they stop consuming events from a valid request;
// otherwise the goroutine may block on its next channel send and leak. Cancelling
// ctx is the only safe way to abort a stream early.
//
//go:generate mockgen -package mock -destination mock/provider.go . Provider
type Provider interface {
	StreamResponse(ctx context.Context, request StreamRequest) <-chan Event
}

// Name identifies a supported LLM provider.
type Name = hasura.AiAgentProvidersEnum

const (
	ProviderAnthropic Name = hasura.AiAgentProvidersEnumAnthropic
	ProviderOpenAI    Name = hasura.AiAgentProvidersEnumOpenai
	ProviderGoogle    Name = hasura.AiAgentProvidersEnumGoogle
)

// Registry contains the configured provider clients keyed by provider name.
// Provider clients are created once at service startup and shared across
// requests.
type Registry map[Name]Provider
