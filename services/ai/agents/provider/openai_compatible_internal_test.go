package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/openai/openai-go/option"
)

type compatibleWireMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type compatibleWireTool struct {
	Type     string `json:"type"`
	Function struct {
		Name        string         `json:"name"`
		Description string         `json:"description"`
		Parameters  map[string]any `json:"parameters"`
	} `json:"function"`
}

type compatibleWireRequest struct {
	Model    string                  `json:"model"`
	Messages []compatibleWireMessage `json:"messages"`
	Tools    []compatibleWireTool    `json:"tools"`
	Stream   bool                    `json:"stream"`
}

type capturedCompatibleRequest struct {
	method        string
	path          string
	authorization []string
	body          compatibleWireRequest
	err           error
}

type collectedCompatibleEvents struct {
	content     string
	tools       []ToolCall
	stopReasons []string
	err         error
}

func collectCompatibleEvents(ch <-chan Event) collectedCompatibleEvents {
	var result collectedCompatibleEvents

	for event := range ch {
		switch event.Type {
		case EventContentDelta:
			result.content += event.Content
		case EventToolUseDone:
			if event.ToolCall != nil {
				result.tools = append(result.tools, *event.ToolCall)
			}
		case EventComplete:
			result.stopReasons = append(result.stopReasons, event.StopReason)
		case EventError:
			result.err = event.Error
		case EventToolUseStart, EventToolUseDelta:
		}
	}

	return result
}

func newCompatibleStreamRequest(
	model string,
	systemPrompt string,
	messages []Message,
	tools []ToolDefinition,
) StreamRequest {
	return StreamRequest{
		Model:        model,
		SystemPrompt: systemPrompt,
		Messages:     messages,
		Tools:        tools,
	}
}

func mustOpenAICompatible(
	t *testing.T,
	baseURL string,
	headers map[string]string,
) *OpenAICompatible {
	t.Helper()

	config, err := NewOpenAICompatibleConfig(baseURL, headers)
	if err != nil {
		t.Fatalf("create config: %v", err)
	}

	compatible, err := NewOpenAICompatible(config)
	if err != nil {
		t.Fatalf("create provider: %v", err)
	}

	return compatible
}

func writeCompatibleChunks(t *testing.T, w http.ResponseWriter, chunks []string) {
	t.Helper()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	flusher, ok := w.(http.Flusher)
	if !ok {
		t.Error("response writer does not support flushing")

		return
	}

	w.WriteHeader(http.StatusOK)

	for _, chunk := range chunks {
		if _, err := fmt.Fprintf(w, "data: %s\n\n", chunk); err != nil {
			t.Errorf("write chunk: %v", err)

			return
		}

		flusher.Flush()
	}
}

