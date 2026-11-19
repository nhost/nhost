package embedder

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/nhost/services/ai/internal/providerconfig"
)

const (
	// https://platform.openai.com/docs/api-reference/embeddings/create documents
	// 2048 inputs per call. OpenAI-compatible servers (Ollama, vLLM, LiteLLM)
	// often accept far fewer, so use a conservative 100.
	openAIMaxInputs = 100
	// https://ai.google.dev/api/embeddings#method:-models.batchembedcontents
	// (2026-11-13): retrieved reference does not specify a per-call maximum;
	// conservatively cap synchronous requests at 100 entries.
	geminiMaxInputs = 100
	// https://docs.voyageai.com/reference/embeddings-api (2026-11-18): 1000 inputs
	// and at least 120K tokens per call; over-length texts are truncated by default.
	voyageMaxInputs = 1000
	// A conservative text-byte budget, not a claim about provider token limits.
	maxInputBytes    = 256 * 1024
	maxResponseBytes = 64 * 1024 * 1024
	userAgent        = "nhost-ai"
)

// voyageSupportsDimensions reports whether the model accepts output_dimension;
// other Voyage models only produce their default size and reject the parameter.
// https://docs.voyageai.com/reference/embeddings-api (2026-11-18).
func voyageSupportsDimensions(model string) bool {
	for _, prefix := range []string{"voyage-4", "voyage-3-large", "voyage-3.5", "voyage-code-3"} {
		if strings.HasPrefix(model, prefix) {
			return true
		}
	}

	return false
}

type adapter struct {
	configuration configuredEndpoint
	client        *http.Client
}

func newAdapter(configuration configuredEndpoint, transport http.RoundTripper) *adapter {
	return &adapter{
		configuration: configuration,
		client:        providerconfig.NewNoRedirectHTTPClientWithTransport(transport),
	}
}

func (a *adapter) BatchLimits() Limits {
	count := openAIMaxInputs
	switch a.configuration.adapter {
	case voyageType:
		count = voyageMaxInputs
	case geminiType:
		count = geminiMaxInputs
	}

	return Limits{MaxInputs: count, MaxBytes: maxInputBytes}
}

type embeddingBody struct {
	Model           string    `json:"model"`
	Input           []string  `json:"input"`
	EncodingFormat  string    `json:"encoding_format,omitempty"`
	Dimensions      int       `json:"dimensions,omitempty"`
	InputType       InputKind `json:"input_type,omitempty"`
	OutputDimension int       `json:"output_dimension,omitempty"`
}

type (
	geminiPart struct {
		Text string `json:"text"`
	}
	geminiContent struct {
		Parts []geminiPart `json:"parts"`
	}
	geminiEntry struct {
		Model                string        `json:"model"`
		Content              geminiContent `json:"content"`
		TaskType             string        `json:"taskType"`
		OutputDimensionality int           `json:"outputDimensionality"`
	}
)

type geminiBody struct {
	Requests []geminiEntry `json:"requests"`
}

func (a *adapter) requestBody(req Request) (string, any) {
	base := strings.TrimRight(a.configuration.endpoint.BaseURL, "/")
	if a.configuration.adapter == geminiType {
		model := strings.TrimPrefix(req.Model, "models/")

		task := "RETRIEVAL_DOCUMENT"
		if req.Kind == Query {
			task = "RETRIEVAL_QUERY"
		}

		entries := make([]geminiEntry, len(req.Inputs))
		for i, text := range req.Inputs {
			entries[i] = geminiEntry{
				Model:                "models/" + model,
				Content:              geminiContent{Parts: []geminiPart{{Text: text}}},
				TaskType:             task,
				OutputDimensionality: req.Dimensions,
			}
		}

		return base + "/v1beta/models/" + url.PathEscape(
			model,
		) + ":batchEmbedContents", geminiBody{
			Requests: entries,
		}
	}

	body := embeddingBody{
		Model:           req.Model,
		Input:           req.Inputs,
		EncodingFormat:  "",
		Dimensions:      0,
		InputType:       "",
		OutputDimension: 0,
	}
	if a.configuration.adapter == voyageType {
		body.InputType = req.Kind
		if voyageSupportsDimensions(req.Model) {
			body.OutputDimension = req.Dimensions
		}

		return base + "/v1/embeddings", body
	}

	body.EncodingFormat = "float"
	// Contains rather than HasPrefix so proxy aliases such as LiteLLM's
	// "openai/text-embedding-3-small" also get the requested size.
	if strings.Contains(req.Model, "text-embedding-3-") {
		body.Dimensions = req.Dimensions
	}

	return base + "/embeddings", body
}

