package provider

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

const testWebSearchTool = "web_search"

func TestToOpenAIMessages(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		systemPrompt string
		messages     []Message
		wantLen      int
		checkSystem  bool
		checkUser    int
		checkAssist  int
		checkTool    int
	}{
		{
			name:    "empty with no system prompt",
			wantLen: 0,
		},
		{
			name:         "system prompt only",
			systemPrompt: "be helpful",
			wantLen:      1,
			checkSystem:  true,
		},
		{
			name:         "system prompt and user message",
			systemPrompt: "be helpful",
			messages: []Message{
				{Role: RoleUser, Content: "hello", ToolCalls: nil, ToolCallID: "", ToolName: ""},
			},
			wantLen:     2,
			checkSystem: true,
			checkUser:   1,
		},
		{
			name: "user message without system prompt",
			messages: []Message{
				{Role: RoleUser, Content: "hello", ToolCalls: nil, ToolCallID: "", ToolName: ""},
			},
			wantLen:   1,
			checkUser: 1,
		},
		{
			name: "assistant message without tool calls",
			messages: []Message{
				{Role: RoleAssistant, Content: "hi", ToolCalls: nil, ToolCallID: "", ToolName: ""},
			},
			wantLen:     1,
			checkAssist: 1,
		},
		{
			name: "assistant message with tool calls",
			messages: []Message{
				{
					Role:    RoleAssistant,
					Content: "searching",
					ToolCalls: []ToolCall{
						{ID: "tc1", Name: "search", Arguments: `{"q":"test"}`},
					},
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantLen:     1,
			checkAssist: 1,
		},
		{
			name: "tool message",
			messages: []Message{
				{
					Role:       RoleTool,
					Content:    "results",
					ToolCalls:  nil,
					ToolCallID: "tc1",
					ToolName:   "search",
				},
			},
			wantLen:   1,
			checkTool: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result := toOpenAIMessages(tc.systemPrompt, tc.messages)
			if len(result) != tc.wantLen {
				t.Fatalf("expected %d messages, got %d", tc.wantLen, len(result))
			}

			var sysCount, userCount, assistCount, toolCount int

			for _, m := range result {
				switch {
				case m.OfSystem != nil:
					sysCount++
				case m.OfUser != nil:
					userCount++
				case m.OfAssistant != nil:
					assistCount++
				case m.OfTool != nil:
					toolCount++
				}
			}

			if tc.checkSystem && sysCount != 1 {
				t.Errorf("expected 1 system message, got %d", sysCount)
			}

			if tc.checkUser != userCount {
				t.Errorf("expected %d user messages, got %d", tc.checkUser, userCount)
			}

			if tc.checkAssist != assistCount {
				t.Errorf("expected %d assistant messages, got %d", tc.checkAssist, assistCount)
			}

			if tc.checkTool != toolCount {
				t.Errorf("expected %d tool messages, got %d", tc.checkTool, toolCount)
			}
		})
	}
}

func TestToOpenAIMessagesAssistantWithToolCalls(t *testing.T) {
	t.Parallel()

	messages := []Message{
		{
			Role:    RoleAssistant,
			Content: "let me search",
			ToolCalls: []ToolCall{
				{ID: "tc1", Name: testWebSearchTool, Arguments: `{"query":"test"}`},
				{ID: "tc2", Name: "web_fetch", Arguments: `{"url":"https://example.com"}`},
			},
			ToolCallID: "",
			ToolName:   "",
		},
	}

	result := toOpenAIMessages("", messages)
	if len(result) != 1 {
		t.Fatalf("expected 1 message, got %d", len(result))
	}

	msg := result[0]
	if msg.OfAssistant == nil {
		t.Fatal("expected assistant message")
	}

	if len(msg.OfAssistant.ToolCalls) != 2 {
		t.Fatalf("expected 2 tool calls, got %d", len(msg.OfAssistant.ToolCalls))
	}

	if msg.OfAssistant.ToolCalls[0].ID != "tc1" {
		t.Errorf("expected tool call ID 'tc1', got %q", msg.OfAssistant.ToolCalls[0].ID)
	}

	if msg.OfAssistant.ToolCalls[0].Function.Name != testWebSearchTool {
		t.Errorf(
			"expected function name 'web_search', got %q",
			msg.OfAssistant.ToolCalls[0].Function.Name,
		)
	}

	if msg.OfAssistant.ToolCalls[1].ID != "tc2" {
		t.Errorf("expected tool call ID 'tc2', got %q", msg.OfAssistant.ToolCalls[1].ID)
	}
}