func TestOpenAICompatibleWireContract(t *testing.T) {
	t.Parallel()

	const model = "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"

	requestCh := make(chan capturedCompatibleRequest, 1)
	chunks := []string{
		`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"hello "}}]}`,
		`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"search","arguments":"{\"q\":\""}},{"index":1,"id":"call_2","type":"function","function":{"name":"fetch","arguments":"{\"url\":\""}}]}}]}`,
		`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"weather\"}"}},{"index":1,"function":{"arguments":"https://example.com\"}"}}]}}]}`,
		`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`[DONE]`,
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body compatibleWireRequest

		err := json.NewDecoder(r.Body).Decode(&body)
		requestCh <- capturedCompatibleRequest{
			method:        r.Method,
			path:          r.URL.Path,
			authorization: append([]string(nil), r.Header.Values("Authorization")...),
			body:          body,
			err:           err,
		}

		writeCompatibleChunks(t, w, chunks)
	}))
	t.Cleanup(server.Close)

	compatible := mustOpenAICompatible(t, server.URL+"/compat", nil)
	got := collectCompatibleEvents(compatible.StreamResponse(
		context.Background(),
		newCompatibleStreamRequest(
			model,
			"be concise",
			[]Message{{
				Role: RoleUser, Content: "find the weather", ToolCalls: nil,
				ToolCallID: "", ToolName: "",
			}},
			[]ToolDefinition{{
				Name: "search", Description: "Search the web",
				Parameters: map[string]any{"type": "object"},
			}},
		),
	))

	request := <-requestCh
	if request.err != nil {
		t.Fatalf("decode request: %v", request.err)
	}

	if request.method != http.MethodPost {
		t.Errorf("method = %q, want POST", request.method)
	}

	if request.path != "/compat/chat/completions" {
		t.Errorf("path = %q, want /compat/chat/completions", request.path)
	}

	if request.body.Model != model {
		t.Errorf("model = %q, want %q", request.body.Model, model)
	}

	if !request.body.Stream {
		t.Error("stream was not true")
	}

	if len(request.authorization) != 0 {
		t.Errorf("unexpected authorization headers: %q", request.authorization)
	}

	wantMessages := []compatibleWireMessage{
		{Role: "system", Content: "be concise"},
		{Role: RoleUser, Content: "find the weather"},
	}
	if diff := cmp.Diff(wantMessages, request.body.Messages); diff != "" {
		t.Errorf("messages mismatch (-want +got):\n%s", diff)
	}

	if len(request.body.Tools) != 1 {
		t.Fatalf("tools length = %d, want 1", len(request.body.Tools))
	}

	if request.body.Tools[0].Type != "function" || request.body.Tools[0].Function.Name != "search" {
		t.Errorf("unexpected tool: %+v", request.body.Tools[0])
	}

	if request.body.Tools[0].Function.Description != "Search the web" {
		t.Errorf("tool description = %q", request.body.Tools[0].Function.Description)
	}

	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	if got.content != "hello " {
		t.Errorf("content = %q, want %q", got.content, "hello ")
	}

	wantTools := []ToolCall{
		{ID: "call_1", Name: "search", Arguments: `{"q":"weather"}`},
		{ID: "call_2", Name: "fetch", Arguments: `{"url":"https://example.com"}`},
	}
	if diff := cmp.Diff(wantTools, got.tools); diff != "" {
		t.Errorf("tool calls mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]string{StopReasonToolUse}, got.stopReasons); diff != "" {
		t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenAICompatibleBaseURLJoining(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		basePath string
		wantPath string
	}{
		{name: "root", basePath: "", wantPath: "/chat/completions"},
		{name: "v1", basePath: "/v1", wantPath: "/v1/chat/completions"},
		{name: "v1 slash", basePath: "/v1/", wantPath: "/v1/chat/completions"},
		{name: "compat", basePath: "/compat", wantPath: "/compat/chat/completions"},
		{name: "compat slash", basePath: "/compat/", wantPath: "/compat/chat/completions"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			pathCh := make(chan string, 1)
			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					pathCh <- r.URL.Path

					writeCompatibleChunks(t, w, []string{`[DONE]`})
				}),
			)
			t.Cleanup(server.Close)

			compatible := mustOpenAICompatible(t, server.URL+test.basePath, nil)

			got := collectCompatibleEvents(compatible.StreamResponse(
				context.Background(),
				newCompatibleStreamRequest(
					"provider/model",
					"",
					[]Message{{Role: RoleUser, Content: "hi"}},
					nil,
				),
			))
			if got.err != nil {
				t.Fatalf("unexpected provider error: %v", got.err)
			}

			if gotPath := <-pathCh; gotPath != test.wantPath {
				t.Errorf("path = %q, want %q", gotPath, test.wantPath)
			}
		})
	}
}

func TestOpenAICompatibleFinishReasons(t *testing.T) {
	t.Parallel()

	tests := []struct {
		finishReason string
		want         string
	}{
		{finishReason: "stop", want: StopReasonEndTurn},
		{finishReason: "tool_calls", want: StopReasonToolUse},
		{finishReason: "function_call", want: StopReasonToolUse},
		{finishReason: "length", want: StopReasonMaxTokens},
		{finishReason: "content_filter", want: StopReasonRefusal},
		{finishReason: "compatible_extension", want: StopReasonEndTurn},
	}

	for _, test := range tests {
		t.Run(test.finishReason, func(t *testing.T) {
			t.Parallel()

			chunk := fmt.Sprintf(
				`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":%q}]}`,
				test.finishReason,
			)
			server := newOpenAIStreamServer(t, []string{chunk, `[DONE]`})
			compatible := mustOpenAICompatible(t, server.URL, nil)

			got := collectCompatibleEvents(compatible.StreamResponse(
				context.Background(),
				newCompatibleStreamRequest(
					"provider/model",
					"",
					[]Message{{Role: RoleUser, Content: "hi"}},
					nil,
				),
			))
			if got.err != nil {
				t.Fatalf("unexpected provider error: %v", got.err)
			}

			if diff := cmp.Diff([]string{test.want}, got.stopReasons); diff != "" {
				t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestOpenAICompatibleConfiguredHeadersAreDefensivelyCopied(t *testing.T) {
	t.Parallel()

	type capturedHeaders struct {
		original      []string
		authorization []string
	}

	headersCh := make(chan capturedHeaders, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headersCh <- capturedHeaders{
			original:      append([]string(nil), r.Header.Values("X-Original")...),
			authorization: append([]string(nil), r.Header.Values("Authorization")...),
		}

		writeCompatibleChunks(t, w, []string{`[DONE]`})
	}))
	t.Cleanup(server.Close)

	headers := map[string]string{"X-Original": "original-value"}

	config, err := NewOpenAICompatibleConfig(server.URL+"/v1", headers)
	if err != nil {
		t.Fatalf("create config: %v", err)
	}

	headers["X-Original"] = "mutated-value"
	headers["Authorization"] = "Bearer ambient-mutation"

	compatible, err := NewOpenAICompatible(config)
	if err != nil {
		t.Fatalf("create provider: %v", err)
	}

	got := collectCompatibleEvents(compatible.StreamResponse(
		context.Background(),
		StreamRequest{
			Model:        "provider/model",
			SystemPrompt: "",
			Messages:     []Message{{Role: RoleUser, Content: "hi"}},
			Tools:        nil,
		},
	))
	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	captured := <-headersCh
	if diff := cmp.Diff([]string{"original-value"}, captured.original); diff != "" {
		t.Errorf("X-Original mismatch (-want +got):\n%s", diff)
	}

	if len(captured.authorization) != 0 {
		t.Errorf("unexpected authorization headers: %q", captured.authorization)
	}
}

