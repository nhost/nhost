package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/google/go-cmp/cmp"
)

const anthropicWorkspaceIDHeader = "anthropic-workspace-id"

type capturedAnthropicMessagesRequest struct {
	path   string
	header http.Header
	body   string
}

type collectedAnthropicMessagesEvents struct {
	content     string
	tools       []ToolCall
	stopReasons []string
	err         error
}

func mustAnthropicMessages(
	t *testing.T,
	baseURL string,
	headers map[string]string,
) *anthropicMessages {
	t.Helper()

	configuration, err := newAnthropicMessagesConfiguration(baseURL, headers)
	if err != nil {
		t.Fatalf("configure Anthropic Messages: %v", err)
	}

	return newAnthropicMessages(configuration)
}

func newAnthropicMessagesStreamRequest(model string) StreamRequest {
	return StreamRequest{
		Model:        model,
		SystemPrompt: "system-marker",
		Messages: []Message{
			{
				Role:       RoleUser,
				Content:    "question-marker",
				ToolCalls:  nil,
				ToolCallID: "",
				ToolName:   "",
			},
		},
		Tools: []ToolDefinition{
			{
				Name:        "search-marker",
				Description: "description-marker",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{"query": map[string]any{"type": "string"}},
					"required":   []string{"query"},
				},
			},
		},
	}
}