func TestToOpenAIMessagesToolMessage(t *testing.T) {
	t.Parallel()

	messages := []Message{
		{
			Role:       RoleTool,
			Content:    "tool output",
			ToolCalls:  nil,
			ToolCallID: "tc1",
			ToolName:   testWebSearchTool,
		},
	}

	result := toOpenAIMessages("", messages)
	if len(result) != 1 {
		t.Fatalf("expected 1 message, got %d", len(result))
	}

	if result[0].OfTool == nil {
		t.Fatal("expected tool message")
	}

	if result[0].OfTool.ToolCallID != "tc1" {
		t.Errorf("expected tool call ID 'tc1', got %q", result[0].OfTool.ToolCallID)
	}
}

func TestToOpenAITools(t *testing.T) {
	t.Parallel()

	tools := []ToolDefinition{
		{
			Name:        testWebSearchTool,
			Description: "Search the web",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string"},
				},
			},
		},
	}

	result := toOpenAITools(tools)
	if len(result) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(result))
	}

	if result[0].Function.Name != testWebSearchTool {
		t.Errorf("expected name 'web_search', got %q", result[0].Function.Name)
	}
}

func TestMapOpenAIFinishReason(t *testing.T) {
	t.Parallel()

	cases := []struct {
		reason string
		want   string
	}{
		{reason: "stop", want: StopReasonEndTurn},
		{reason: "tool_calls", want: StopReasonToolUse},
		{reason: "function_call", want: StopReasonToolUse},
		{reason: "length", want: StopReasonMaxTokens},
		{reason: "content_filter", want: StopReasonRefusal},
		{reason: "unknown", want: StopReasonEndTurn},
		{reason: "", want: StopReasonEndTurn},
	}

	for _, tc := range cases {
		t.Run(tc.reason, func(t *testing.T) {
			t.Parallel()

			got := mapOpenAIFinishReason(tc.reason)
			if got != tc.want {
				t.Errorf("mapOpenAIFinishReason(%q) = %q, want %q", tc.reason, got, tc.want)
			}
		})
	}
}

func newOpenAIStreamServer(t *testing.T, chunks []string) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")

		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Errorf("response writer does not support flushing")

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
	}))
	t.Cleanup(srv.Close)

	return srv
}

type collectedOpenAIEvents struct {
	tools       []ToolCall
	stopReason  string
	gotComplete bool
	err         error
}

func collectOpenAIEvents(ch <-chan Event) collectedOpenAIEvents {
	var out collectedOpenAIEvents

	for evt := range ch {
		switch evt.Type {
		case EventToolUseDone:
			if evt.ToolCall != nil {
				out.tools = append(out.tools, *evt.ToolCall)
			}
		case EventComplete:
			out.stopReason = evt.StopReason
			out.gotComplete = true
		case EventError:
			out.err = evt.Error
		case EventContentDelta, EventToolUseStart, EventToolUseDelta:
		}
	}

	return out
}