func TestOpenAICompatibleSetsOneAuthorizationValue(t *testing.T) {
	t.Parallel()

	headerCh := make(chan []string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headerCh <- append([]string(nil), r.Header.Values("Authorization")...)

		writeCompatibleChunks(t, w, []string{`[DONE]`})
	}))
	t.Cleanup(server.Close)

	compatible := mustOpenAICompatible(
		t,
		server.URL+"/v1/",
		map[string]string{"Authorization": "Bearer configured-once"},
	)

	got := collectCompatibleEvents(compatible.StreamResponse(
		context.Background(),
		newCompatibleStreamRequest(
			"provider/model",
			"",
			[]Message{{Role: RoleUser, Content: "hi"}},
			nil,
		),
	))
	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	if diff := cmp.Diff([]string{"Bearer configured-once"}, <-headerCh); diff != "" {
		t.Errorf("authorization mismatch (-want +got):\n%s", diff)
	}
}

// This test is intentionally non-parallel because t.Setenv changes process-wide
// SDK inputs. It proves the compatible service never loads native OpenAI defaults.
func TestOpenAICompatibleIgnoresAmbientOpenAIConfiguration(t *testing.T) {
	var ambientRequests atomic.Int64

	ambientServer := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		ambientRequests.Add(1)
	}))
	t.Cleanup(ambientServer.Close)

	t.Setenv("OPENAI_API_KEY", "ambient-api-key-marker")
	t.Setenv("OPENAI_BASE_URL", ambientServer.URL+"/ambient")
	t.Setenv("OPENAI_ORG_ID", "ambient-org-marker")
	t.Setenv("OPENAI_PROJECT_ID", "ambient-project-marker")
	t.Setenv("OPENAI_WEBHOOK_SECRET", "ambient-webhook-marker")

	type capturedHeaders struct {
		authorization []string
		organization  []string
		project       []string
	}

	headersCh := make(chan capturedHeaders, 1)
	explicitServer := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			headersCh <- capturedHeaders{
				authorization: append([]string(nil), r.Header.Values("Authorization")...),
				organization:  append([]string(nil), r.Header.Values("OpenAI-Organization")...),
				project:       append([]string(nil), r.Header.Values("OpenAI-Project")...),
			}

			writeCompatibleChunks(t, w, []string{`[DONE]`})
		}),
	)
	t.Cleanup(explicitServer.Close)

	compatible := mustOpenAICompatible(t, explicitServer.URL+"/v1", nil)

	got := collectCompatibleEvents(compatible.StreamResponse(
		context.Background(),
		newCompatibleStreamRequest(
			"provider/model",
			"",
			[]Message{{Role: RoleUser, Content: "hi"}},
			nil,
		),
	))
	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	captured := <-headersCh
	if len(captured.authorization) != 0 || len(captured.organization) != 0 ||
		len(captured.project) != 0 {
		t.Errorf("ambient OpenAI headers reached compatible endpoint: %+v", captured)
	}

	if got := ambientRequests.Load(); got != 0 {
		t.Errorf("ambient endpoint received %d requests", got)
	}
}

func TestNewOpenAICompatibleRevalidatesConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		config *OpenAICompatibleConfig
	}{
		{name: "nil", config: nil},
		{name: "zero", config: &OpenAICompatibleConfig{}},
		{
			name: "mutated URL",
			config: &OpenAICompatibleConfig{
				baseURL: "https://example.com/v1?secret=marker",
				headers: nil,
			},
		},
		{
			name: "mutated headers",
			config: &OpenAICompatibleConfig{
				baseURL: "https://example.com/v1",
				headers: map[string]string{"Host": "secret-marker"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			compatible, err := NewOpenAICompatible(test.config)
			if err == nil {
				t.Fatal("expected an error")
			}

			if compatible != nil {
				t.Fatal("expected a nil provider")
			}

			if strings.Contains(err.Error(), "marker") {
				t.Fatalf("error exposed config input: %v", err)
			}
		})
	}
}

func TestOpenAICompatibleRefusesRedirects(t *testing.T) {
	t.Parallel()

	const headerValue = "Bearer redirect-secret-marker"

	var redirectedRequests atomic.Int64

	redirectTarget := httptest.NewServer(
		http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			redirectedRequests.Add(1)

			if got := r.Header.Get("Authorization"); got != "" {
				t.Errorf("redirect target received authorization %q", got)
			}
		}),
	)
	t.Cleanup(redirectTarget.Close)

	var sourceRequests atomic.Int64

	redirectSource := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sourceRequests.Add(1)

			if got := r.Header.Values("Authorization"); !slicesEqual(got, []string{headerValue}) {
				t.Errorf("source authorization = %q, want one configured value", got)
			}

			http.Redirect(w, r, redirectTarget.URL+"/stolen", http.StatusTemporaryRedirect)
		}),
	)
	t.Cleanup(redirectSource.Close)

	compatible := mustOpenAICompatible(
		t,
		redirectSource.URL+"/v1",
		map[string]string{"Authorization": headerValue},
	)
	got := collectCompatibleEvents(compatible.StreamResponse(
		context.Background(),
		newCompatibleStreamRequest(
			"provider/model",
			"",
			[]Message{{Role: RoleUser, Content: "hi"}},
			nil,
		),
	))

	if !errors.Is(got.err, errOpenAICompatibleRequest) {
		t.Fatalf("error = %v, want fixed compatible error", got.err)
	}

	if got.err.Error() != errOpenAICompatibleRequest.Error() {
		t.Fatalf("error = %q, want fixed redirect category", got.err)
	}

	if sourceRequests.Load() != 1 {
		t.Errorf("source requests = %d, want 1", sourceRequests.Load())
	}

	if redirectedRequests.Load() != 0 {
		t.Errorf("redirect target requests = %d, want 0", redirectedRequests.Load())
	}

	if got.err != nil && (strings.Contains(got.err.Error(), headerValue) ||
		strings.Contains(got.err.Error(), redirectTarget.URL)) {
		t.Fatalf("error exposed redirect data: %v", got.err)
	}
}

