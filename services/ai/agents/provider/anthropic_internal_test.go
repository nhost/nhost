package provider

import (
	"context"
	"encoding/json"
	"testing"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/google/go-cmp/cmp"
)

func TestToAnthropicMessages(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		messages []Message
		wantLen  int
		wantErr  bool
		check    func(t *testing.T, result []anthropic.MessageParam)
	}{
		{
			name:    "empty",
			wantLen: 0,
		},
		{
			name: "user message",
			messages: []Message{
				{
					Role:       RoleUser,
					Content:    "hello",
					ToolCalls:  nil,
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []anthropic.MessageParam) {
				t.Helper()

				if result[0].Role != anthropic.MessageParamRoleUser {
					t.Errorf("expected user role, got %s", result[0].Role)
				}

				if len(result[0].Content) != 1 {
					t.Fatalf("expected 1 content block, got %d", len(result[0].Content))
				}

				if result[0].Content[0].OfText == nil {
					t.Fatal("expected text block")
				}

				if result[0].Content[0].OfText.Text != "hello" {
					t.Errorf("expected 'hello', got %q", result[0].Content[0].OfText.Text)
				}
			},
		},
		{
			name: "assistant message with content only",
			messages: []Message{
				{
					Role:       RoleAssistant,
					Content:    "hi there",
					ToolCalls:  nil,
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []anthropic.MessageParam) {
				t.Helper()

				if result[0].Role != anthropic.MessageParamRoleAssistant {
					t.Errorf("expected assistant role, got %s", result[0].Role)
				}

				if len(result[0].Content) != 1 {
					t.Fatalf("expected 1 content block, got %d", len(result[0].Content))
				}

				if result[0].Content[0].OfText == nil {
					t.Fatal("expected text block")
				}

				if result[0].Content[0].OfText.Text != "hi there" {
					t.Errorf("expected 'hi there', got %q", result[0].Content[0].OfText.Text)
				}
			},
		},
		{
			name: "assistant message with tool calls",
			messages: []Message{
				{
					Role:    RoleAssistant,
					Content: "let me search",
					ToolCalls: []ToolCall{
						{ID: "tc1", Name: testWebSearchTool, Arguments: `{"query":"test"}`},
					},
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []anthropic.MessageParam) {
				t.Helper()

				if len(result[0].Content) != 2 {
					t.Fatalf(
						"expected 2 content blocks (text + tool_use), got %d",
						len(result[0].Content),
					)
				}

				if result[0].Content[0].OfText == nil {
					t.Fatal("expected text block at index 0")
				}

				if result[0].Content[1].OfToolUse == nil {
					t.Fatal("expected tool_use block at index 1")
				}

				if result[0].Content[1].OfToolUse.ID != "tc1" {
					t.Errorf("expected tool ID 'tc1', got %q", result[0].Content[1].OfToolUse.ID)
				}

				if result[0].Content[1].OfToolUse.Name != testWebSearchTool {
					t.Errorf(
						"expected tool name 'web_search', got %q",
						result[0].Content[1].OfToolUse.Name,
					)
				}
			},
		},
		{
			name: "invalid tool call arguments",
			messages: []Message{
				{
					Role:    RoleAssistant,
					Content: "",
					ToolCalls: []ToolCall{
						{ID: "tc1", Name: testWebSearchTool, Arguments: `{invalid`},
					},
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantErr: true,
		},
		{
			name: "tool result message",
			messages: []Message{
				{
					Role:       RoleTool,
					Content:    "search results here",
					ToolCalls:  nil,
					ToolCallID: "tc1",
					ToolName:   testWebSearchTool,
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []anthropic.MessageParam) {
				t.Helper()

				if result[0].Role != anthropic.MessageParamRoleUser {
					t.Errorf("expected user role for tool result, got %s", result[0].Role)
				}

				if len(result[0].Content) != 1 {
					t.Fatalf("expected 1 content block, got %d", len(result[0].Content))
				}

				if result[0].Content[0].OfToolResult == nil {
					t.Fatal("expected tool_result block")
				}

				if result[0].Content[0].OfToolResult.ToolUseID != "tc1" {
					t.Errorf(
						"expected tool_use_id 'tc1', got %q",
						result[0].Content[0].OfToolResult.ToolUseID,
					)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := toAnthropicMessages(tc.messages)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(result) != tc.wantLen {
				t.Fatalf("expected %d messages, got %d", tc.wantLen, len(result))
			}

			if tc.check != nil {
				tc.check(t, result)
			}
		})
	}
}

func TestToStringSlice(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   any
		want []string
		ok   bool
	}{
		{
			name: "string slice",
			in:   []string{"a", "b"},
			want: []string{"a", "b"},
			ok:   true,
		},
		{
			name: "any slice of strings",
			in:   []any{"a", "b"},
			want: []string{"a", "b"},
			ok:   true,
		},
		{
			name: "any slice with non-string",
			in:   []any{"a", 1},
			want: nil,
			ok:   false,
		},
		{
			name: "non-slice",
			in:   "query",
			want: nil,
			ok:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, ok := toStringSlice(tc.in)
			if ok != tc.ok {
				t.Fatalf("expected ok %t, got %t", tc.ok, ok)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("toStringSlice() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestToAnthropicTools(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		required any
	}{
		{
			name:     "required as string slice",
			required: []string{"query"},
		},
		{
			name:     "required as any slice",
			required: []any{"query"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tools := []ToolDefinition{
				{
					Name:        testWebSearchTool,
					Description: "Search the web",
					Parameters: map[string]any{
						"properties": map[string]any{
							"query": map[string]any{
								"type":        "string",
								"description": "search query",
							},
						},
						"required": tc.required,
					},
				},
			}

			result := toAnthropicTools(tools)
			if len(result) != 1 {
				t.Fatalf("expected 1 tool, got %d", len(result))
			}

			if result[0].OfTool == nil {
				t.Fatal("expected OfTool to be non-nil")
			}

			if result[0].OfTool.Name != testWebSearchTool {
				t.Errorf("expected name 'web_search', got %q", result[0].OfTool.Name)
			}

			wantRequired := []string{"query"}
			if diff := cmp.Diff(wantRequired, result[0].OfTool.InputSchema.Required); diff != "" {
				t.Errorf("required mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestMapAnthropicStopReason(t *testing.T) {
	t.Parallel()

	cases := []struct {
		reason anthropic.StopReason
		want   string
	}{
		{reason: anthropic.StopReasonEndTurn, want: StopReasonEndTurn},
		{reason: anthropic.StopReasonStopSequence, want: StopReasonEndTurn},
		{reason: anthropic.StopReasonPauseTurn, want: StopReasonEndTurn},
		{reason: anthropic.StopReasonToolUse, want: StopReasonToolUse},
		{reason: anthropic.StopReasonMaxTokens, want: StopReasonMaxTokens},
		{reason: anthropic.StopReasonRefusal, want: StopReasonRefusal},
		{reason: anthropic.StopReason("unknown"), want: StopReasonEndTurn},
		{reason: anthropic.StopReason(""), want: StopReasonEndTurn},
	}

	for _, tc := range cases {
		t.Run(string(tc.reason), func(t *testing.T) {
			t.Parallel()

			got := mapAnthropicStopReason(tc.reason)
			if got != tc.want {
				t.Errorf(
					"mapAnthropicStopReason(%q) = %q, want %q",
					tc.reason, got, tc.want,
				)
			}
		})
	}
}

func TestHandleAnthropicMessageDelta(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		stopReason     anthropic.StopReason
		wantEvent      bool
		wantStopReason string
	}{
		{
			name:       "empty stop reason emits no event",
			stopReason: anthropic.StopReason(""),
			wantEvent:  false,
		},
		{
			name:           "end_turn emits complete event",
			stopReason:     anthropic.StopReasonEndTurn,
			wantEvent:      true,
			wantStopReason: StopReasonEndTurn,
		},
		{
			name:           "tool_use emits complete event",
			stopReason:     anthropic.StopReasonToolUse,
			wantEvent:      true,
			wantStopReason: StopReasonToolUse,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan Event, 1)
			e := anthropic.MessageDeltaEvent{
				Delta: anthropic.MessageDeltaEventDelta{
					StopReason: tc.stopReason,
				},
			}

			if !handleAnthropicMessageDelta(context.Background(), e, ch) {
				t.Fatal("expected handler to keep going")
			}

			select {
			case ev := <-ch:
				if !tc.wantEvent {
					t.Fatalf("expected no event, got %+v", ev)
				}

				if ev.Type != EventComplete {
					t.Errorf("expected EventComplete, got %d", ev.Type)
				}

				if ev.StopReason != tc.wantStopReason {
					t.Errorf("expected %q, got %q", tc.wantStopReason, ev.StopReason)
				}
			default:
				if tc.wantEvent {
					t.Fatal("expected an event, got none")
				}
			}
		})
	}
}

func TestHandleAnthropicStreamEvent(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		steps       []anthropicStreamStep
		wantCurrent *ToolCall
	}{
		{
			name: "tool use accumulates arguments across deltas",
			steps: []anthropicStreamStep{
				{
					rawEvent: `{"type":"content_block_start","index":0,` +
						`"content_block":{"type":"tool_use","id":"toolu_1",` +
						`"name":"search","input":{}}}`,
					wantEvent: &Event{
						Type:       EventToolUseStart,
						Content:    "",
						ToolCall:   &ToolCall{ID: "toolu_1", Name: "search", Arguments: ""},
						Error:      nil,
						StopReason: "",
					},
				},
				{
					rawEvent: `{"type":"content_block_delta","index":0,` +
						`"delta":{"type":"input_json_delta",` +
						`"partial_json":"{\"query\":"}}`,
					wantEvent: &Event{
						Type:    EventToolUseDelta,
						Content: "",
						ToolCall: &ToolCall{
							ID:        "toolu_1",
							Name:      "search",
							Arguments: `{"query":`,
						},
						Error:      nil,
						StopReason: "",
					},
				},
				{
					rawEvent: `{"type":"content_block_delta","index":0,` +
						`"delta":{"type":"input_json_delta",` +
						`"partial_json":"\"weather\"}"}}`,
					wantEvent: &Event{
						Type:    EventToolUseDelta,
						Content: "",
						ToolCall: &ToolCall{
							ID:        "toolu_1",
							Name:      "search",
							Arguments: `{"query":"weather"}`,
						},
						Error:      nil,
						StopReason: "",
					},
				},
				{
					rawEvent: `{"type":"content_block_stop","index":0}`,
					wantEvent: &Event{
						Type:    EventToolUseDone,
						Content: "",
						ToolCall: &ToolCall{
							ID:        "toolu_1",
							Name:      "search",
							Arguments: `{"query":"weather"}`,
						},
						Error:      nil,
						StopReason: "",
					},
				},
			},
			wantCurrent: nil,
		},
		{
			name: "empty tool arguments normalize on stop",
			steps: []anthropicStreamStep{
				{
					rawEvent: `{"type":"content_block_start","index":0,` +
						`"content_block":{"type":"tool_use","id":"toolu_2",` +
						`"name":"lookup","input":{}}}`,
					wantEvent: &Event{
						Type:       EventToolUseStart,
						Content:    "",
						ToolCall:   &ToolCall{ID: "toolu_2", Name: "lookup", Arguments: ""},
						Error:      nil,
						StopReason: "",
					},
				},
				{
					rawEvent: `{"type":"content_block_stop","index":0}`,
					wantEvent: &Event{
						Type:       EventToolUseDone,
						Content:    "",
						ToolCall:   &ToolCall{ID: "toolu_2", Name: "lookup", Arguments: "{}"},
						Error:      nil,
						StopReason: "",
					},
				},
			},
			wantCurrent: nil,
		},
		{
			name: "text delta emits content without tool state",
			steps: []anthropicStreamStep{
				{
					rawEvent: `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}`,
					wantEvent: &Event{
						Type:       EventContentDelta,
						Content:    "hello",
						ToolCall:   nil,
						Error:      nil,
						StopReason: "",
					},
				},
			},
			wantCurrent: nil,
		},
		{
			name: "message delta tool use stop reason completes stream",
			steps: []anthropicStreamStep{
				{
					rawEvent: `{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":1}}`,
					wantEvent: &Event{
						Type:       EventComplete,
						Content:    "",
						ToolCall:   nil,
						Error:      nil,
						StopReason: StopReasonToolUse,
					},
				},
			},
			wantCurrent: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan Event, len(tc.steps))

			var current *ToolCall

			for _, step := range tc.steps {
				event := unmarshalAnthropicStreamEvent(t, step.rawEvent)

				var keepGoing bool

				current, keepGoing = handleAnthropicStreamEvent(
					context.Background(), event, ch, current,
				)
				if !keepGoing {
					t.Fatal("expected stream event handler to keep going")
				}

				gotEvent := receiveAnthropicEvent(t, ch)
				if diff := cmp.Diff(step.wantEvent, gotEvent); diff != "" {
					t.Errorf("event mismatch (-want +got):\n%s", diff)
				}
			}

			if diff := cmp.Diff(tc.wantCurrent, current); diff != "" {
				t.Errorf("current tool call mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type anthropicStreamStep struct {
	rawEvent  string
	wantEvent *Event
}

func unmarshalAnthropicStreamEvent(
	t *testing.T,
	rawEvent string,
) anthropic.MessageStreamEventUnion {
	t.Helper()

	var event anthropic.MessageStreamEventUnion
	if err := json.Unmarshal([]byte(rawEvent), &event); err != nil {
		t.Fatalf("unmarshal Anthropic stream event: %v", err)
	}

	return event
}

func receiveAnthropicEvent(t *testing.T, ch <-chan Event) *Event {
	t.Helper()

	select {
	case event := <-ch:
		if event.ToolCall != nil {
			toolCall := *event.ToolCall
			event.ToolCall = &toolCall
		}

		return &event
	default:
		return nil
	}
}

func TestBuildAnthropicParams(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		system       string
		tools        []ToolDefinition
		wantSystem   string // "" means expect no system blocks
		wantToolsLen int
	}{
		{
			name:       "with system prompt",
			system:     "you are helpful",
			wantSystem: "you are helpful",
		},
		{
			name: "without system prompt",
		},
		{
			name: "with tools",
			tools: []ToolDefinition{
				{Name: "t1", Description: "tool 1", Parameters: map[string]any{}},
			},
			wantToolsLen: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			params, err := buildAnthropicParams(
				"claude-sonnet-4-20250514", tc.system, nil, tc.tools,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.wantSystem == "" {
				if len(params.System) != 0 {
					t.Errorf("expected no system blocks, got %d", len(params.System))
				}
			} else {
				if len(params.System) != 1 {
					t.Fatalf("expected 1 system block, got %d", len(params.System))
				}

				if params.System[0].Text != tc.wantSystem {
					t.Errorf(
						"system text: expected %q, got %q",
						tc.wantSystem, params.System[0].Text,
					)
				}
			}

			if len(params.Tools) != tc.wantToolsLen {
				t.Errorf(
					"tools: expected %d, got %d", tc.wantToolsLen, len(params.Tools),
				)
			}
		})
	}
}
