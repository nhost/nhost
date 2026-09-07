package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"google.golang.org/genai"
)

// Google implements the Provider interface for Google Gemini.
type Google struct {
	client *genai.Client
	model  string
}

// NewGoogle creates a new Google Gemini provider. It rejects empty apiKey to
// prevent the underlying SDK from silently falling back to ambient credentials
// (GOOGLE_API_KEY / GEMINI_API_KEY / ADC), and constructs the client once so
// it can be reused across requests. ctx is forwarded to genai.NewClient so
// that any credential/init work the SDK performs is cancellable by the caller.
func NewGoogle(ctx context.Context, apiKey, model string) (*Google, error) {
	if apiKey == "" {
		return nil, ErrEmptyAPIKey
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{ //nolint:exhaustruct
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Google client: %w", err)
	}

	return &Google{client: client, model: model}, nil
}

func toGeminiContents(
	ctx context.Context,
	messages []Message,
) ([]*genai.Content, error) {
	result := make([]*genai.Content, 0, len(messages))

	for _, msg := range messages {
		switch msg.Role {
		case RoleUser:
			result = append(result, genai.NewContentFromText(msg.Content, genai.RoleUser))
		case RoleAssistant:
			content, err := assistantMessageToContent(msg)
			if err != nil {
				return nil, err
			}

			result = append(result, content)
		case RoleTool:
			result = append(result, toolMessageToContent(ctx, msg))
		}
	}

	return result, nil
}

func assistantMessageToContent(msg Message) (*genai.Content, error) {
	parts := make([]*genai.Part, 0)
	if msg.Content != "" {
		parts = append(parts, genai.NewPartFromText(msg.Content))
	}

	for _, tc := range msg.ToolCalls {
		args := map[string]any{}

		if tc.Arguments != "" {
			if err := json.Unmarshal([]byte(tc.Arguments), &args); err != nil {
				return nil, fmt.Errorf("unmarshal tool call %q arguments: %w", tc.Name, err)
			}
		}

		parts = append(parts, &genai.Part{ //nolint:exhaustruct
			FunctionCall: &genai.FunctionCall{ //nolint:exhaustruct
				ID:   tc.ID,
				Name: tc.Name,
				Args: args,
			},
		})
	}

	return &genai.Content{
		Role:  genai.RoleModel,
		Parts: parts,
	}, nil
}

func toolMessageToContent(ctx context.Context, msg Message) *genai.Content {
	var resp map[string]any

	if err := json.Unmarshal([]byte(msg.Content), &resp); err != nil {
		slog.WarnContext(
			ctx,
			"failed to unmarshal tool response content",
			"tool", msg.ToolName, "error", err,
		)
	}

	if resp == nil {
		resp = map[string]any{"result": msg.Content}
	}

	return &genai.Content{
		Role: genai.RoleUser,
		Parts: []*genai.Part{
			{
				FunctionResponse: &genai.FunctionResponse{ //nolint:exhaustruct
					ID:       msg.ToolCallID,
					Name:     msg.ToolName,
					Response: resp,
				},
			},
		},
	}
}

// toGeminiToolSchema passes tool parameters through the SDK's raw JSON Schema
// path. Tool definitions already use lowercase JSON-Schema type values, while
// genai.Schema requires uppercase enum values on its Parameters path.
func toGeminiToolSchema(tools []ToolDefinition) []*genai.FunctionDeclaration {
	declarations := make([]*genai.FunctionDeclaration, 0, len(tools))

	for _, t := range tools {
		declarations = append(declarations, &genai.FunctionDeclaration{ //nolint:exhaustruct
			Name:                 t.Name,
			Description:          t.Description,
			ParametersJsonSchema: geminiParametersJSONSchema(t.Parameters),
		})
	}

	return declarations
}

func geminiParametersJSONSchema(params map[string]any) map[string]any {
	if len(params) == 0 {
		return map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		}
	}

	return params
}

func toGeminiTools(tools []ToolDefinition) []*genai.Tool {
	if len(tools) == 0 {
		return nil
	}

	return []*genai.Tool{{FunctionDeclarations: toGeminiToolSchema(tools)}}
}

// StreamResponse implements Provider.StreamResponse for Google Gemini.
func (g *Google) StreamResponse(
	ctx context.Context,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) <-chan Event {
	ch := make(chan Event)

	go func() {
		defer close(ch)

		g.processStream(ctx, ch, systemPrompt, messages, tools)
	}()

	return ch
}

func (g *Google) processStream(
	ctx context.Context,
	ch chan<- Event,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) {
	config := &genai.GenerateContentConfig{} //nolint:exhaustruct
	if systemPrompt != "" {
		config.SystemInstruction = genai.NewContentFromText(systemPrompt, genai.RoleUser)
	}

	gt := toGeminiTools(tools)
	if len(gt) > 0 {
		config.Tools = gt
	}

	contents, err := toGeminiContents(ctx, messages)
	if err != nil {
		send(ctx, ch, NewErrorEvent(fmt.Errorf("failed to convert messages: %w", err)))
		return
	}

	stream := &googleStream{hasToolCalls: false}

	for resp, err := range g.client.Models.GenerateContentStream(ctx, g.model, contents, config) {
		if ctx.Err() != nil {
			return
		}

		if err != nil {
			send(ctx, ch, NewErrorEvent(err))
			return
		}

		if !stream.processCandidates(ctx, ch, resp) {
			return
		}
	}
}

