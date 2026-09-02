package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/responses"
)

const (
	openAIResponsesFunctionCallType = "function_call"
	openAIResponsesMaxRetries       = 2
)

var errOpenAIResponsesRequest = errors.New("responses provider request failed")

func newOpenAIResponsesConfiguration(
	baseURL string,
	headers map[string]string,
) (endpointConfiguration, error) {
	return newEndpointConfiguration(
		baseURL,
		headers,
		validateOpenAIResponsesURL,
		[]string{"x-stainless-"},
		nil,
	)
}

func validateOpenAIResponsesURL(baseURL string) error {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return fmt.Errorf("parsing Responses provider URL: %w", errInvalidProviderBaseURL)
	}

	pathWithoutTrailingSlash := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasSuffix(pathWithoutTrailingSlash, "/responses") {
		return fmt.Errorf("validating Responses provider URL: %w", errInvalidProviderBaseURL)
	}

	return nil
}

type openAIResponses struct {
	service responses.ResponseService
}

func newOpenAIResponses(configuration endpointConfiguration) *openAIResponses {
	headerNames := make([]string, 0, len(configuration.headers))
	for name := range configuration.headers {
		headerNames = append(headerNames, name)
	}

	slices.Sort(headerNames)

	options := []option.RequestOption{
		option.WithBaseURL(configuration.baseURL),
		option.WithHTTPClient(newNoRedirectHTTPClient()),
		option.WithMaxRetries(openAIResponsesMaxRetries),
	}
	options = slices.Grow(options, len(headerNames))

	for _, name := range headerNames {
		options = append(options, option.WithHeader(name, configuration.headers[name]))
	}

	return &openAIResponses{
		service: responses.NewResponseService(options...),
	}
}

func (o *openAIResponses) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	if err := request.validate(); err != nil {
		return requestErrorChannel(err)
	}

	ch := make(chan Event)

	go func() {
		defer close(ch)

		processOpenAIResponsesStream(ctx, ch, &o.service, request)
	}()

	return ch
}

type openAIResponsesProviderMetadata struct {
	ReasoningItems []json.RawMessage `json:"reasoning_items"`
}

func toOpenAIResponseInput(messages []Message) responses.ResponseInputParam {
	result := make(responses.ResponseInputParam, 0, len(messages))

	for _, message := range messages {
		switch message.Role {
		case RoleUser:
			result = append(result, responses.ResponseInputItemParamOfMessage(
				message.Content,
				responses.EasyInputMessageRoleUser,
			))
		case RoleAssistant:
			result = appendOpenAIResponsesReasoningItems(result, message.ToolCalls)

			if message.Content != "" || len(message.ToolCalls) == 0 {
				result = append(result, responses.ResponseInputItemParamOfMessage(
					message.Content,
					responses.EasyInputMessageRoleAssistant,
				))
			}

			for _, toolCall := range message.ToolCalls {
				result = append(result, responses.ResponseInputItemParamOfFunctionCall(
					toolCall.Arguments,
					toolCall.ID,
					toolCall.Name,
				))
			}
		case RoleTool:
			result = append(result, responses.ResponseInputItemParamOfFunctionCallOutput(
				message.ToolCallID,
				message.Content,
			))
		}
	}

	return result
}

func appendOpenAIResponsesReasoningItems(
	input responses.ResponseInputParam,
	toolCalls []ToolCall,
) responses.ResponseInputParam {
	for _, toolCall := range toolCalls {
		if len(toolCall.ProviderMetadata) == 0 {
			continue
		}

		var metadata openAIResponsesProviderMetadata
		if err := json.Unmarshal(toolCall.ProviderMetadata, &metadata); err != nil {
			continue
		}

		for _, rawItem := range metadata.ReasoningItems {
			var reasoningItem responses.ResponseReasoningItemParam
			if err := json.Unmarshal(
				rawItem,
				&reasoningItem,
			); err != nil ||
				reasoningItem.ID == "" {
				continue
			}

			input = append(input, responses.ResponseInputItemUnionParam{ //nolint:exhaustruct
				OfReasoning: &reasoningItem,
			})
		}

		return input
	}

	return input
}

func toOpenAIResponseTools(tools []ToolDefinition) []responses.ToolUnionParam {
	result := make([]responses.ToolUnionParam, 0, len(tools))

	for _, tool := range tools {
		responseTool := responses.ToolParamOfFunction(tool.Name, tool.Parameters, false)
		if tool.Description != "" {
			responseTool.OfFunction.Description = openai.String(tool.Description)
		}

		result = append(result, responseTool)
	}

	return result
}

