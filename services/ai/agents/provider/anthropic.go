package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const defaultMaxTokens = 8192

// toStringSlice extracts a []string from an any that holds either a Go-literal
// []string (the common path today) or a []any of strings (the shape produced
// by JSON-decoding a tool definition, e.g., from a dynamic registry).
func toStringSlice(v any) ([]string, bool) {
	switch s := v.(type) {
	case []string:
		return s, true
	case []any:
		out := make([]string, 0, len(s))

		for _, e := range s {
			str, ok := e.(string)
			if !ok {
				return nil, false
			}

			out = append(out, str)
		}

		return out, true
	default:
		return nil, false
	}
}

// Anthropic implements the Provider interface for Anthropic's Claude.
type Anthropic struct {
	client anthropic.Client
	model  string
}

// NewAnthropic creates a new Anthropic provider.
func NewAnthropic(apiKey, model string) *Anthropic {
	return &Anthropic{
		client: anthropic.NewClient(option.WithAPIKey(apiKey)),
		model:  model,
	}
}

func toAnthropicMessages(messages []Message) ([]anthropic.MessageParam, error) {
	result := make([]anthropic.MessageParam, 0, len(messages))

	for _, msg := range messages {
		switch msg.Role {
		case RoleUser:
			result = append(result, anthropic.NewUserMessage(
				anthropic.NewTextBlock(msg.Content),
			))
		case RoleAssistant:
			blocks := make([]anthropic.ContentBlockParamUnion, 0)
			if msg.Content != "" {
				blocks = append(blocks, anthropic.NewTextBlock(msg.Content))
			}

			for _, tc := range msg.ToolCalls {
				var input any

				args := tc.Arguments
				if args == "" {
					args = "{}"
				}

				if err := json.Unmarshal([]byte(args), &input); err != nil {
					return nil, fmt.Errorf("unmarshal tool call %q arguments: %w", tc.Name, err)
				}

				blocks = append(blocks, anthropic.NewToolUseBlock(tc.ID, input, tc.Name))
			}

			result = append(result, anthropic.NewAssistantMessage(blocks...))
		case RoleTool:
			result = append(result, anthropic.NewUserMessage(
				anthropic.NewToolResultBlock(msg.ToolCallID, msg.Content, false),
			))
		}
	}

	return result, nil
}

func toAnthropicTools(tools []ToolDefinition) []anthropic.ToolUnionParam {
	result := make([]anthropic.ToolUnionParam, 0, len(tools))

	for _, t := range tools {
		inputSchema := anthropic.ToolInputSchemaParam{ //nolint:exhaustruct
			Properties: t.Parameters["properties"],
		}

		if required, ok := toStringSlice(t.Parameters["required"]); ok {
			inputSchema.Required = required
		}

		result = append(result, anthropic.ToolUnionParam{ //nolint:exhaustruct
			OfTool: &anthropic.ToolParam{ //nolint:exhaustruct
				InputSchema: inputSchema,
				Name:        t.Name,
				Description: anthropic.String(t.Description),
			},
		})
	}

	return result
}

// StreamResponse implements Provider.StreamResponse for Anthropic.
func (a *Anthropic) StreamResponse(
	ctx context.Context,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) <-chan Event {
	ch := make(chan Event)

	go func() {
		defer close(ch)

		a.processStream(ctx, ch, systemPrompt, messages, tools)
	}()

	return ch
}

func buildAnthropicParams(
	model string,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) (anthropic.MessageNewParams, error) {
	msgs, err := toAnthropicMessages(messages)
	if err != nil {
		return anthropic.MessageNewParams{}, err
	}

	params := anthropic.MessageNewParams{ //nolint:exhaustruct
		Model:     anthropic.Model(model),
		MaxTokens: defaultMaxTokens,
		Messages:  msgs,
	}

	if systemPrompt != "" {
		params.System = []anthropic.TextBlockParam{
			{Text: systemPrompt}, //nolint:exhaustruct
		}
	}

	if len(tools) > 0 {
		params.Tools = toAnthropicTools(tools)
	}

	return params, nil
}