// googleStream holds the per-StreamResponse state for a Google Gemini stream.
// hasToolCalls must persist across chunks because Gemini does not guarantee
// that function_call parts and the FinishReason arrive in the same chunk —
// resetting per-chunk would let a STOP-only trailing chunk emit
// StopReasonEndTurn and silently drop tool calls in the agent loop.
type googleStream struct {
	hasToolCalls bool
}

func (s *googleStream) processCandidates(
	ctx context.Context,
	ch chan<- Event,
	resp *genai.GenerateContentResponse,
) bool {
	for _, candidate := range resp.Candidates {
		if candidate.Content == nil {
			continue
		}

		for _, part := range candidate.Content.Parts {
			if !s.processPart(ctx, ch, part) {
				return false
			}
		}
	}

	if isGeminiStreamComplete(resp) {
		stopReason := s.terminalStopReason(resp.Candidates[0].FinishReason)
		if !send(ctx, ch, NewCompleteEvent(stopReason)) {
			return false
		}
	}

	return true
}

// terminalStopReason picks the StopReason for a final Gemini chunk. Tool-use
// only wins when the model both emitted tool calls and finished cleanly (STOP);
// any other finish reason (token cap, safety filter, recitation, etc.) takes
// precedence so the caller can distinguish a truncated/blocked turn from a
// clean end_turn.
func (s *googleStream) terminalStopReason(fr genai.FinishReason) string {
	mapped := mapGeminiFinishReason(fr)
	if s.hasToolCalls && mapped == StopReasonEndTurn {
		return StopReasonToolUse
	}

	return mapped
}

// mapGeminiFinishReason converts a Gemini FinishReason to the cross-provider
// StopReason vocabulary so safety / token-limit terminations are surfaced
// distinctly instead of collapsing to end_turn.
func mapGeminiFinishReason(fr genai.FinishReason) string {
	switch fr {
	case genai.FinishReasonMaxTokens:
		return StopReasonMaxTokens
	case genai.FinishReasonSafety,
		genai.FinishReasonProhibitedContent,
		genai.FinishReasonBlocklist,
		genai.FinishReasonSPII,
		genai.FinishReasonRecitation:
		return StopReasonRefusal
	case genai.FinishReasonUnspecified,
		genai.FinishReasonStop,
		genai.FinishReasonLanguage,
		genai.FinishReasonOther,
		genai.FinishReasonMalformedFunctionCall,
		genai.FinishReasonImageSafety,
		genai.FinishReasonUnexpectedToolCall,
		genai.FinishReasonImageProhibitedContent,
		genai.FinishReasonNoImage,
		genai.FinishReasonImageRecitation,
		genai.FinishReasonImageOther:
		return StopReasonEndTurn
	default:
		return StopReasonEndTurn
	}
}

func (s *googleStream) processPart(
	ctx context.Context,
	ch chan<- Event,
	part *genai.Part,
) bool {
	if part.Text != "" {
		if !send(ctx, ch, NewContentDeltaEvent(part.Text)) {
			return false
		}
	}

	if part.FunctionCall == nil {
		return true
	}

	s.hasToolCalls = true

	// Normalize empty args to "{}" so downstream tool dispatchers see a valid
	// JSON object — json.Marshal(nil) would yield "null", which breaks tools
	// that decode into map[string]any or have a custom UnmarshalJSON.
	arguments := "{}"

	if len(part.FunctionCall.Args) > 0 {
		b, err := json.Marshal(part.FunctionCall.Args)
		if err != nil {
			send(ctx, ch, NewErrorEvent(
				fmt.Errorf("failed to marshal function call args: %w", err),
			))

			return false
		}

		arguments = string(b)
	}

	id := part.FunctionCall.ID
	if id == "" {
		id = uuid.New().String()
	}

	tc := &ToolCall{
		ID:        id,
		Name:      part.FunctionCall.Name,
		Arguments: arguments,
	}

	if !send(ctx, ch, NewToolEvent(EventToolUseStart, tc)) {
		return false
	}

	return send(ctx, ch, NewToolEvent(EventToolUseDone, tc))
}

// isGeminiStreamComplete reports whether resp carries a real terminal
// FinishReason. Empty and FINISH_REASON_UNSPECIFIED are treated as not-final
// so a non-terminal chunk does not prematurely emit EventComplete.
func isGeminiStreamComplete(resp *genai.GenerateContentResponse) bool {
	if len(resp.Candidates) == 0 {
		return false
	}

	fr := resp.Candidates[0].FinishReason

	return fr != "" && fr != genai.FinishReasonUnspecified
}