func collectAnthropicMessagesEvents(ch <-chan Event) collectedAnthropicMessagesEvents {
	var result collectedAnthropicMessagesEvents

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

func writeAnthropicMessagesStream(t *testing.T, w http.ResponseWriter) {
	t.Helper()

	events := []struct {
		typeName string
		data     string
	}{
		{
			typeName: "content_block_delta",
			data: `{"type":"content_block_delta","index":0,` +
				`"delta":{"type":"text_delta","text":"hello"}}`,
		},
		{
			typeName: "content_block_start",
			data: `{"type":"content_block_start","index":1,` +
				`"content_block":{"type":"tool_use","id":"toolu_1",` +
				`"name":"search-marker","input":{}}}`,
		},
		{
			typeName: "content_block_delta",
			data: `{"type":"content_block_delta","index":1,` +
				`"delta":{"type":"input_json_delta","partial_json":"{\"query\":\"weather\"}"}}`,
		},
		{typeName: "content_block_stop", data: `{"type":"content_block_stop","index":1}`},
		{
			typeName: "message_delta",
			data: `{"type":"message_delta","delta":{"stop_reason":"tool_use"},` +
				`"usage":{"output_tokens":1}}`,
		},
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.WriteHeader(http.StatusOK)

	for _, event := range events {
		if _, err := fmt.Fprintf(
			w,
			"event: %s\ndata: %s\n\n",
			event.typeName,
			event.data,
		); err != nil {
			t.Errorf("write Anthropic event: %v", err)

			return
		}
	}
}

// This test changes process environment variables, so it cannot run in parallel.
func TestAnthropicMessagesWireContractIgnoresAmbientConfiguration(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "ambient-api-key-marker")
	t.Setenv("ANTHROPIC_AUTH_TOKEN", "ambient-auth-token-marker")
	t.Setenv("ANTHROPIC_BASE_URL", "https://ambient-base-url-marker.invalid")

	tests := []struct {
		name            string
		basePath        string
		headers         map[string]string
		wantPath        string
		wantVersion     string
		wantConfigured  map[string]string
		wantAbsentNames []string
	}{
		{
			name:            "headerless root gateway",
			basePath:        "",
			headers:         nil,
			wantPath:        "/v1/messages",
			wantVersion:     "2023-06-01",
			wantConfigured:  nil,
			wantAbsentNames: []string{"Authorization", "X-Api-Key", anthropicWorkspaceIDHeader},
		},
		{
			name:     "declared proxy path and headers",
			basePath: "/gateway",
			headers: map[string]string{
				"Authorization":              "Bearer configured-auth-marker",
				anthropicWorkspaceIDHeader:   "configured-workspace-marker",
				"anthropic-version":          "configured-version-marker",
				"X-Api-Key":                  "configured-api-key-marker",
				"X-Configured-Custom-Header": "configured-custom-marker",
			},
			wantPath:    "/gateway/v1/messages",
			wantVersion: "configured-version-marker",
			wantConfigured: map[string]string{
				"Authorization":              "Bearer configured-auth-marker",
				anthropicWorkspaceIDHeader:   "configured-workspace-marker",
				"X-Api-Key":                  "configured-api-key-marker",
				"X-Configured-Custom-Header": "configured-custom-marker",
			},
			wantAbsentNames: nil,
		},
	}

	// These subtests share the hostile process environment set above.
	//nolint:paralleltest // Go prohibits parallel descendants after t.Setenv.
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestCh := make(chan capturedAnthropicMessagesRequest, 1)
			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					body, err := io.ReadAll(r.Body)
					if err != nil {
						t.Errorf("read Anthropic request: %v", err)
					}

					requestCh <- capturedAnthropicMessagesRequest{
						path:   r.URL.Path,
						header: r.Header.Clone(),
						body:   string(body),
					}

					writeAnthropicMessagesStream(t, w)
				}),
			)
			t.Cleanup(server.Close)

			headers := mapsClone(test.headers)

			provider := mustAnthropicMessages(t, server.URL+test.basePath, headers)
			for name := range headers {
				headers[name] = "mutated-after-construction-marker"
			}

			gotEvents := collectAnthropicMessagesEvents(provider.StreamResponse(
				t.Context(),
				newAnthropicMessagesStreamRequest("claude-model-marker"),
			))
			if gotEvents.err != nil {
				t.Fatalf("stream Anthropic response: %v", gotEvents.err)
			}

			if gotEvents.content != "hello" {
				t.Errorf("content = %q, want hello", gotEvents.content)
			}

			wantTools := []ToolCall{
				{ID: "toolu_1", Name: "search-marker", Arguments: `{"query":"weather"}`},
			}
			if diff := cmp.Diff(wantTools, gotEvents.tools); diff != "" {
				t.Errorf("tool calls mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff([]string{StopReasonToolUse}, gotEvents.stopReasons); diff != "" {
				t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
			}

			captured := <-requestCh
			if captured.path != test.wantPath {
				t.Errorf("path = %q, want %q", captured.path, test.wantPath)
			}

			if got := captured.header.Get("anthropic-version"); got != test.wantVersion {
				t.Errorf("anthropic-version = %q, want %q", got, test.wantVersion)
			}

			for name, want := range test.wantConfigured {
				if got := captured.header.Values(name); !cmp.Equal(got, []string{want}) {
					t.Errorf("header %q = %q, want one value %q", name, got, want)
				}
			}

			for _, name := range test.wantAbsentNames {
				if got := captured.header.Get(name); got != "" {
					t.Errorf("unexpected header %q value %q", name, got)
				}
			}

			for _, marker := range []string{
				"claude-model-marker",
				"system-marker",
				"question-marker",
				"search-marker",
				"description-marker",
			} {
				if !strings.Contains(captured.body, marker) {
					t.Errorf("request body does not contain %q: %s", marker, captured.body)
				}
			}

			for _, ambientMarker := range []string{
				"ambient-api-key-marker",
				"ambient-auth-token-marker",
				"ambient-base-url-marker",
				"mutated-after-construction-marker",
			} {
				if strings.Contains(captured.body, ambientMarker) ||
					strings.Contains(fmt.Sprint(captured.header), ambientMarker) {
					t.Errorf("request exposed undeclared marker %q", ambientMarker)
				}
			}
		})
	}
}

func mapsClone(input map[string]string) map[string]string {
	if input == nil {
		return nil
	}

	cloned := make(map[string]string, len(input))
	maps.Copy(cloned, input)

	return cloned
}