func buildOpenAIResponseParams(request StreamRequest) responses.ResponseNewParams {
	params := responses.ResponseNewParams{ //nolint:exhaustruct
		Include: []responses.ResponseIncludable{
			responses.ResponseIncludableReasoningEncryptedContent,
		},
		Input: responses.ResponseNewParamsInputUnion{ //nolint:exhaustruct
			OfInputItemList: toOpenAIResponseInput(request.Messages),
		},
		Model: request.Model,
		Store: openai.Bool(false),
	}

	if request.SystemPrompt != "" {
		params.Instructions = openai.String(request.SystemPrompt)
	}

	if len(request.Tools) > 0 {
		params.Tools = toOpenAIResponseTools(request.Tools)
	}

	return params
}

type openAIResponsesToolCallState struct {
	toolCall  ToolCall
	started   bool
	finalized bool
}

type openAIResponsesStreamState struct {
	toolCalls      map[int64]*openAIResponsesToolCallState
	reasoningItems []json.RawMessage
	sawToolUse     bool
	sawRefusal     bool
}

func newOpenAIResponsesStreamState() *openAIResponsesStreamState {
	return &openAIResponsesStreamState{
		toolCalls:      make(map[int64]*openAIResponsesToolCallState),
		reasoningItems: nil,
		sawToolUse:     false,
		sawRefusal:     false,
	}
}

func processOpenAIResponsesStream(
	ctx context.Context,
	ch chan<- Event,
	service *responses.ResponseService,
	request StreamRequest,
) {
	var response *http.Response

	// openai-go appends per-request options to the service's Options slice.
	// Clone it so concurrent streams never share mutable backing storage.
	requestService := *service
	requestService.Options = slices.Clone(service.Options)

	stream := requestService.NewStreaming(
		ctx,
		buildOpenAIResponseParams(request),
		option.WithResponseInto(&response),
	)
	defer func() {
		if err := stream.Close(); err != nil {
			slog.WarnContext(
				ctx,
				"failed to close openai responses stream",
				slog.String("error", mapOpenAIResponsesError(err, response).Error()),
			)
		}
	}()

	state := newOpenAIResponsesStreamState()

	for stream.Next() {
		if ctx.Err() != nil {
			return
		}

		if !handleOpenAIResponsesEvent(ctx, ch, stream.Current(), state) {
			return
		}
	}

	streamErr := stream.Err()
	if streamErr != nil {
		send(ctx, ch, NewErrorEvent(mapOpenAIResponsesError(streamErr, response)))

		return
	}

	send(ctx, ch, NewErrorEvent(errOpenAIResponsesRequest))
}

func handleOpenAIResponsesEvent(
	ctx context.Context,
	ch chan<- Event,
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) bool {
	switch event.Type {
	case "response.output_text.delta":
		return send(ctx, ch, NewContentDeltaEvent(event.Delta.OfString))
	case "response.refusal.delta":
		state.sawRefusal = true

		return send(ctx, ch, NewContentDeltaEvent(event.Delta.OfString))
	case "response.output_item.added":
		return handleOpenAIResponsesToolCallAdded(ctx, ch, event, state)
	case "response.function_call_arguments.delta":
		return handleOpenAIResponsesToolCallDelta(ctx, ch, event, state)
	case "response.function_call_arguments.done":
		handleOpenAIResponsesToolCallArgumentsDone(event, state)

		return true
	case "response.output_item.done":
		if event.Item.Type == "reasoning" {
			rawItem := event.Item.RawJSON()
			if rawItem != "" {
				state.reasoningItems = append(
					state.reasoningItems,
					json.RawMessage(rawItem),
				)
			}

			return true
		}

		return handleOpenAIResponsesToolCallDone(ctx, ch, event, state)
	case "response.completed":
		if !flushOpenAIResponsesToolCalls(ctx, ch, state) {
			return false
		}

		send(ctx, ch, NewCompleteEvent(openAIResponsesStopReason(state)))

		return false
	case "response.incomplete":
		clear(state.toolCalls)

		stopReason := mapOpenAIResponsesIncompleteReason(
			event.Response.IncompleteDetails.Reason,
		)

		send(ctx, ch, NewCompleteEvent(stopReason))

		return false
	case "error", "response.failed":
		send(ctx, ch, NewErrorEvent(errOpenAIResponsesRequest))

		return false
	default:
		return true
	}
}

func handleOpenAIResponsesToolCallAdded(
	ctx context.Context,
	ch chan<- Event,
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) bool {
	if event.Item.Type != openAIResponsesFunctionCallType {
		return true
	}

	toolCallState := updateOpenAIResponsesToolCall(event, state)

	return startOpenAIResponsesToolCall(ctx, ch, toolCallState)
}