func TestOpenAICompatibleHTTPStatusErrorsAreSafe(t *testing.T) {
	t.Parallel()

	const (
		headerMarker = "status-header-marker"
		urlMarker    = "status-url-marker"
		bodyMarker   = "status-body-marker"
	)

	tests := []struct {
		name   string
		status int
	}{
		{name: "unauthorized", status: http.StatusUnauthorized},
		{name: "not found", status: http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(test.status)

					if _, err := io.WriteString(
						w,
						`{"error":{"message":"`+bodyMarker+`"}}`,
					); err != nil {
						t.Errorf("write response: %v", err)
					}
				},
			))
			t.Cleanup(server.Close)

			compatible := mustOpenAICompatible(
				t,
				server.URL+"/"+urlMarker,
				map[string]string{"Authorization": "Bearer " + headerMarker},
			)
			got := collectCompatibleEvents(compatible.StreamResponse(
				context.Background(),
				newCompatibleStreamRequest(
					"provider/model",
					"",
					[]Message{{Role: RoleUser, Content: "hi"}},
					nil,
				),
			))

			if !errors.Is(got.err, errOpenAICompatibleRequest) {
				t.Fatalf("error = %v, want compatible request error", got.err)
			}

			want := fmt.Sprintf(
				"%s: HTTP status %d",
				errOpenAICompatibleRequest,
				test.status,
			)
			if got.err.Error() != want {
				t.Errorf("error = %q, want status-only error %q", got.err, want)
			}

			for _, marker := range []string{headerMarker, urlMarker, bodyMarker} {
				if strings.Contains(got.err.Error(), marker) {
					t.Errorf("error exposed marker %q: %v", marker, got.err)
				}
			}
		})
	}
}

func slicesEqual(left, right []string) bool {
	return cmp.Equal(left, right)
}