func TestAnthropicMessagesConfigurationAndRegistry(t *testing.T) {
	t.Parallel()

	t.Run("registry builds concrete configured adapter", func(t *testing.T) {
		t.Parallel()

		raw := anthropicProviderDeclarationJSON(
			"anthropic.primary",
			"http://[::1]:8080/proxy",
			`,"headers":{"Authorization":"Bearer configured"}`,
		)

		registry, typesByName, err := BuildConfiguredProviders(t.Context(), raw)
		if err != nil {
			t.Fatalf("build configured providers: %v", err)
		}

		if _, ok := registry["anthropic.primary"].(*anthropicMessages); !ok {
			t.Errorf(
				"provider has concrete type %T, want *anthropicMessages",
				registry["anthropic.primary"],
			)
		}

		wantTypes := map[string]string{"anthropic.primary": providerTypeAnthropicMessages}
		if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
			t.Errorf("provider type metadata mismatch (-want +got):\n%s", diff)
		}
	})

	tests := []struct {
		name       string
		baseURL    string
		headerJSON string
	}{
		{name: "empty base URL", baseURL: "", headerJSON: ""},
		{name: "messages operation", baseURL: "https://example.com/messages", headerJSON: ""},
		{
			name:       "messages operation trailing slash",
			baseURL:    "https://example.com/messages/",
			headerJSON: "",
		},
		{name: "versioned operation", baseURL: "https://example.com/v1/messages", headerJSON: ""},
		{name: "version segment", baseURL: "https://example.com/v1", headerJSON: ""},
		{
			name:       "version segment trailing slash",
			baseURL:    "https://example.com/v1/",
			headerJSON: "",
		},
		{
			name:       "SDK-owned header",
			baseURL:    "https://example.com",
			headerJSON: `,"headers":{"X-Stainless-Secret":"secret-header-marker"}`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			raw := anthropicProviderDeclarationJSON("anthropic", test.baseURL, test.headerJSON)

			registry, typesByName, err := BuildConfiguredProviders(t.Context(), raw)
			if !errors.Is(err, errInvalidAgentProviderConfiguration) {
				t.Fatalf("error = %v, want provider configuration error", err)
			}

			if registry != nil || typesByName != nil {
				t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
			}

			for _, marker := range []string{test.baseURL, "secret-header-marker"} {
				if marker != "" && strings.Contains(err.Error(), marker) {
					t.Errorf("error exposed rejected configuration marker %q: %v", marker, err)
				}
			}
		})
	}
}

func anthropicProviderDeclarationJSON(name, baseURL, headersSuffix string) string {
	return fmt.Sprintf(
		`[{"name":%q,"type":%q,"configuration":{"base_url":%q%s}}]`,
		name,
		providerTypeAnthropicMessages,
		baseURL,
		headersSuffix,
	)
}

func TestAnthropicMessagesExplicitRetryCount(t *testing.T) {
	t.Parallel()

	var requestCount atomic.Int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		count := requestCount.Add(1)
		if count <= anthropicMessagesMaxRetries {
			w.Header().Set("Retry-After-Ms", "0")
			w.WriteHeader(http.StatusInternalServerError)
			writeAnthropicMessagesResponse(
				t,
				w,
				`{"type":"error","error":{"message":"retry-marker"}}`,
			)

			return
		}

		writeAnthropicMessagesStream(t, w)
	}))
	t.Cleanup(server.Close)

	provider := mustAnthropicMessages(t, server.URL, nil)

	got := collectAnthropicMessagesEvents(provider.StreamResponse(
		t.Context(),
		newAnthropicMessagesStreamRequest("retry-model"),
	))
	if got.err != nil {
		t.Fatalf("stream after retries: %v", got.err)
	}

	wantRequests := int64(anthropicMessagesMaxRetries + 1)
	if requestCount.Load() != wantRequests {
		t.Errorf("request count = %d, want %d", requestCount.Load(), wantRequests)
	}
}