func handleOpenAIResponsesToolCallDelta(
	ctx context.Context,
	ch chan<- Event,
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) bool {
	toolCallState := responseToolCallState(state, event.OutputIndex)
	toolCallState.toolCall.Arguments += event.Delta.OfString

	if !toolCallState.started {
		return true
	}

	return sendOpenAIResponsesToolEvent(ctx, ch, EventToolUseDelta, toolCallState)
}

func handleOpenAIResponsesToolCallArgumentsDone(
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) {
	toolCallState := responseToolCallState(state, event.OutputIndex)
	toolCallState.toolCall.Arguments = event.Arguments
}

func handleOpenAIResponsesToolCallDone(
	ctx context.Context,
	ch chan<- Event,
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) bool {
	if event.Item.Type != openAIResponsesFunctionCallType {
		return true
	}

	toolCallState := updateOpenAIResponsesToolCall(event, state)

	toolCallState.finalized = event.Item.Status != "incomplete"
	if toolCallState.finalized {
		state.sawToolUse = true
	}

	return startOpenAIResponsesToolCall(ctx, ch, toolCallState)
}

func updateOpenAIResponsesToolCall(
	event responses.ResponseStreamEventUnion,
	state *openAIResponsesStreamState,
) *openAIResponsesToolCallState {
	toolCallState := responseToolCallState(state, event.OutputIndex)
	toolCallState.toolCall.ID = event.Item.CallID
	toolCallState.toolCall.Name = event.Item.Name
	toolCallState.toolCall.Arguments = event.Item.Arguments

	return toolCallState
}

func responseToolCallState(
	state *openAIResponsesStreamState,
	outputIndex int64,
) *openAIResponsesToolCallState {
	toolCallState, ok := state.toolCalls[outputIndex]
	if ok {
		return toolCallState
	}

	toolCallState = &openAIResponsesToolCallState{
		toolCall: ToolCall{
			ID: "", Name: "", Arguments: "", ProviderMetadata: nil,
		},
		started:   false,
		finalized: false,
	}
	state.toolCalls[outputIndex] = toolCallState

	return toolCallState
}

func startOpenAIResponsesToolCall(
	ctx context.Context,
	ch chan<- Event,
	state *openAIResponsesToolCallState,
) bool {
	if state.started {
		return true
	}

	state.started = true

	return sendOpenAIResponsesToolEvent(ctx, ch, EventToolUseStart, state)
}

func sendOpenAIResponsesToolEvent(
	ctx context.Context,
	ch chan<- Event,
	eventType EventType,
	state *openAIResponsesToolCallState,
) bool {
	toolCall := state.toolCall

	return send(ctx, ch, NewToolEvent(eventType, &toolCall))
}

func flushOpenAIResponsesToolCalls(
	ctx context.Context,
	ch chan<- Event,
	state *openAIResponsesStreamState,
) bool {
	outputIndexes := slices.Sorted(maps.Keys(state.toolCalls))
	for _, outputIndex := range outputIndexes {
		if !state.toolCalls[outputIndex].finalized {
			send(ctx, ch, NewErrorEvent(errOpenAIResponsesRequest))

			return false
		}
	}

	metadataAttached := false

	for _, outputIndex := range outputIndexes {
		toolCallState := state.toolCalls[outputIndex]
		if !metadataAttached && len(state.reasoningItems) > 0 {
			metadata, err := json.Marshal(openAIResponsesProviderMetadata{
				ReasoningItems: state.reasoningItems,
			})
			if err != nil {
				send(ctx, ch, NewErrorEvent(errOpenAIResponsesRequest))

				return false
			}

			toolCallState.toolCall.ProviderMetadata = metadata
			metadataAttached = true
		}

		if !startOpenAIResponsesToolCall(ctx, ch, toolCallState) {
			return false
		}

		if !sendOpenAIResponsesToolEvent(ctx, ch, EventToolUseDone, toolCallState) {
			return false
		}

		delete(state.toolCalls, outputIndex)
	}

	return true
}

func openAIResponsesStopReason(state *openAIResponsesStreamState) string {
	if state.sawToolUse {
		return StopReasonToolUse
	}

	if state.sawRefusal {
		return StopReasonRefusal
	}

	return StopReasonEndTurn
}

func mapOpenAIResponsesIncompleteReason(reason string) string {
	switch reason {
	case "max_output_tokens":
		return StopReasonMaxTokens
	case "content_filter":
		return StopReasonRefusal
	default:
		return StopReasonEndTurn
	}
}

func mapOpenAIResponsesError(_ error, response *http.Response) error {
	if response != nil && response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf(
			"%w: HTTP status %d",
			errOpenAIResponsesRequest,
			response.StatusCode,
		)
	}

	return errOpenAIResponsesRequest
}