// This test is intentionally non-parallel because it temporarily replaces the
// process-wide default logger to verify upstream markers cannot reach logs.
//
//nolint:paralleltest // Parallel execution could expose another test's logs or logger.
func TestOpenAICompatibleFailuresAreSafe(t *testing.T) {
	const (
		headerMarker = "secret-header-marker"
		urlMarker    = "secret-url-marker"
	)

	oldLogger := slog.Default()

	var logOutput bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&logOutput, nil)))
	t.Cleanup(func() {
		slog.SetDefault(oldLogger)
	})

	// These subtests share the captured process-wide logger.
	//nolint:paralleltest // Parallel execution could mix global logger output.
	t.Run("HTTP response body", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadRequest)

			_, err := io.WriteString(
				w,
				`{"error":{"message":"`+headerMarker+` `+urlMarker+`"}}`,
			)
			if err != nil {
				t.Errorf("write response: %v", err)
			}
		}))
		t.Cleanup(server.Close)

		compatible := mustOpenAICompatible(
			t,
			server.URL+"/"+urlMarker,
			map[string]string{"Authorization": "Bearer " + headerMarker},
		)
		got := collectCompatibleEvents(compatible.StreamResponse(
			context.Background(),
			newCompatibleStreamRequest(
				"provider/model",
				"",
				[]Message{{Role: RoleUser, Content: "hi"}},
				nil,
			),
		))
		assertSafeCompatibleError(t, got.err, headerMarker, urlMarker)
	})

	//nolint:paralleltest // Parallel execution could mix global logger output.
	t.Run("stream error payload", func(t *testing.T) {
		server := newOpenAIStreamServer(t, []string{
			`{"error":"` + headerMarker + ` ` + urlMarker + `"}`,
		})
		compatible := mustOpenAICompatible(
			t,
			server.URL+"/"+urlMarker,
			map[string]string{"Authorization": "Bearer " + headerMarker},
		)
		got := collectCompatibleEvents(compatible.StreamResponse(
			context.Background(),
			newCompatibleStreamRequest(
				"provider/model",
				"",
				[]Message{{Role: RoleUser, Content: "hi"}},
				nil,
			),
		))
		assertSafeCompatibleError(t, got.err, headerMarker, urlMarker)
	})

	//nolint:paralleltest // Parallel execution could mix global logger output.
	t.Run("transport failure", func(t *testing.T) {
		compatible := mustOpenAICompatible(
			t,
			"https://example.com/"+urlMarker,
			map[string]string{"Authorization": "Bearer " + headerMarker},
		)
		compatible.completions.Options = append(
			compatible.completions.Options,
			option.WithHTTPClient(&http.Client{
				Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
					return nil, fmt.Errorf(
						"transport failed with secret-header-marker and secret-url-marker: %w",
						errInvalidOpenAICompatibleHeaders,
					)
				}),
				CheckRedirect: nil,
				Jar:           nil,
				Timeout:       0,
			}),
			option.WithMaxRetries(0),
		)

		got := collectCompatibleEvents(compatible.StreamResponse(
			context.Background(),
			newCompatibleStreamRequest(
				"provider/model",
				"",
				[]Message{{Role: RoleUser, Content: "hi"}},
				nil,
			),
		))
		assertSafeCompatibleError(t, got.err, headerMarker, urlMarker)

		if got.err.Error() != errOpenAICompatibleRequest.Error() {
			t.Errorf("error = %q, want fixed transport category", got.err)
		}
	})

	//nolint:paralleltest // Parallel execution could mix global logger output.
	t.Run("close failure log", func(t *testing.T) {
		closeMarker := fmt.Errorf(
			"close-secret-header-marker-secret-url-marker: %w",
			errInvalidOpenAICompatibleHeaders,
		)
		compatible := mustOpenAICompatible(
			t,
			"https://example.com/v1",
			map[string]string{"Authorization": "Bearer " + headerMarker},
		)
		compatible.completions.Options = append(
			compatible.completions.Options,
			option.WithHTTPClient(&http.Client{
				Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
					body := &closeErrorBody{
						Reader: strings.NewReader("data: [DONE]\n\n"),
						err:    closeMarker,
					}

					return &http.Response{
						Status:     "200 OK",
						StatusCode: http.StatusOK,
						Proto:      "HTTP/1.1",
						ProtoMajor: 1,
						ProtoMinor: 1,
						Header: http.Header{
							"Content-Type": []string{"text/event-stream"},
						},
						Body:             body,
						ContentLength:    -1,
						TransferEncoding: nil,
						Close:            false,
						Uncompressed:     false,
						Trailer:          nil,
						Request:          request,
						TLS:              nil,
					}, nil
				}),
				CheckRedirect: nil,
				Jar:           nil,
				Timeout:       0,
			}),
		)

		got := collectCompatibleEvents(compatible.StreamResponse(
			context.Background(),
			newCompatibleStreamRequest(
				"provider/model",
				"",
				[]Message{{Role: RoleUser, Content: "hi"}},
				nil,
			),
		))
		if got.err != nil {
			t.Fatalf("unexpected provider error: %v", got.err)
		}
	})

	logs := logOutput.String()
	if strings.Contains(logs, headerMarker) || strings.Contains(logs, urlMarker) {
		t.Fatalf("logger exposed upstream marker: %s", logs)
	}

	if !strings.Contains(logs, errOpenAICompatibleRequest.Error()) {
		t.Fatalf("close error log did not use fixed error: %s", logs)
	}
}