func TestAnthropicMessagesRefusesRedirects(t *testing.T) {
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

			if got := r.Header.Values("Authorization"); !cmp.Equal(got, []string{headerValue}) {
				t.Errorf("source authorization = %q, want one configured value", got)
			}

			http.Redirect(w, r, redirectTarget.URL+"/stolen", http.StatusTemporaryRedirect)
		}),
	)
	t.Cleanup(redirectSource.Close)

	provider := mustAnthropicMessages(
		t,
		redirectSource.URL,
		map[string]string{"Authorization": headerValue},
	)
	got := collectAnthropicMessagesEvents(provider.StreamResponse(
		t.Context(),
		newAnthropicMessagesStreamRequest("redirect-model"),
	))
	assertSafeAnthropicMessagesError(t, got.err, headerValue, redirectTarget.URL)

	if sourceRequests.Load() != 1 {
		t.Errorf("source requests = %d, want 1", sourceRequests.Load())
	}

	if redirectedRequests.Load() != 0 {
		t.Errorf("redirect target requests = %d, want 0", redirectedRequests.Load())
	}
}

func TestAnthropicMessagesFailuresAreSafe(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		serve     func(*testing.T, http.ResponseWriter)
		wantError string
	}{
		{
			name: "HTTP status",
			serve: func(t *testing.T, w http.ResponseWriter) {
				t.Helper()

				w.WriteHeader(http.StatusUnauthorized)
				writeAnthropicMessagesResponse(
					t,
					w,
					`{"type":"error","error":{"message":"body-secret-marker"}}`,
				)
			},
			wantError: errAnthropicMessagesRequest.Error() + ": HTTP status 401",
		},
		{
			name: "stream error payload",
			serve: func(t *testing.T, w http.ResponseWriter) {
				t.Helper()

				w.Header().Set("Content-Type", "text/event-stream")
				w.WriteHeader(http.StatusOK)
				writeAnthropicMessagesResponse(
					t,
					w,
					"event: error\ndata: {\"type\":\"error\",\"message\":\"body-secret-marker\"}\n\n",
				)
			},
			wantError: errAnthropicMessagesRequest.Error(),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, _ *http.Request) { test.serve(t, w) },
			))
			t.Cleanup(server.Close)

			provider := mustAnthropicMessages(
				t,
				server.URL+"/url-secret-marker",
				map[string]string{"Authorization": "Bearer header-secret-marker"},
			)
			got := collectAnthropicMessagesEvents(provider.StreamResponse(
				t.Context(),
				newAnthropicMessagesStreamRequest("failure-model"),
			))

			if got.err == nil || got.err.Error() != test.wantError {
				t.Fatalf("error = %v, want %q", got.err, test.wantError)
			}

			assertSafeAnthropicMessagesError(
				t,
				got.err,
				"body-secret-marker",
				"url-secret-marker",
				"header-secret-marker",
			)
		})
	}

	t.Run("transport error", func(t *testing.T) {
		t.Parallel()

		provider := mustAnthropicMessages(
			t,
			"https://example.com/url-secret-marker",
			map[string]string{"Authorization": "Bearer header-secret-marker"},
		)
		provider.messages.Options = append(
			slices.Clone(provider.messages.Options),
			option.WithHTTPClient(&http.Client{
				Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
					return nil, fmt.Errorf(
						"transport body-secret-marker: %w",
						errInvalidProviderHeaders,
					)
				}),
				CheckRedirect: nil,
				Jar:           nil,
				Timeout:       0,
			}),
			option.WithMaxRetries(0),
		)

		got := collectAnthropicMessagesEvents(provider.StreamResponse(
			t.Context(),
			newAnthropicMessagesStreamRequest("failure-model"),
		))
		assertSafeAnthropicMessagesError(
			t,
			got.err,
			"body-secret-marker",
			"url-secret-marker",
			"header-secret-marker",
		)
	})
}

func writeAnthropicMessagesResponse(t *testing.T, w io.Writer, response string) {
	t.Helper()

	if _, err := io.WriteString(w, response); err != nil {
		t.Errorf("write Anthropic response: %v", err)
	}
}