func TestOpenAIProcessStream(t *testing.T) {
	t.Parallel()

	const startChunk = `{"id":"1","object":"chat.completion.chunk",` +
		`"choices":[{"index":0,"delta":{"tool_calls":[` +
		`{"index":0,"id":"call_1","type":"function",` +
		`"function":{"name":"search","arguments":""}}]}}]}`

	const argsChunk = `{"id":"1","object":"chat.completion.chunk",` +
		`"choices":[{"index":0,"delta":{"tool_calls":[` +
		`{"index":0,"function":{"arguments":"{\"q\":\"x\"}"}}]}}]}`

	const lateArgsChunk = `{"id":"1","object":"chat.completion.chunk",` +
		`"choices":[{"index":0,"delta":{"tool_calls":[` +
		`{"index":0,"function":{"arguments":"{\"q\":\""}}]}}]}`

	const lateMetadataChunk = `{"id":"1","object":"chat.completion.chunk",` +
		`"choices":[{"index":0,"delta":{"tool_calls":[` +
		`{"index":0,"id":"call_late","type":"function",` +
		`"function":{"name":"search","arguments":"x\"}"}}]}}]}`

	const finishChunk = `{"id":"1","object":"chat.completion.chunk",` +
		`"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`

	cases := []struct {
		name           string
		chunks         []string
		wantTools      []ToolCall
		wantStopReason string
		wantComplete   bool
	}{
		{
			name:   "tool calls flushed when stream ends without finish_reason",
			chunks: []string{startChunk, argsChunk},
			wantTools: []ToolCall{
				{ID: "call_1", Name: "search", Arguments: `{"q":"x"}`},
			},
			wantStopReason: StopReasonToolUse,
			wantComplete:   true,
		},
		{
			name:   "tool calls emitted exactly once when finish_reason is present",
			chunks: []string{startChunk, argsChunk, finishChunk},
			wantTools: []ToolCall{
				{ID: "call_1", Name: "search", Arguments: `{"q":"x"}`},
			},
			wantStopReason: StopReasonToolUse,
			wantComplete:   true,
		},
		{
			name:   "tool call metadata backfilled from later delta",
			chunks: []string{lateArgsChunk, lateMetadataChunk, finishChunk},
			wantTools: []ToolCall{
				{ID: "call_late", Name: "search", Arguments: `{"q":"x"}`},
			},
			wantStopReason: StopReasonToolUse,
			wantComplete:   true,
		},
		{
			name:           "no events when stream is empty",
			chunks:         nil,
			wantTools:      nil,
			wantStopReason: "",
			wantComplete:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := newOpenAIStreamServer(t, tc.chunks)

			provider := &OpenAI{
				client: openai.NewClient(
					option.WithAPIKey("test"),
					option.WithBaseURL(srv.URL+"/"),
				),
				model: "gpt-4o",
			}

			ch := provider.StreamResponse(
				context.Background(),
				"",
				[]Message{{Role: RoleUser, Content: "hi"}},
				nil,
			)

			got := collectOpenAIEvents(ch)

			if got.err != nil {
				t.Fatalf("unexpected error: %v", got.err)
			}

			if got.gotComplete != tc.wantComplete {
				t.Errorf("complete = %v, want %v", got.gotComplete, tc.wantComplete)
			}

			if got.stopReason != tc.wantStopReason {
				t.Errorf("stop reason = %q, want %q", got.stopReason, tc.wantStopReason)
			}

			if diff := cmp.Diff(tc.wantTools, got.tools); diff != "" {
				t.Errorf("tool calls mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBuildOpenAIParams(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		tools        []ToolDefinition
		wantToolsLen int
	}{
		{
			name: "with tools",
			tools: []ToolDefinition{
				{Name: "t1", Description: "tool 1", Parameters: map[string]any{}},
			},
			wantToolsLen: 1,
		},
		{
			name:         "without tools",
			tools:        nil,
			wantToolsLen: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			params := buildOpenAIParams("gpt-4o", "sys", nil, tc.tools)
			if len(params.Tools) != tc.wantToolsLen {
				t.Errorf(
					"tools: expected %d, got %d", tc.wantToolsLen, len(params.Tools),
				)
			}
		})
	}
}
