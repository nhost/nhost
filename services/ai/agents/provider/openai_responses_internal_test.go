package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

type responsesWireInputItem struct {
	Type             string `json:"type"`
	Role             string `json:"role"`
	Content          string `json:"content"`
	ID               string `json:"id"`
	CallID           string `json:"call_id"`
	Name             string `json:"name"`
	Arguments        string `json:"arguments"`
	Output           string `json:"output"`
	EncryptedContent string `json:"encrypted_content"`
	Status           string `json:"status"`
}

type responsesWireTool struct {
	Type        string         `json:"type"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
	Strict      *bool          `json:"strict"`
}

type responsesWireRequest struct {
	Model        string                   `json:"model"`
	Instructions string                   `json:"instructions"`
	Include      []string                 `json:"include"`
	Input        []responsesWireInputItem `json:"input"`
	Tools        []responsesWireTool      `json:"tools"`
	Store        *bool                    `json:"store"`
	Stream       bool                     `json:"stream"`
}

type capturedResponsesRequest struct {
	method        string
	path          string
	authorization []string
	body          responsesWireRequest
	err           error
}

type collectedResponsesEvents struct {
	content     string
	toolStarts  []string
	toolDeltas  int
	tools       []ToolCall
	stopReasons []string
	err         error
}

func collectResponsesEvents(ch <-chan Event) collectedResponsesEvents {
	var result collectedResponsesEvents

	for event := range ch {
		switch event.Type {
		case EventContentDelta:
			result.content += event.Content
		case EventToolUseStart:
			if event.ToolCall != nil {
				result.toolStarts = append(result.toolStarts, event.ToolCall.Name)
			}
		case EventToolUseDelta:
			result.toolDeltas++
		case EventToolUseDone:
			if event.ToolCall != nil {
				result.tools = append(result.tools, *event.ToolCall)
			}
		case EventComplete:
			result.stopReasons = append(result.stopReasons, event.StopReason)
		case EventError:
			result.err = event.Error
		}
	}

	return result
}

func mustOpenAIResponses(
	t *testing.T,
	baseURL string,
	headers map[string]string,
) *openAIResponses {
	t.Helper()

	configuration, err := newOpenAIResponsesConfiguration(baseURL, headers)
	if err != nil {
		t.Fatalf("create configuration: %v", err)
	}

	return newOpenAIResponses(configuration)
}

func writeResponsesEvents(t *testing.T, w http.ResponseWriter, events []string) {
	t.Helper()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	flusher, ok := w.(http.Flusher)
	if !ok {
		t.Error("response writer does not support flushing")

		return
	}

	w.WriteHeader(http.StatusOK)

	for _, event := range events {
		if _, err := fmt.Fprintf(w, "data: %s\n\n", event); err != nil {
			t.Errorf("write event: %v", err)

			return
		}

		flusher.Flush()
	}

	if _, err := fmt.Fprint(w, "data: [DONE]\n\n"); err != nil {
		t.Errorf("write done event: %v", err)

		return
	}

	flusher.Flush()
}

func completedResponsesEvent() string {
	return `{"type":"response.completed","sequence_number":6,"response":{"id":"resp_1","status":"completed","output":[]}}`
}

func TestOpenAIResponsesWireContract(t *testing.T) {
	t.Parallel()

	requestCh := make(chan capturedResponsesRequest, 1)
	events := []string{
		`{"type":"response.output_text.delta","sequence_number":1,"item_id":"msg_1","output_index":0,"content_index":0,"delta":"hello "}`,
		`{"type":"response.output_item.added","sequence_number":2,"output_index":1,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"","status":"in_progress"}}`,
		`{"type":"response.function_call_arguments.delta","sequence_number":3,"item_id":"fc_1","output_index":1,"delta":"{\"q\":\"weather\"}"}`,
		`{"type":"response.function_call_arguments.done","sequence_number":4,"item_id":"fc_1","output_index":1,"arguments":"{\"q\":\"weather\"}"}`,
		`{"type":"response.output_item.done","sequence_number":5,"output_index":1,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"{\"q\":\"weather\"}","status":"completed"}}`,
		completedResponsesEvent(),
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body responsesWireRequest

		err := json.NewDecoder(r.Body).Decode(&body)
		requestCh <- capturedResponsesRequest{
			method:        r.Method,
			path:          r.URL.Path,
			authorization: append([]string(nil), r.Header.Values("Authorization")...),
			body:          body,
			err:           err,
		}

		writeResponsesEvents(t, w, events)
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(t, server.URL+"/compat", nil)
	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:        "gpt-5",
		SystemPrompt: "be concise",
		Messages: []Message{
			{Role: RoleUser, Content: "find the weather"},
			{
				Role:    RoleAssistant,
				Content: "checking",
				ToolCalls: []ToolCall{
					{ID: "previous_call", Name: "search", Arguments: `{"q":"yesterday"}`},
				},
			},
			{
				Role:       RoleTool,
				Content:    "sunny",
				ToolCallID: "previous_call",
				ToolName:   "search",
			},
		},
		Tools: []ToolDefinition{
			{
				Name:        "search",
				Description: "Search the web",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"q": map[string]any{"type": "string"},
					},
				},
			},
		},
	}))

	request := <-requestCh
	if request.err != nil {
		t.Fatalf("decode request: %v", request.err)
	}

	if request.method != http.MethodPost {
		t.Errorf("method = %q, want POST", request.method)
	}

	if request.path != "/compat/responses" {
		t.Errorf("path = %q, want /compat/responses", request.path)
	}

	if len(request.authorization) != 0 {
		t.Errorf("unexpected authorization headers: %q", request.authorization)
	}

	if request.body.Model != "gpt-5" {
		t.Errorf("model = %q, want gpt-5", request.body.Model)
	}

	if request.body.Instructions != "be concise" {
		t.Errorf("instructions = %q, want be concise", request.body.Instructions)
	}

	if !request.body.Stream {
		t.Error("stream was not true")
	}

	if request.body.Store == nil || *request.body.Store {
		t.Errorf("store = %v, want explicit false", request.body.Store)
	}

	wantInclude := []string{"reasoning.encrypted_content"}
	if diff := cmp.Diff(wantInclude, request.body.Include); diff != "" {
		t.Errorf("include mismatch (-want +got):\n%s", diff)
	}

	wantInput := []responsesWireInputItem{
		{Type: "", Role: RoleUser, Content: "find the weather"},
		{Type: "", Role: RoleAssistant, Content: "checking"},
		{
			Type:      "function_call",
			CallID:    "previous_call",
			Name:      "search",
			Arguments: `{"q":"yesterday"}`,
		},
		{Type: "function_call_output", CallID: "previous_call", Output: "sunny"},
	}
	if diff := cmp.Diff(wantInput, request.body.Input); diff != "" {
		t.Errorf("input mismatch (-want +got):\n%s", diff)
	}

	if len(request.body.Tools) != 1 {
		t.Fatalf("tools length = %d, want 1", len(request.body.Tools))
	}

	tool := request.body.Tools[0]
	if tool.Type != "function" || tool.Name != "search" ||
		tool.Description != "Search the web" {
		t.Errorf("unexpected tool: %+v", tool)
	}

	if tool.Strict == nil || *tool.Strict {
		t.Errorf("tool strict = %v, want explicit false", tool.Strict)
	}

	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	if got.content != "hello " {
		t.Errorf("content = %q, want %q", got.content, "hello ")
	}

	if diff := cmp.Diff([]string{"search"}, got.toolStarts); diff != "" {
		t.Errorf("tool starts mismatch (-want +got):\n%s", diff)
	}

	if got.toolDeltas != 1 {
		t.Errorf("tool deltas = %d, want 1", got.toolDeltas)
	}

	wantTools := []ToolCall{{
		ID: "call_1", Name: "search", Arguments: `{"q":"weather"}`,
	}}
	if diff := cmp.Diff(wantTools, got.tools); diff != "" {
		t.Errorf("tool calls mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]string{StopReasonToolUse}, got.stopReasons); diff != "" {
		t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenAIResponsesPreservesReasoningForToolContinuation(t *testing.T) {
	t.Parallel()

	requests := make(chan responsesWireRequest, 2)

	var requestCount atomic.Int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request responsesWireRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		requests <- request

		if requestCount.Add(1) == 1 {
			writeResponsesEvents(t, w, []string{
				`{"type":"response.output_item.done","sequence_number":1,"output_index":0,"item":{"id":"rs_1","type":"reasoning","encrypted_content":"encrypted-reasoning-marker","summary":[],"status":"completed"}}`,
				`{"type":"response.output_item.added","sequence_number":2,"output_index":1,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"","status":"in_progress"}}`,
				`{"type":"response.function_call_arguments.done","sequence_number":3,"item_id":"fc_1","output_index":1,"arguments":"{\"q\":\"weather\"}"}`,
				`{"type":"response.output_item.done","sequence_number":4,"output_index":1,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"{\"q\":\"weather\"}","status":"completed"}}`,
				completedResponsesEvent(),
			})

			return
		}

		writeResponsesEvents(t, w, []string{completedResponsesEvent()})
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(t, server.URL+"/v1", nil)

	first := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "find the weather"}},
		Tools: []ToolDefinition{{
			Name: "search", Description: "Search", Parameters: map[string]any{},
		}},
	}))
	if first.err != nil {
		t.Fatalf("first response: %v", first.err)
	}

	if len(first.tools) != 1 {
		t.Fatalf("first response tool count = %d, want 1", len(first.tools))
	}

	if len(first.tools[0].ProviderMetadata) == 0 {
		t.Fatal("reasoning metadata was not attached to the tool call")
	}

	persistedToolCalls, err := json.Marshal(first.tools)
	if err != nil {
		t.Fatalf("marshal persisted tool calls: %v", err)
	}

	var reloadedToolCalls []ToolCall
	if err := json.Unmarshal(persistedToolCalls, &reloadedToolCalls); err != nil {
		t.Fatalf("unmarshal persisted tool calls: %v", err)
	}

	second := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model: "gpt-5",
		Messages: []Message{
			{Role: RoleUser, Content: "find the weather"},
			{Role: RoleAssistant, ToolCalls: reloadedToolCalls},
			{Role: RoleTool, Content: "sunny", ToolCallID: "call_1", ToolName: "search"},
		},
		Tools: []ToolDefinition{{
			Name: "search", Description: "Search", Parameters: map[string]any{},
		}},
	}))
	if second.err != nil {
		t.Fatalf("second response: %v", second.err)
	}

	<-requests

	secondRequest := <-requests
	if len(secondRequest.Input) != 4 {
		t.Fatalf("second input length = %d, want 4", len(secondRequest.Input))
	}

	reasoning := secondRequest.Input[1]
	if reasoning.Type != "reasoning" || reasoning.ID != "rs_1" ||
		reasoning.EncryptedContent != "encrypted-reasoning-marker" ||
		reasoning.Status != "completed" {
		t.Errorf("unexpected reasoning continuation item: %+v", reasoning)
	}

	if secondRequest.Input[2].Type != "function_call" ||
		secondRequest.Input[2].CallID != "call_1" {
		t.Errorf("unexpected function call continuation: %+v", secondRequest.Input[2])
	}

	if secondRequest.Input[3].Type != "function_call_output" ||
		secondRequest.Input[3].CallID != "call_1" || secondRequest.Input[3].Output != "sunny" {
		t.Errorf("unexpected function output continuation: %+v", secondRequest.Input[3])
	}
}

func TestOpenAIResponsesBaseURLJoiningAndValidation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		basePath string
		wantPath string
	}{
		{name: "root", basePath: "", wantPath: "/responses"},
		{name: "v1", basePath: "/v1", wantPath: "/v1/responses"},
		{name: "v1 slash", basePath: "/v1/", wantPath: "/v1/responses"},
		{name: "gateway", basePath: "/gateway", wantPath: "/gateway/responses"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			pathCh := make(chan string, 1)
			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					pathCh <- r.URL.Path

					writeResponsesEvents(t, w, []string{completedResponsesEvent()})
				},
			))
			t.Cleanup(server.Close)

			provider := mustOpenAIResponses(t, server.URL+test.basePath, nil)

			got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
				Model:    "gpt-5",
				Messages: []Message{{Role: RoleUser, Content: "hi"}},
			}))
			if got.err != nil {
				t.Fatalf("unexpected provider error: %v", got.err)
			}

			if gotPath := <-pathCh; gotPath != test.wantPath {
				t.Errorf("path = %q, want %q", gotPath, test.wantPath)
			}
		})
	}

	invalidURLs := []string{
		"https://api.openai.com/v1/responses",
		"https://api.openai.com/v1/responses/",
	}
	for _, baseURL := range invalidURLs {
		if _, err := newOpenAIResponsesConfiguration(baseURL, nil); !errors.Is(
			err,
			errInvalidProviderBaseURL,
		) {
			t.Errorf("configuration error for %q = %v, want invalid URL", baseURL, err)
		}
	}
}

func TestOpenAIResponsesTerminalEvents(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		events      []string
		wantContent string
		wantReason  string
		wantTools   []ToolCall
		wantError   bool
	}{
		{
			name:       "completed",
			events:     []string{completedResponsesEvent()},
			wantReason: StopReasonEndTurn,
		},
		{
			name: "refusal",
			events: []string{
				`{"type":"response.refusal.delta","sequence_number":1,"item_id":"msg_1","output_index":0,"content_index":0,"delta":"cannot comply"}`,
				completedResponsesEvent(),
			},
			wantContent: "cannot comply",
			wantReason:  StopReasonRefusal,
		},
		{
			name: "maximum output tokens",
			events: []string{
				`{"type":"response.incomplete","sequence_number":1,"response":{"id":"resp_1","status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}`,
			},
			wantReason: StopReasonMaxTokens,
		},
		{
			name: "content filter",
			events: []string{
				`{"type":"response.incomplete","sequence_number":1,"response":{"id":"resp_1","status":"incomplete","incomplete_details":{"reason":"content_filter"}}}`,
			},
			wantReason: StopReasonRefusal,
		},
		{
			name: "incomplete function call is not finalized",
			events: []string{
				`{"type":"response.output_item.added","sequence_number":1,"output_index":0,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"","status":"in_progress"}}`,
				`{"type":"response.function_call_arguments.delta","sequence_number":2,"item_id":"fc_1","output_index":0,"delta":"{\"q\":"}`,
				`{"type":"response.output_item.done","sequence_number":3,"output_index":0,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"search","arguments":"{\"q\":","status":"incomplete"}}`,
				`{"type":"response.incomplete","sequence_number":4,"response":{"id":"resp_1","status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}`,
			},
			wantReason: StopReasonMaxTokens,
		},
		{
			name: "missing terminal event",
			events: []string{
				`{"type":"response.output_text.delta","sequence_number":1,"item_id":"msg_1","output_index":0,"content_index":0,"delta":"partial"}`,
			},
			wantContent: "partial",
			wantError:   true,
		},
		{
			name: "failed",
			events: []string{
				`{"type":"response.failed","sequence_number":1,"response":{"id":"resp_1","status":"failed","error":{"code":"server_error","message":"secret-marker"}}}`,
			},
			wantError: true,
		},
		{
			name: "error event",
			events: []string{
				`{"type":"error","sequence_number":1,"code":"server_error","message":"secret-marker","param":"input"}`,
			},
			wantError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, _ *http.Request) {
					writeResponsesEvents(t, w, test.events)
				},
			))
			t.Cleanup(server.Close)

			provider := mustOpenAIResponses(t, server.URL+"/v1", nil)
			got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
				Model:    "gpt-5",
				Messages: []Message{{Role: RoleUser, Content: "hi"}},
			}))

			if got.content != test.wantContent {
				t.Errorf("content = %q, want %q", got.content, test.wantContent)
			}

			if test.wantError {
				if !errors.Is(got.err, errOpenAIResponsesRequest) {
					t.Fatalf("error = %v, want fixed Responses error", got.err)
				}

				if strings.Contains(got.err.Error(), "secret-marker") {
					t.Errorf("error exposed upstream marker: %v", got.err)
				}

				return
			}

			if got.err != nil {
				t.Fatalf("unexpected provider error: %v", got.err)
			}

			if diff := cmp.Diff(test.wantTools, got.tools); diff != "" {
				t.Errorf("tool calls mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff([]string{test.wantReason}, got.stopReasons); diff != "" {
				t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestOpenAIResponsesHTTPStatusErrorsAreSafe(t *testing.T) {
	t.Parallel()

	const (
		headerMarker = "status-header-marker"
		urlMarker    = "status-url-marker"
		bodyMarker   = "status-body-marker"
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)

		if _, err := io.WriteString(
			w,
			`{"error":{"message":"`+bodyMarker+`"}}`,
		); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(
		t,
		server.URL+"/"+urlMarker,
		map[string]string{"Authorization": "Bearer " + headerMarker},
	)
	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	}))

	if !errors.Is(got.err, errOpenAIResponsesRequest) {
		t.Fatalf("error = %v, want Responses request error", got.err)
	}

	want := "responses provider request failed: HTTP status 401"
	if got.err.Error() != want {
		t.Errorf("error = %q, want %q", got.err, want)
	}

	for _, marker := range []string{headerMarker, urlMarker, bodyMarker} {
		if strings.Contains(got.err.Error(), marker) {
			t.Errorf("error exposed marker %q: %v", marker, got.err)
		}
	}
}