func assertSafeAnthropicMessagesError(t *testing.T, err error, markers ...string) {
	t.Helper()

	if !errors.Is(err, errAnthropicMessagesRequest) {
		t.Fatalf("error = %v, want fixed Anthropic Messages request error", err)
	}

	for _, marker := range markers {
		if strings.Contains(err.Error(), marker) {
			t.Errorf("error exposed marker %q: %v", marker, err)
		}
	}
}

type anthropicMessagesCloseErrorBody struct {
	io.Reader
}

func (anthropicMessagesCloseErrorBody) Close() error {
	return fmt.Errorf("close secret-marker: %w", errInvalidProviderHeaders)
}

// This test replaces the process-wide logger, so it cannot run in parallel.
//
//nolint:paralleltest // Parallel execution could capture another test's logs.
func TestAnthropicMessagesCloseErrorsAreSafe(t *testing.T) {
	oldLogger := slog.Default()

	var logOutput bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&logOutput, nil)))
	t.Cleanup(func() { slog.SetDefault(oldLogger) })

	provider := mustAnthropicMessages(t, "https://example.com/url-secret-marker", nil)
	provider.messages.Options = append(
		slices.Clone(provider.messages.Options),
		option.WithHTTPClient(&http.Client{
			Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
					Body:       anthropicMessagesCloseErrorBody{Reader: strings.NewReader("")},
					Request:    request,
				}, nil
			}),
			CheckRedirect: nil,
			Jar:           nil,
			Timeout:       0,
		}),
		option.WithMaxRetries(0),
	)

	got := collectAnthropicMessagesEvents(provider.StreamResponse(
		t.Context(),
		newAnthropicMessagesStreamRequest("close-model"),
	))
	if got.err != nil {
		t.Fatalf("unexpected stream error: %v", got.err)
	}

	if strings.Contains(logOutput.String(), "secret-marker") ||
		strings.Contains(logOutput.String(), "url-secret-marker") {
		t.Fatalf("close log exposed a marker: %s", logOutput.String())
	}

	if !strings.Contains(logOutput.String(), errAnthropicMessagesRequest.Error()) {
		t.Errorf("close log does not contain safe category: %s", logOutput.String())
	}
}

func TestAnthropicMessagesCancellationClosesChannel(t *testing.T) {
	t.Parallel()

	requestStarted := make(chan struct{})
	releaseHandler := make(chan struct{})

	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(requestStarted)

		select {
		case <-r.Context().Done():
		case <-releaseHandler:
		}
	}))
	t.Cleanup(server.Close)

	var releaseOnce sync.Once

	release := func() { releaseOnce.Do(func() { close(releaseHandler) }) }
	t.Cleanup(release)

	provider := mustAnthropicMessages(t, server.URL, nil)
	ctx, cancel := context.WithCancel(t.Context())
	events := provider.StreamResponse(ctx, newAnthropicMessagesStreamRequest("cancel-model"))

	select {
	case <-requestStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Anthropic request")
	}

	cancel()

	select {
	case event, ok := <-events:
		if ok {
			t.Errorf("unexpected event after cancellation: %#v", event)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Anthropic event channel to close")
	}

	release()
}