func (a *adapter) Embed(ctx context.Context, req Request) ([][]float32, error) {
	if ctx.Err() != nil {
		return nil, failure(Canceled, "request canceled")
	}

	if req.Dimensions <= 0 || req.Model == "" || (req.Kind != Document && req.Kind != Query) {
		return nil, failure(Configuration, "invalid embedding request configuration")
	}

	// Providers reject empty texts with a generic 400, which is classified as a
	// configuration failure; report them as input so callers can isolate the row.
	for _, text := range req.Inputs {
		if strings.TrimSpace(text) == "" {
			return nil, failure(Input, "empty input")
		}
	}

	endpoint, body := a.requestBody(req)

	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, failure(Configuration, "could not encode request")
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(encoded),
	)
	if err != nil {
		return nil, failure(Configuration, "could not construct request")
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	// Some proxies reject requests without a user agent; declared headers may override it.
	request.Header.Set("User-Agent", userAgent)

	for name, value := range a.configuration.endpoint.Headers {
		request.Header.Set(name, value)
	}

	data, err := a.execute(ctx, request)
	if err != nil {
		return nil, err
	}

	vectors, err := a.decode(data, req)
	if err != nil {
		return nil, err
	}

	if err := Validate(vectors, req); err != nil {
		return nil, err
	}

	return vectors, nil
}

func (a *adapter) execute(ctx context.Context, request *http.Request) ([]byte, error) {
	response, err := a.client.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return nil, failure(Canceled, "request canceled")
		}

		if errors.Is(err, providerconfig.ErrRedirect) {
			return nil, failure(Configuration, "redirect refused")
		}

		return nil, failure(Transient, "transport failed")
	}

	data, readErr := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	closeErr := response.Body.Close()

	if ctx.Err() != nil {
		return nil, failure(Canceled, "request canceled")
	}

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, httpFailure(response, data)
	}

	if readErr != nil || closeErr != nil {
		return nil, failure(Transient, "response transport failed")
	}

	if len(data) > maxResponseBytes {
		return nil, failure(Configuration, "response exceeds size limit")
	}

	return data, nil
}

type indexedVector struct {
	Index     json.RawMessage `json:"index"`
	Embedding []float32       `json:"embedding"`
}
type embeddingResponse struct {
	Data       []indexedVector `json:"data"`
	Embeddings []struct {
		Values []float32 `json:"values"`
	} `json:"embeddings"`
}

func (a *adapter) decode(data []byte, req Request) ([][]float32, error) {
	var response embeddingResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, failure(Configuration, "malformed embedding response")
	}

	vectors := make([][]float32, len(req.Inputs))
	if a.configuration.adapter == geminiType {
		if len(response.Embeddings) != len(vectors) {
			return nil, failure(Configuration, "response count does not match inputs")
		}

		for i, entry := range response.Embeddings {
			vectors[i] = entry.Values
		}

		return vectors, nil
	}

	return orderedVectors(response.Data, len(req.Inputs), a.configuration.adapter == voyageType)
}

