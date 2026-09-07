package provider

import (
	"context"
	"log/slog"
	"maps"
	"slices"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// OpenAI implements the Provider interface for OpenAI.
type OpenAI struct {
	client openai.Client
	model  string
}

// NewOpenAI creates a new OpenAI provider.
func NewOpenAI(apiKey, model string) *OpenAI {
	return &OpenAI{
		client: openai.NewClient(option.WithAPIKey(apiKey)),
		model:  model,
	}
}

func toOpenAIMessages(
	systemPrompt string,
	messages []Message,
) []openai.ChatCompletionMessageParamUnion {
	result := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages)+1)

	if systemPrompt != "" {
		result = append(result, openai.SystemMessage(systemPrompt))
	}

	for _, msg := range messages {
		switch msg.Role {
		case RoleUser:
			result = append(result, openai.UserMessage(msg.Content))
		case RoleAssistant:
			if len(msg.ToolCalls) > 0 {
				toolCalls := make(
					[]openai.ChatCompletionMessageToolCallParam,
					0,
					len(msg.ToolCalls),
				)
				for _, tc := range msg.ToolCalls {
					toolCalls = append(
						toolCalls,
						openai.ChatCompletionMessageToolCallParam{ //nolint:exhaustruct
							ID: tc.ID,
							Function: openai.ChatCompletionMessageToolCallFunctionParam{
								Name:      tc.Name,
								Arguments: tc.Arguments,
							},
						},
					)
				}

				result = append(result, openai.ChatCompletionMessageParamUnion{ //nolint:exhaustruct
					OfAssistant: &openai.ChatCompletionAssistantMessageParam{ //nolint:exhaustruct
						Content: openai.ChatCompletionAssistantMessageParamContentUnion{ //nolint:exhaustruct
							OfString: openai.String(msg.Content),
						},
						ToolCalls: toolCalls,
					},
				})
			} else {
				result = append(result, openai.AssistantMessage(msg.Content))
			}
		case RoleTool:
			result = append(result, openai.ToolMessage(msg.Content, msg.ToolCallID))
		}
	}

	return result
}

func toOpenAITools(tools []ToolDefinition) []openai.ChatCompletionToolParam {
	result := make([]openai.ChatCompletionToolParam, 0, len(tools))

	for _, t := range tools {
		result = append(result, openai.ChatCompletionToolParam{ //nolint:exhaustruct
			Function: openai.FunctionDefinitionParam{ //nolint:exhaustruct
				Name:        t.Name,
				Description: openai.String(t.Description),
				Parameters:  openai.FunctionParameters(t.Parameters),
			},
		})
	}

	return result
}

// StreamResponse implements Provider.StreamResponse for OpenAI.
func (o *OpenAI) StreamResponse(
	ctx context.Context,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) <-chan Event {
	ch := make(chan Event)

	go func() {
		defer close(ch)

		o.processStream(ctx, ch, systemPrompt, messages, tools)
	}()

	return ch
}

func mapOpenAIFinishReason(reason string) string {
	switch reason {
	case "tool_calls", "function_call":
		return StopReasonToolUse
	case "length":
		return StopReasonMaxTokens
	case "content_filter":
		return StopReasonRefusal
	case "stop":
		return StopReasonEndTurn
	default:
		return StopReasonEndTurn
	}
}

func buildOpenAIParams(
	model string,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) openai.ChatCompletionNewParams {
	params := openai.ChatCompletionNewParams{ //nolint:exhaustruct
		Model:    model,
		Messages: toOpenAIMessages(systemPrompt, messages),
	}

	if len(tools) > 0 {
		params.Tools = toOpenAITools(tools)
	}

	return params
}

func (o *OpenAI) processStream(
	ctx context.Context,
	ch chan<- Event,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) {
	stream := o.client.Chat.Completions.NewStreaming(
		ctx,
		buildOpenAIParams(o.model, systemPrompt, messages, tools),
	)
	defer func() {
		if err := stream.Close(); err != nil {
			slog.WarnContext(
				ctx,
				"failed to close openai stream",
				slog.String("error", err.Error()),
			)
		}
	}()

	toolCalls := make(map[int]*ToolCall)

	for stream.Next() {
		if ctx.Err() != nil {
			return
		}

		if !handleOpenAIChunk(ctx, ch, stream.Current(), toolCalls) {
			return
		}
	}

	streamErr := stream.Err()
	hadPendingToolCalls := len(toolCalls) > 0

	if hadPendingToolCalls && !flushOpenAIToolCalls(ctx, ch, toolCalls) {
		return
	}

	if streamErr != nil {
		send(ctx, ch, NewErrorEvent(streamErr))

		return
	}

	if hadPendingToolCalls {
		send(ctx, ch, NewCompleteEvent(StopReasonToolUse))
	}
}

func flushOpenAIToolCalls(
	ctx context.Context,
	ch chan<- Event,
	toolCalls map[int]*ToolCall,
) bool {
	for _, k := range slices.Sorted(maps.Keys(toolCalls)) {
		if !send(ctx, ch, NewToolEvent(EventToolUseDone, toolCalls[k])) {
			return false
		}
	}

	clear(toolCalls)

	return true
}

func handleOpenAIChunk(
	ctx context.Context,
	ch chan<- Event,
	chunk openai.ChatCompletionChunk,
	toolCalls map[int]*ToolCall,
) bool {
	for _, choice := range chunk.Choices {
		if choice.Index != 0 {
			continue
		}

		if !handleOpenAIChoice(ctx, ch, choice, toolCalls) {
			return false
		}
	}

	return true
}

func handleOpenAIChoice(
	ctx context.Context,
	ch chan<- Event,
	choice openai.ChatCompletionChunkChoice,
	toolCalls map[int]*ToolCall,
) bool {
	if choice.Delta.Content != "" {
		if !send(ctx, ch, NewContentDeltaEvent(choice.Delta.Content)) {
			return false
		}
	}

	for _, tc := range choice.Delta.ToolCalls {
		if !handleOpenAIToolCallDelta(ctx, ch, tc, toolCalls) {
			return false
		}
	}

	if choice.FinishReason == "" {
		return true
	}

	if !flushOpenAIToolCalls(ctx, ch, toolCalls) {
		return false
	}

	return send(ctx, ch, NewCompleteEvent(mapOpenAIFinishReason(choice.FinishReason)))
}

func handleOpenAIToolCallDelta(
	ctx context.Context,
	ch chan<- Event,
	tc openai.ChatCompletionChunkChoiceDeltaToolCall,
	toolCalls map[int]*ToolCall,
) bool {
	existing, ok := toolCalls[int(tc.Index)]
	if !ok {
		existing = &ToolCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: "",
		}

		toolCalls[int(tc.Index)] = existing
		if !send(ctx, ch, NewToolEvent(EventToolUseStart, existing)) {
			return false
		}
	}

	if existing.ID == "" && tc.ID != "" {
		existing.ID = tc.ID
	}

	if existing.Name == "" && tc.Function.Name != "" {
		existing.Name = tc.Function.Name
	}

	existing.Arguments += tc.Function.Arguments

	return send(ctx, ch, NewToolEvent(EventToolUseDelta, existing))
}