func TestAnthropicMessagesConcurrentInstancesAreIsolated(t *testing.T) {
	t.Parallel()

	type instance struct {
		name       string
		model      string
		header     string
		basePath   string
		provider   *anthropicMessages
		capturedCh chan capturedAnthropicMessagesRequest
	}

	instances := make([]instance, 0, 2)
	for _, specification := range []struct {
		name     string
		model    string
		header   string
		basePath string
	}{
		{name: "one", model: "model-one", header: "header-one", basePath: "/one"},
		{name: "two", model: "model-two", header: "header-two", basePath: "/two"},
	} {
		capturedCh := make(chan capturedAnthropicMessagesRequest, 1)
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Errorf("read isolated request: %v", err)
			}

			capturedCh <- capturedAnthropicMessagesRequest{
				path:   r.URL.Path,
				header: r.Header.Clone(),
				body:   string(body),
			}

			writeAnthropicMessagesStream(t, w)
		}))
		t.Cleanup(server.Close)

		instances = append(instances, instance{
			name:     specification.name,
			model:    specification.model,
			header:   specification.header,
			basePath: specification.basePath,
			provider: mustAnthropicMessages(
				t,
				server.URL+specification.basePath,
				map[string]string{"X-Instance": specification.header},
			),
			capturedCh: capturedCh,
		})
	}

	var waitGroup sync.WaitGroup
	for index := range instances {
		waitGroup.Go(func() {
			got := collectAnthropicMessagesEvents(instances[index].provider.StreamResponse(
				t.Context(),
				newAnthropicMessagesStreamRequest(instances[index].model),
			))
			if got.err != nil {
				t.Errorf("instance %s stream error: %v", instances[index].name, got.err)
			}
		})
	}

	waitGroup.Wait()

	for _, instance := range instances {
		captured := <-instance.capturedCh
		if captured.path != instance.basePath+"/v1/messages" {
			t.Errorf("instance %s path = %q", instance.name, captured.path)
		}

		if got := captured.header.Get("X-Instance"); got != instance.header {
			t.Errorf("instance %s header = %q, want %q", instance.name, got, instance.header)
		}

		if !strings.Contains(captured.body, instance.model) {
			t.Errorf("instance %s body does not contain model %q", instance.name, instance.model)
		}

		for _, other := range instances {
			if other.name == instance.name {
				continue
			}

			if strings.Contains(captured.body, other.model) ||
				captured.header.Get("X-Instance") == other.header {
				t.Errorf(
					"instance %s request contains instance %s configuration",
					instance.name,
					other.name,
				)
			}
		}
	}
}

func TestAnthropicMessagesConcurrentStreams(t *testing.T) {
	t.Parallel()

	const streamCount = 12

	requestModels := make(chan string, streamCount)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode concurrent Anthropic request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		requestModels <- request.Model

		writeAnthropicMessagesStream(t, w)
	}))
	t.Cleanup(server.Close)

	anthropicMessages := mustAnthropicMessages(
		t,
		server.URL,
		map[string]string{"X-Shared": "shared-config"},
	)

	results := make(chan collectedAnthropicMessagesEvents, streamCount)
	wantModels := make([]string, 0, streamCount)

	var waitGroup sync.WaitGroup
	for index := range streamCount {
		model := fmt.Sprintf("claude-model-%d", index)
		wantModels = append(wantModels, model)

		waitGroup.Go(func() {
			results <- collectAnthropicMessagesEvents(anthropicMessages.StreamResponse(
				context.Background(),
				newAnthropicMessagesStreamRequest(model),
			))
		})
	}

	waitGroup.Wait()
	close(results)
	close(requestModels)

	for result := range results {
		if result.err != nil {
			t.Errorf("concurrent Anthropic stream error: %v", result.err)
		}

		if result.content != "hello" {
			t.Errorf("content = %q, want hello", result.content)
		}

		if diff := cmp.Diff([]string{StopReasonToolUse}, result.stopReasons); diff != "" {
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

func TestAnthropicMessagesRequestBodyIsJSON(t *testing.T) {
	t.Parallel()

	requestCh := make(chan []byte, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}

		requestCh <- body

		writeAnthropicMessagesStream(t, w)
	}))
	t.Cleanup(server.Close)

	provider := mustAnthropicMessages(t, server.URL, nil)

	got := collectAnthropicMessagesEvents(provider.StreamResponse(
		t.Context(),
		newAnthropicMessagesStreamRequest("json-model"),
	))
	if got.err != nil {
		t.Fatalf("stream Anthropic response: %v", got.err)
	}

	var payload map[string]any
	if err := json.Unmarshal(<-requestCh, &payload); err != nil {
		t.Fatalf("decode request JSON: %v", err)
	}

	if payload["model"] != "json-model" || payload["stream"] != true {
		t.Errorf("unexpected request payload: %#v", payload)
	}
}