// This test is intentionally non-parallel because t.Setenv changes process-wide
// SDK inputs. It proves the Responses service never loads native OpenAI defaults.
func TestOpenAIResponsesIgnoresAmbientOpenAIConfiguration(t *testing.T) {
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
	explicitServer := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			headersCh <- capturedHeaders{
				authorization: append([]string(nil), r.Header.Values("Authorization")...),
				organization:  append([]string(nil), r.Header.Values("OpenAI-Organization")...),
				project:       append([]string(nil), r.Header.Values("OpenAI-Project")...),
			}

			writeResponsesEvents(t, w, []string{completedResponsesEvent()})
		},
	))
	t.Cleanup(explicitServer.Close)

	provider := mustOpenAIResponses(t, explicitServer.URL+"/v1", nil)

	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	}))
	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	captured := <-headersCh
	if len(captured.authorization) != 0 || len(captured.organization) != 0 ||
		len(captured.project) != 0 {
		t.Errorf("ambient OpenAI headers reached Responses endpoint: %+v", captured)
	}

	if got := ambientRequests.Load(); got != 0 {
		t.Errorf("ambient endpoint received %d requests", got)
	}
}

func TestOpenAIResponsesConfiguredHeadersAreCopiedAndSetOnce(t *testing.T) {
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

		writeResponsesEvents(t, w, []string{completedResponsesEvent()})
	}))
	t.Cleanup(server.Close)

	headers := map[string]string{
		"Authorization": "Bearer configured-once",
		"X-Original":    "original-value",
	}

	configuration, err := newOpenAIResponsesConfiguration(server.URL+"/v1", headers)
	if err != nil {
		t.Fatalf("create configuration: %v", err)
	}

	headers["Authorization"] = "Bearer mutated"
	headers["X-Original"] = "mutated-value"

	provider := newOpenAIResponses(configuration)

	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	}))
	if got.err != nil {
		t.Fatalf("unexpected provider error: %v", got.err)
	}

	captured := <-headersCh
	if diff := cmp.Diff([]string{"original-value"}, captured.original); diff != "" {
		t.Errorf("X-Original mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]string{"Bearer configured-once"}, captured.authorization); diff != "" {
		t.Errorf("authorization mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenAIResponsesRefusesRedirects(t *testing.T) {
	t.Parallel()

	const headerValue = "Bearer redirect-secret-marker"

	var redirectedRequests atomic.Int64

	redirectTarget := httptest.NewServer(http.HandlerFunc(
		func(http.ResponseWriter, *http.Request) {
			redirectedRequests.Add(1)
		},
	))
	t.Cleanup(redirectTarget.Close)

	var sourceRequests atomic.Int64

	redirectSource := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			sourceRequests.Add(1)

			if got := r.Header.Values("Authorization"); !cmp.Equal(got, []string{headerValue}) {
				t.Errorf("source authorization = %q, want one configured value", got)
			}

			http.Redirect(w, r, redirectTarget.URL+"/stolen", http.StatusTemporaryRedirect)
		},
	))
	t.Cleanup(redirectSource.Close)

	provider := mustOpenAIResponses(
		t,
		redirectSource.URL+"/v1",
		map[string]string{"Authorization": headerValue},
	)
	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	}))

	if !errors.Is(got.err, errOpenAIResponsesRequest) {
		t.Fatalf("error = %v, want fixed Responses error", got.err)
	}

	if sourceRequests.Load() != 1 {
		t.Errorf("source requests = %d, want 1", sourceRequests.Load())
	}

	if redirectedRequests.Load() != 0 {
		t.Errorf("redirect target requests = %d, want 0", redirectedRequests.Load())
	}

	if strings.Contains(got.err.Error(), headerValue) ||
		strings.Contains(got.err.Error(), redirectTarget.URL) {
		t.Fatalf("error exposed redirect data: %v", got.err)
	}
}