func (a *Anthropic) processStream(
	ctx context.Context,
	ch chan<- Event,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) {
	params, err := buildAnthropicParams(a.model, systemPrompt, messages, tools)
	if err != nil {
		send(ctx, ch, NewErrorEvent(err))

		return
	}

	stream := a.client.Messages.NewStreaming(ctx, params)
	defer func() {
		if err := stream.Close(); err != nil {
			slog.WarnContext(
				ctx,
				"failed to close anthropic stream",
				slog.String("error", err.Error()),
			)
		}
	}()

	var currentToolCall *ToolCall

	for stream.Next() {
		if ctx.Err() != nil {
			return
		}

		var keepGoing bool

		currentToolCall, keepGoing = handleAnthropicStreamEvent(
			ctx, stream.Current(), ch, currentToolCall,
		)
		if !keepGoing {
			return
		}
	}

	if err := stream.Err(); err != nil {
		send(ctx, ch, NewErrorEvent(err))
	}
}

func handleAnthropicStreamEvent(
	ctx context.Context,
	event anthropic.MessageStreamEventUnion,
	ch chan<- Event,
	currentToolCall *ToolCall,
) (*ToolCall, bool) {
	switch e := event.AsAny().(type) {
	case anthropic.ContentBlockStartEvent:
		return handleAnthropicBlockStart(ctx, e, ch, currentToolCall)
	case anthropic.ContentBlockDeltaEvent:
		if !handleAnthropicDelta(ctx, e, ch, currentToolCall) {
			return currentToolCall, false
		}
	case anthropic.ContentBlockStopEvent:
		return handleAnthropicBlockStop(ctx, ch, currentToolCall)
	case anthropic.MessageDeltaEvent:
		if !handleAnthropicMessageDelta(ctx, e, ch) {
			return currentToolCall, false
		}
	}

	return currentToolCall, true
}

func handleAnthropicMessageDelta(
	ctx context.Context,
	e anthropic.MessageDeltaEvent,
	ch chan<- Event,
) bool {
	if e.Delta.StopReason == "" {
		return true
	}

	return send(ctx, ch, NewCompleteEvent(mapAnthropicStopReason(e.Delta.StopReason)))
}

func handleAnthropicBlockStart(
	ctx context.Context,
	e anthropic.ContentBlockStartEvent,
	ch chan<- Event,
	currentToolCall *ToolCall,
) (*ToolCall, bool) {
	if e.ContentBlock.Type != "tool_use" {
		return currentToolCall, true
	}

	block := e.ContentBlock.AsToolUse()
	currentToolCall = &ToolCall{
		ID: block.ID, Name: block.Name, Arguments: "",
	}

	if !send(ctx, ch, NewToolEvent(EventToolUseStart, currentToolCall)) {
		return currentToolCall, false
	}

	return currentToolCall, true
}

func handleAnthropicBlockStop(
	ctx context.Context,
	ch chan<- Event,
	currentToolCall *ToolCall,
) (*ToolCall, bool) {
	if currentToolCall == nil {
		return currentToolCall, true
	}

	if currentToolCall.Arguments == "" {
		currentToolCall.Arguments = "{}"
	}

	if !send(ctx, ch, NewToolEvent(EventToolUseDone, currentToolCall)) {
		return currentToolCall, false
	}

	return nil, true
}

func mapAnthropicStopReason(reason anthropic.StopReason) string {
	switch reason {
	case anthropic.StopReasonToolUse:
		return StopReasonToolUse
	case anthropic.StopReasonMaxTokens:
		return StopReasonMaxTokens
	case anthropic.StopReasonRefusal:
		return StopReasonRefusal
	case anthropic.StopReasonEndTurn,
		anthropic.StopReasonStopSequence,
		// pause_turn only occurs with server-side tools; handle distinctly if added.
		anthropic.StopReasonPauseTurn:
		return StopReasonEndTurn
	default:
		return StopReasonEndTurn
	}
}

func handleAnthropicDelta(
	ctx context.Context,
	e anthropic.ContentBlockDeltaEvent,
	ch chan<- Event,
	currentToolCall *ToolCall,
) bool {
	switch d := e.Delta.AsAny().(type) {
	case anthropic.TextDelta:
		return send(ctx, ch, NewContentDeltaEvent(d.Text))
	case anthropic.InputJSONDelta:
		if currentToolCall != nil {
			currentToolCall.Arguments += d.PartialJSON

			return send(ctx, ch, NewToolEvent(EventToolUseDelta, currentToolCall))
		}
	}

	return true
}
