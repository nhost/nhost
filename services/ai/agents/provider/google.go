package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/genai"
)

const (
	googleGeminiAPIVersion = "v1beta"
	googleGeminiKeyHeader  = "x-goog-api-key"
	// An empty SDK key loads ambient keys or fails construction; the transport
	// removes this non-empty sentinel before sending headerless requests.
	googleGeminiKeySentinel = "nhost-google-gemini-headerless-sentinel"
)

var (
	errGoogleGeminiClient       = errors.New("google Gemini provider client construction failed")
	errGoogleGeminiRequest      = errors.New("google Gemini provider request failed")
	errGoogleGeminiTransport    = errors.New("google Gemini provider transport failed")
	errGoogleGeminiResponseBody = errors.New("google Gemini provider response body failed")
)

type googleGemini struct {
	client *genai.Client
}

func newGoogleGeminiConfiguration(
	baseURL string,
	headers map[string]string,
) (endpointConfiguration, error) {
	configuration, err := newEndpointConfiguration(
		baseURL,
		headers,
		validateGoogleGeminiURL,
		nil,
		map[string]struct{}{
			"user-agent":        {},
			"x-goog-api-client": {},
			"x-server-timeout":  {},
		},
	)
	if err != nil {
		return endpointConfiguration{}, fmt.Errorf("configure Google Gemini endpoint: %w", err)
	}

	return configuration, nil
}

func validateGoogleGeminiURL(baseURL string) error {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return errInvalidProviderBaseURL
	}

	pathWithoutTrailingSlash := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasSuffix(pathWithoutTrailingSlash, "/v1beta") ||
		strings.HasSuffix(pathWithoutTrailingSlash, "/models") ||
		strings.Contains(pathWithoutTrailingSlash, "/models/") ||
		strings.HasSuffix(pathWithoutTrailingSlash, ":generateContent") ||
		strings.HasSuffix(pathWithoutTrailingSlash, ":streamGenerateContent") {
		return errInvalidProviderBaseURL
	}

	return nil
}

func newGoogleGemini(
	ctx context.Context,
	configuration endpointConfiguration,
) (*googleGemini, error) {
	headers, apiKey, scrubAPIKey := googleGeminiHeaders(configuration.headers)

	httpClient, err := newGoogleGeminiHTTPClient(scrubAPIKey)
	if err != nil {
		return nil, errGoogleGeminiClient
	}

	clientConfig := &genai.ClientConfig{
		APIKey:      apiKey,
		Backend:     genai.BackendGeminiAPI,
		Project:     "",
		Location:    "",
		Credentials: nil,
		HTTPClient:  httpClient,
		HTTPOptions: genai.HTTPOptions{
			BaseURL:               configuration.baseURL,
			APIVersion:            googleGeminiAPIVersion,
			Headers:               headers,
			Timeout:               nil,
			ExtraBody:             nil,
			ExtrasRequestProvider: nil,
		},
	}

	client, err := genai.NewClient(ctx, clientConfig)
	if err != nil {
		return nil, errGoogleGeminiClient
	}

	return &googleGemini{client: client}, nil
}

func googleGeminiHeaders(headers map[string]string) (http.Header, string, bool) {
	result := make(http.Header, len(headers))
	apiKey := googleGeminiKeySentinel
	scrubAPIKey := true

	for name, value := range headers {
		if strings.EqualFold(name, googleGeminiKeyHeader) {
			if value != "" {
				apiKey = value
				scrubAPIKey = false
			}

			continue
		}

		result.Set(name, value)
	}

	return result, apiKey, scrubAPIKey
}

func newGoogleGeminiHTTPClient(scrubAPIKey bool) (*http.Client, error) {
	defaultTransport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return nil, errGoogleGeminiClient
	}

	transport := &googleGeminiTransport{
		base:        defaultTransport.Clone(),
		scrubAPIKey: scrubAPIKey,
	}

	return newNoRedirectHTTPClientWithTransport(transport), nil
}

type googleGeminiTransport struct {
	base        http.RoundTripper
	scrubAPIKey bool
}

func (t *googleGeminiTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	requestCopy := request.Clone(request.Context())
	requestCopy.Header = request.Header.Clone()

	if t.scrubAPIKey {
		requestCopy.Header.Del(googleGeminiKeyHeader)
	}

	response, err := t.base.RoundTrip(requestCopy)
	if err != nil {
		return nil, errGoogleGeminiTransport
	}

	responseCopy := new(http.Response)
	*responseCopy = *response

	if response.Body != nil {
		responseCopy.Body = &googleGeminiResponseBody{ReadCloser: response.Body}
	}

	return responseCopy, nil
}

// The SDK logs stream scanner failures through the process-global logger;
// normalizing body errors here prevents raw upstream data from leaking there.
type googleGeminiResponseBody struct {
	io.ReadCloser
}

func (b *googleGeminiResponseBody) Read(buffer []byte) (int, error) {
	bytesRead, err := b.ReadCloser.Read(buffer)
	if err == nil {
		return bytesRead, nil
	}

	if errors.Is(err, io.EOF) {
		return bytesRead, io.EOF
	}

	return bytesRead, errGoogleGeminiResponseBody
}

func (b *googleGeminiResponseBody) Close() error {
	if err := b.ReadCloser.Close(); err != nil {
		return errGoogleGeminiResponseBody
	}

	return nil
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

func (g *googleGemini) StreamResponse(
	ctx context.Context,
	request StreamRequest,
) <-chan Event {
	return streamGoogleGeminiResponse(ctx, g.client, request)
}

func streamGoogleGeminiResponse(
	ctx context.Context,
	client *genai.Client,
	request StreamRequest,
) <-chan Event {
	if err := request.validate(); err != nil {
		return requestErrorChannel(err)
	}

	ch := make(chan Event)

	go func() {
		defer close(ch)

		processGoogleGeminiStream(ctx, client, ch, request)
	}()

	return ch
}

func processGoogleGeminiStream(
	ctx context.Context,
	client *genai.Client,
	ch chan<- Event,
	request StreamRequest,
) {
	config := &genai.GenerateContentConfig{} //nolint:exhaustruct
	if request.SystemPrompt != "" {
		config.SystemInstruction = genai.NewContentFromText(
			request.SystemPrompt,
			genai.RoleUser,
		)
	}

	gt := toGeminiTools(request.Tools)
	if len(gt) > 0 {
		config.Tools = gt
	}

	contents, err := toGeminiContents(ctx, request.Messages)
	if err != nil {
		send(ctx, ch, NewErrorEvent(fmt.Errorf("failed to convert messages: %w", err)))
		return
	}

	stream := &googleStream{hasToolCalls: false}

	for resp, err := range client.Models.GenerateContentStream(
		ctx,
		request.Model,
		contents,
		config,
	) {
		if ctx.Err() != nil {
			return
		}

		if err != nil {
			send(ctx, ch, NewErrorEvent(mapGoogleGeminiError(err)))
			return
		}

		if !stream.processCandidates(ctx, ch, resp) {
			return
		}
	}
}

func mapGoogleGeminiError(err error) error {
	var apiError genai.APIError
	if errors.As(err, &apiError) &&
		apiError.Code >= http.StatusBadRequest &&
		apiError.Code <= 599 {
		return fmt.Errorf("%w: HTTP status %d", errGoogleGeminiRequest, apiError.Code)
	}

	return errGoogleGeminiRequest
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