func TestOpenAIResponsesRetryCountIsExplicit(t *testing.T) {
	t.Parallel()

	var requests atomic.Int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("Retry-After", "0")
		w.WriteHeader(http.StatusInternalServerError)

		if _, err := io.WriteString(
			w,
			`{"error":{"message":"response-secret-marker"}}`,
		); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(t, server.URL+"/v1", nil)
	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	}))

	if !errors.Is(got.err, errOpenAIResponsesRequest) {
		t.Fatalf("error = %v, want fixed Responses error", got.err)
	}

	if got := requests.Load(); got != openAIResponsesMaxRetries+1 {
		t.Errorf(
			"requests = %d, want initial request plus %d retries",
			got,
			openAIResponsesMaxRetries,
		)
	}

	if strings.Contains(got.err.Error(), "response-secret-marker") {
		t.Errorf("error exposed response body: %v", got.err)
	}
}

func TestOpenAIResponsesCancellationClosesStream(t *testing.T) {
	t.Parallel()

	requestCancelled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeResponsesEvents(t, w, []string{
			`{"type":"response.output_text.delta","sequence_number":1,"item_id":"msg_1","output_index":0,"content_index":0,"delta":"started"}`,
		})
		<-r.Context().Done()
		close(requestCancelled)
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(t, server.URL+"/v1", nil)
	ctx, cancel := context.WithCancel(context.Background())
	stream := provider.StreamResponse(ctx, StreamRequest{
		Model:    "gpt-5",
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	})

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

	for event := range stream {
		if event.Type == EventError && event.Error != nil &&
			!errors.Is(event.Error, context.Canceled) {
			t.Errorf("unexpected event after cancellation: %+v", event)
		}
	}
}