func orderedVectors(data []indexedVector, count int, requireIndexes bool) ([][]float32, error) {
	if len(data) != count {
		return nil, failure(Configuration, "response count does not match inputs")
	}

	vectors := make([][]float32, count)
	seen := make([]bool, count)

	indexed := len(data) > 0 && len(data[0].Index) > 0
	for i, entry := range data {
		if (len(entry.Index) > 0) != indexed || (!indexed && requireIndexes) {
			return nil, failure(Configuration, "response has missing indexes")
		}

		index := i
		if indexed {
			var decodedIndex *int
			if err := json.Unmarshal(
				entry.Index,
				&decodedIndex,
			); err != nil ||
				decodedIndex == nil {
				return nil, failure(Configuration, "response has invalid indexes")
			}

			index = *decodedIndex
		}

		if index < 0 || index >= len(vectors) || seen[index] {
			return nil, failure(Configuration, "response has invalid indexes")
		}

		seen[index] = true
		vectors[index] = entry.Embedding
	}

	return vectors, nil
}

const (
	genericRejection   = "provider rejected request"
	contextLengthError = "input exceeds model context length"
)

// statusClass maps HTTP status alone. Other 4xx responses, including 400 and
// 422, usually mean the model, dimensions or parameters are wrong for every
// row, so they are configuration failures unless the body says otherwise.
func statusClass(status int) ErrorClass {
	switch {
	case status == http.StatusTooManyRequests ||
		status == http.StatusRequestTimeout ||
		status >= http.StatusInternalServerError:
		return Transient
	case status == http.StatusRequestEntityTooLarge:
		return Input
	default:
		return Configuration
	}
}

type providerError struct {
	Message string `json:"message"`
	Error   struct {
		Code    json.RawMessage `json:"code"`
		Message string          `json:"message"`
		Details []struct {
			Type   string `json:"@type"`
			Reason string `json:"reason"`
		} `json:"details"`
	} `json:"error"`
}

// recognize maps documented provider errors to a class and fixed message.
// Provider text is only matched, never echoed.
func (p providerError) recognize(status int) (ErrorClass, string, bool) {
	for _, detail := range p.Error.Details {
		if detail.Type == "type.googleapis.com/google.rpc.ErrorInfo" &&
			detail.Reason == "API_KEY_INVALID" {
			return Configuration, "API key is invalid", true
		}
	}

	var code string
	if json.Unmarshal(p.Error.Code, &code) == nil {
		switch code {
		case "model_not_found":
			return Configuration, "model is not available", true
		case "insufficient_quota":
			return Configuration, "provider quota exhausted", true
		case "invalid_api_key":
			return Configuration, "API key is invalid", true
		case "context_length_exceeded":
			return Input, contextLengthError, true
		}
	}

	// OpenAI, vLLM and LiteLLM report over-length inputs without a dedicated code.
	if (status == http.StatusBadRequest || status == http.StatusUnprocessableEntity) &&
		strings.Contains(strings.ToLower(p.Error.Message), "context length") {
		return Input, contextLengthError, true
	}

	if (status == http.StatusBadRequest || status == http.StatusUnprocessableEntity) &&
		p.batchTokenLimit() {
		return Input, "batch exceeds provider token limit", true
	}

	return "", "", false
}

// batchTokenLimit accepts both top-level and OpenAI-style error messages.
func (p providerError) batchTokenLimit() bool {
	for _, message := range []string{p.Message, p.Error.Message} {
		text := strings.ToLower(message)
		if strings.Contains(text, "too many tokens") ||
			strings.Contains(text, "split into more batches") {
			return true
		}
	}

	return false
}

func httpFailure(response *http.Response, data []byte) *StatusError {
	class, message := statusClass(response.StatusCode), genericRejection

	var body providerError
	if json.Unmarshal(data, &body) == nil {
		if recognized, text, ok := body.recognize(response.StatusCode); ok {
			class, message = recognized, text
		}
	}

	return &StatusError{
		Class:      class,
		StatusCode: response.StatusCode,
		RetryAfter: response.Header.Get("Retry-After"),
		Message:    message,
	}
}