func assertSafeCompatibleError(t *testing.T, err error, markers ...string) {
	t.Helper()

	if !errors.Is(err, errOpenAICompatibleRequest) {
		t.Fatalf("error = %v, want fixed compatible error", err)
	}

	for _, marker := range markers {
		if strings.Contains(err.Error(), marker) {
			t.Fatalf("error exposed marker %q: %v", marker, err)
		}
	}

	upstream := fmt.Errorf("upstream marker: %w", errInvalidOpenAICompatibleHeaders)

	mapped := mapOpenAICompatibleError(upstream, nil)
	if !errors.Is(mapped, errOpenAICompatibleRequest) {
		t.Fatalf("mapped error = %v, want fixed compatible error", mapped)
	}

	if errors.Is(mapped, errInvalidOpenAICompatibleHeaders) {
		t.Fatal("compatible error retained the upstream cause")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

type closeErrorBody struct {
	io.Reader

	err error
}

func (b *closeErrorBody) Close() error {
	return b.err
}

func TestOpenAICompatibleCancellationClosesStream(t *testing.T) {
	t.Parallel()

	requestCancelled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeCompatibleChunks(t, w, []string{
			`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"started"}}]}`,
		})
		<-r.Context().Done()
		close(requestCancelled)
	}))
	t.Cleanup(server.Close)

	compatible := mustOpenAICompatible(t, server.URL+"/v1", nil)
	ctx, cancel := context.WithCancel(context.Background())
	stream := compatible.StreamResponse(
		ctx,
		newCompatibleStreamRequest(
			"provider/model",
			"",
			[]Message{{Role: RoleUser, Content: "hi"}},
			nil,
		),
	)

	select {
	case event := <-stream:
		if event.Type != EventContentDelta || event.Content != "started" {
			t.Fatalf("first event = %+v, want started content", event)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for first stream event")
	}

	cancel()

	select {
	case <-requestCancelled:
	case <-time.After(5 * time.Second):
		t.Fatal("request context was not cancelled")
	}

	streamClosed := make(chan struct{})
	go func() {
		for {
			if _, open := <-stream; !open {
				break
			}
		}

		close(streamClosed)
	}()

	select {
	case <-streamClosed:
	case <-time.After(5 * time.Second):
		t.Fatal("provider event channel did not close")
	}
}

func TestOpenAICompatibleConcurrentStreams(t *testing.T) {
	t.Parallel()

	const streamCount = 12

	requestModels := make(chan string, streamCount)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request compatibleWireRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		requestModels <- request.Model

		writeCompatibleChunks(t, w, []string{
			`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"ok"}}]}`,
			`{"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			`[DONE]`,
		})
	}))
	t.Cleanup(server.Close)

	config, err := NewOpenAICompatibleConfig(
		server.URL+"/v1",
		map[string]string{"X-Shared": "shared-config"},
	)
	if err != nil {
		t.Fatalf("create config: %v", err)
	}

	compatible, err := NewOpenAICompatible(config)
	if err != nil {
		t.Fatalf("create provider: %v", err)
	}

	results := make(chan collectedCompatibleEvents, streamCount)
	wantModels := make([]string, 0, streamCount)

	var waitGroup sync.WaitGroup
	waitGroup.Add(streamCount)

	for index := range streamCount {
		model := fmt.Sprintf("provider/model-%d", index)
		wantModels = append(wantModels, model)

		go func(requestModel string) {
			defer waitGroup.Done()

			results <- collectCompatibleEvents(compatible.StreamResponse(
				context.Background(),
				StreamRequest{
					Model:        requestModel,
					SystemPrompt: "",
					Messages:     []Message{{Role: RoleUser, Content: "hi"}},
					Tools:        nil,
				},
			))
		}(model)
	}

	waitGroup.Wait()
	close(results)
	close(requestModels)

	for result := range results {
		if result.err != nil {
			t.Errorf("unexpected provider error: %v", result.err)
		}

		if result.content != "ok" {
			t.Errorf("content = %q, want ok", result.content)
		}

		if diff := cmp.Diff([]string{StopReasonEndTurn}, result.stopReasons); diff != "" {
			t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
		}
	}

	gotModels := make([]string, 0, streamCount)
	for model := range requestModels {
		gotModels = append(gotModels, model)
	}

	slices.Sort(wantModels)
	slices.Sort(gotModels)

	if diff := cmp.Diff(wantModels, gotModels); diff != "" {
		t.Errorf("request models mismatch (-want +got):\n%s", diff)
	}
}