func TestOpenAIResponsesConcurrentStreams(t *testing.T) {
	t.Parallel()

	const streamCount = 12

	requestModels := make(chan string, streamCount)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request responsesWireRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		requestModels <- request.Model

		writeResponsesEvents(t, w, []string{
			`{"type":"response.output_text.delta","sequence_number":1,"item_id":"msg_1","output_index":0,"content_index":0,"delta":"ok"}`,
			completedResponsesEvent(),
		})
	}))
	t.Cleanup(server.Close)

	provider := mustOpenAIResponses(
		t,
		server.URL+"/v1",
		map[string]string{"X-Shared": "shared-config"},
	)

	results := make(chan collectedResponsesEvents, streamCount)
	wantModels := make([]string, 0, streamCount)

	var waitGroup sync.WaitGroup
	waitGroup.Add(streamCount)

	for index := range streamCount {
		model := fmt.Sprintf("gpt-5-%d", index)
		wantModels = append(wantModels, model)

		go func(requestModel string) {
			defer waitGroup.Done()

			results <- collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{
				Model:    requestModel,
				Messages: []Message{{Role: RoleUser, Content: "hi"}},
			}))
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

func TestOpenAIResponsesEmptyModel(t *testing.T) {
	t.Parallel()

	provider := mustOpenAIResponses(t, "https://api.openai.com/v1", nil)

	got := collectResponsesEvents(provider.StreamResponse(t.Context(), StreamRequest{}))
	if !errors.Is(got.err, ErrEmptyModel) {
		t.Fatalf("error = %v, want empty model", got.err)
	}
}
