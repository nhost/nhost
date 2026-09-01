package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const (
	anthropicMessagesMaxRetries = 2
	anthropicWorkspaceIDHeader  = "anthropic-workspace-id"
	defaultMaxTokens            = 8192
)

var errAnthropicMessagesRequest = errors.New("anthropic messages provider request failed")

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

// AnthropicConfig contains the static configuration for an Anthropic client.
type AnthropicConfig struct {
	APIKey      string
	WorkspaceID string
}

// Anthropic implements the Provider interface for Anthropic's Claude.
type Anthropic struct {
	messages *anthropicMessages
}

// NewAnthropic creates a reusable Anthropic provider client. When WorkspaceID
// is set, requests are scoped using Anthropic's workspace header.
func NewAnthropic(config AnthropicConfig) (*Anthropic, error) {
	if config.APIKey == "" {
		return nil, ErrEmptyAPIKey
	}

	clientOptions := append(
		anthropic.DefaultClientOptions(),
		option.WithAPIKey(config.APIKey),
		option.WithHTTPClient(newNoRedirectHTTPClient()),
		option.WithMaxRetries(anthropicMessagesMaxRetries),
	)
	if config.WorkspaceID != "" {
		clientOptions = append(
			clientOptions,
			option.WithHeader(anthropicWorkspaceIDHeader, config.WorkspaceID),
		)
	}

	return &Anthropic{messages: newAnthropicMessagesWithOptions(clientOptions)}, nil
}

type anthropicMessages struct {
	messages anthropic.MessageService
}

func newAnthropicMessagesConfiguration(
	baseURL string,
	headers map[string]string,
) (endpointConfiguration, error) {
	configuration, err := newEndpointConfiguration(
		baseURL,
		headers,
		validateAnthropicMessagesURL,
		[]string{"x-stainless-"},
		nil,
	)
	if err != nil {
		return endpointConfiguration{}, fmt.Errorf(
			"configure Anthropic Messages endpoint: %w",
			err,
		)
	}

	return configuration, nil
}

func validateAnthropicMessagesURL(baseURL string) error {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return errInvalidProviderBaseURL
	}

	pathWithoutTrailingSlash := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasSuffix(pathWithoutTrailingSlash, "/messages") ||
		strings.HasSuffix(pathWithoutTrailingSlash, "/v1") {
		return errInvalidProviderBaseURL
	}

	return nil
}

func newAnthropicMessages(configuration endpointConfiguration) *anthropicMessages {
	headerNames := make([]string, 0, len(configuration.headers))
	for name := range configuration.headers {
		headerNames = append(headerNames, name)
	}

	slices.Sort(headerNames)

	options := []option.RequestOption{
		option.WithBaseURL(configuration.baseURL),
		option.WithHTTPClient(newNoRedirectHTTPClient()),
		option.WithMaxRetries(anthropicMessagesMaxRetries),
	}
	options = slices.Grow(options, len(headerNames))

	for _, name := range headerNames {
		options = append(options, option.WithHeader(name, configuration.headers[name]))
	}

	return newAnthropicMessagesWithOptions(options)
}

func newAnthropicMessagesWithOptions(options []option.RequestOption) *anthropicMessages {
	return &anthropicMessages{messages: anthropic.NewMessageService(options...)}
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
	request StreamRequest,
) <-chan Event {
	return a.messages.StreamResponse(ctx, request)
}

// StreamResponse streams a request through the configured Anthropic Messages
// endpoint.
func (a *anthropicMessages) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	if err := request.validate(); err != nil {
		return requestErrorChannel(err)
	}

	ch := make(chan Event)

	go func() {
		defer close(ch)

		a.processStream(ctx, ch, request)
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

func (a *anthropicMessages) processStream(
	ctx context.Context,
	ch chan<- Event,
	request StreamRequest,
) {
	params, err := buildAnthropicParams(
		request.Model,
		request.SystemPrompt,
		request.Messages,
		request.Tools,
	)
	if err != nil {
		send(ctx, ch, NewErrorEvent(err))

		return
	}

	var response *http.Response

	// The Anthropic SDK uses slices.Concat to combine shared service options
	// with request options, allocating fresh option storage for each stream.
	stream := a.messages.NewStreaming(
		ctx,
		params,
		option.WithResponseInto(&response),
	)
	defer func() {
		if err := stream.Close(); err != nil && ctx.Err() == nil {
			slog.WarnContext(
				ctx,
				"failed to close anthropic stream",
				slog.String("error", errAnthropicMessagesRequest.Error()),
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

	if err := stream.Err(); err != nil && ctx.Err() == nil {
		send(ctx, ch, NewErrorEvent(mapAnthropicMessagesError(response)))
	}
}

func mapAnthropicMessagesError(response *http.Response) error {
	if response != nil && response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf(
			"%w: HTTP status %d",
			errAnthropicMessagesRequest,
			response.StatusCode,
		)
	}

	return errAnthropicMessagesRequest
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
