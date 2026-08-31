package provider

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"google.golang.org/genai"
)

func TestToGeminiContents(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		msgs    []Message
		wantLen int
		check   func(t *testing.T, result []*genai.Content)
	}{
		{
			name:    "empty",
			wantLen: 0,
		},
		{
			name: "user message",
			msgs: []Message{
				{Role: RoleUser, Content: "hello", ToolCalls: nil, ToolCallID: "", ToolName: ""},
			},
			wantLen: 1,
			check: func(t *testing.T, result []*genai.Content) {
				t.Helper()

				if result[0].Role != string(genai.RoleUser) {
					t.Errorf("expected user role, got %q", result[0].Role)
				}

				if len(result[0].Parts) == 0 || result[0].Parts[0].Text != "hello" {
					t.Error("expected text part 'hello'")
				}
			},
		},
		{
			name: "assistant message with content",
			msgs: []Message{
				{Role: RoleAssistant, Content: "hi", ToolCalls: nil, ToolCallID: "", ToolName: ""},
			},
			wantLen: 1,
			check: func(t *testing.T, result []*genai.Content) {
				t.Helper()

				if result[0].Role != string(genai.RoleModel) {
					t.Errorf("expected model role, got %q", result[0].Role)
				}

				if len(result[0].Parts) != 1 {
					t.Fatalf("expected 1 part, got %d", len(result[0].Parts))
				}

				if result[0].Parts[0].Text != "hi" {
					t.Errorf("expected text 'hi', got %q", result[0].Parts[0].Text)
				}
			},
		},
		{
			name: "assistant message with tool calls",
			msgs: []Message{
				{
					Role:    RoleAssistant,
					Content: "searching",
					ToolCalls: []ToolCall{
						{ID: "tc1", Name: "web_search", Arguments: `{"query":"test"}`},
					},
					ToolCallID: "",
					ToolName:   "",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []*genai.Content) {
				t.Helper()

				if len(result[0].Parts) != 2 {
					t.Fatalf(
						"expected 2 parts (text + function_call), got %d",
						len(result[0].Parts),
					)
				}

				if result[0].Parts[0].Text != "searching" {
					t.Errorf("expected text 'searching', got %q", result[0].Parts[0].Text)
				}

				fc := result[0].Parts[1].FunctionCall
				if fc == nil {
					t.Fatal("expected function call part")
				}

				if fc.ID != "tc1" {
					t.Errorf("expected function ID 'tc1', got %q", fc.ID)
				}

				if fc.Name != "web_search" {
					t.Errorf("expected function name 'web_search', got %q", fc.Name)
				}

				if fc.Args["query"] != "test" {
					t.Errorf("expected arg query='test', got %v", fc.Args["query"])
				}
			},
		},
		{
			name: "tool result with JSON content",
			msgs: []Message{
				{
					Role:       RoleTool,
					Content:    `{"results":["a","b"]}`,
					ToolCalls:  nil,
					ToolCallID: "tc1",
					ToolName:   "web_search",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []*genai.Content) {
				t.Helper()

				if result[0].Role != string(genai.RoleUser) {
					t.Errorf("expected user role, got %q", result[0].Role)
				}

				if len(result[0].Parts) != 1 {
					t.Fatalf("expected 1 part, got %d", len(result[0].Parts))
				}

				fr := result[0].Parts[0].FunctionResponse
				if fr == nil {
					t.Fatal("expected function response part")
				}

				if fr.ID != "tc1" {
					t.Errorf("expected response ID 'tc1', got %q", fr.ID)
				}

				if fr.Name != "web_search" {
					t.Errorf("expected name 'web_search', got %q", fr.Name)
				}

				if fr.Response == nil {
					t.Error("expected non-nil response")
				}
			},
		},
		{
			name: "tool result with non-JSON content wraps in result key",
			msgs: []Message{
				{
					Role:       RoleTool,
					Content:    "plain text result",
					ToolCalls:  nil,
					ToolCallID: "tc1",
					ToolName:   "search",
				},
			},
			wantLen: 1,
			check: func(t *testing.T, result []*genai.Content) {
				t.Helper()

				fr := result[0].Parts[0].FunctionResponse
				if fr == nil {
					t.Fatal("expected function response")
				}

				val, ok := fr.Response["result"]
				if !ok {
					t.Fatal("expected 'result' key in response")
				}

				if val != "plain text result" {
					t.Errorf("expected 'plain text result', got %v", val)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result, err := toGeminiContents(t.Context(), tc.msgs)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(result) != tc.wantLen {
				t.Fatalf("expected %d contents, got %d", tc.wantLen, len(result))
			}

			if tc.check != nil {
				tc.check(t, result)
			}
		})
	}
}

func TestToGeminiTools(t *testing.T) {
	t.Parallel()

	t.Run("empty", func(t *testing.T) {
		t.Parallel()

		result := toGeminiTools(nil)
		if result != nil {
			t.Errorf("expected nil, got %v", result)
		}
	})

	t.Run("with tools", func(t *testing.T) {
		t.Parallel()

		tools := []ToolDefinition{
			{
				Name:        "search",
				Description: "search the web",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{
							"type":        "string",
							"description": "the query",
						},
					},
					"required": []string{"query"},
				},
			},
		}

		result := toGeminiTools(tools)
		assertGeminiSearchTool(t, result)
	})

	t.Run("preserves nested schema fields", func(t *testing.T) {
		t.Parallel()

		tools := []ToolDefinition{
			{
				Name:        "filter_items",
				Description: "filter a list of items",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"tags": map[string]any{
							"type":        "array",
							"description": "tags to match",
							"items": map[string]any{
								"type": "string",
							},
						},
						"status": map[string]any{
							"type": "string",
							"enum": []any{"open", "closed"},
						},
						"options": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"limit": map[string]any{
									"type": "integer",
								},
							},
							"required": []any{"limit"},
						},
					},
					"required": []any{"tags"},
				},
			},
		}

		result := toGeminiTools(tools)
		assertGeminiNestedSchemaTool(t, result)
	})
}

func assertGeminiSearchTool(t *testing.T, result []*genai.Tool) {
	t.Helper()

	decl := requireSingleGeminiDeclaration(t, result)

	if decl.Name != "search" {
		t.Errorf("expected name 'search', got %q", decl.Name)
	}

	if decl.Description != "search the web" {
		t.Errorf("expected description 'search the web', got %q", decl.Description)
	}

	params := requireRawJSONSchema(t, decl)
	properties := requireSchemaMap(t, params, "properties")

	if _, ok := properties["query"]; !ok {
		t.Error("expected 'query' property")
	}

	required, ok := params["required"].([]string)
	if !ok {
		t.Fatalf("expected required []string, got %T", params["required"])
	}

	if len(required) != 1 || required[0] != "query" {
		t.Errorf("expected required=['query'], got %v", required)
	}
}

func assertGeminiNestedSchemaTool(t *testing.T, result []*genai.Tool) {
	t.Helper()

	params := requireRawJSONSchema(t, requireSingleGeminiDeclaration(t, result))
	if params["type"] != "object" {
		t.Errorf("expected root type=object, got %v", params["type"])
	}

	properties := requireSchemaMap(t, params, "properties")
	assertGeminiTagsSchema(t, properties)
	assertGeminiStatusSchema(t, properties)
	assertGeminiOptionsSchema(t, properties)

	required, ok := params["required"].([]any)
	if !ok {
		t.Fatalf("expected top-level required []any, got %T", params["required"])
	}

	if len(required) != 1 || required[0] != "tags" {
		t.Errorf("expected top-level required=[tags], got %v", required)
	}
}

func requireSingleGeminiDeclaration(t *testing.T, result []*genai.Tool) *genai.FunctionDeclaration {
	t.Helper()

	if len(result) != 1 {
		t.Fatalf("expected 1 genai.Tool, got %d", len(result))
	}

	decls := result[0].FunctionDeclarations
	if len(decls) != 1 {
		t.Fatalf("expected 1 declaration, got %d", len(decls))
	}

	return decls[0]
}

func requireRawJSONSchema(t *testing.T, decl *genai.FunctionDeclaration) map[string]any {
	t.Helper()

	if decl.Parameters != nil {
		t.Fatalf("expected typed parameters to be nil, got %v", decl.Parameters)
	}

	params, ok := decl.ParametersJsonSchema.(map[string]any)
	if !ok {
		t.Fatalf("expected raw JSON schema map, got %T", decl.ParametersJsonSchema)
	}

	return params
}

func requireSchemaMap(t *testing.T, schema map[string]any, key string) map[string]any {
	t.Helper()

	value, ok := schema[key].(map[string]any)
	if !ok {
		t.Fatalf("expected %s map, got %T", key, schema[key])
	}

	return value
}

func assertGeminiTagsSchema(t *testing.T, properties map[string]any) {
	t.Helper()

	tags := requireSchemaMap(t, properties, "tags")
	if tags["type"] != "array" {
		t.Errorf("expected tags type=array, got %v", tags["type"])
	}

	items := requireSchemaMap(t, tags, "items")
	if items["type"] != "string" {
		t.Errorf("expected tags items type=string, got %v", items["type"])
	}
}

func assertGeminiStatusSchema(t *testing.T, properties map[string]any) {
	t.Helper()

	status := requireSchemaMap(t, properties, "status")

	enum, ok := status["enum"].([]any)
	if !ok {
		t.Fatalf("expected status enum []any, got %T", status["enum"])
	}

	if len(enum) != 2 || enum[0] != "open" || enum[1] != "closed" {
		t.Errorf("expected enum=[open,closed], got %v", enum)
	}
}

func assertGeminiOptionsSchema(t *testing.T, properties map[string]any) {
	t.Helper()

	options := requireSchemaMap(t, properties, "options")
	optionProperties := requireSchemaMap(t, options, "properties")

	limit := requireSchemaMap(t, optionProperties, "limit")
	if limit["type"] != "integer" {
		t.Errorf("expected limit type=integer, got %v", limit["type"])
	}

	nestedRequired, ok := options["required"].([]any)
	if !ok {
		t.Fatalf("expected nested required []any, got %T", options["required"])
	}

	if len(nestedRequired) != 1 || nestedRequired[0] != "limit" {
		t.Errorf("expected nested required=[limit], got %v", nestedRequired)
	}
}

func TestNewGoogle(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		apiKey  string
		wantErr error
	}{
		{
			name:    "empty apiKey errors",
			apiKey:  "",
			wantErr: ErrEmptyAPIKey,
		},
		{
			name:   "non-empty apiKey constructs client",
			apiKey: "x",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			g, err := NewGoogle(t.Context(), tc.apiKey, "gemini-2.0-flash")

			if tc.wantErr != nil {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				if !errors.Is(err, tc.wantErr) {
					t.Errorf("expected %v, got %v", tc.wantErr, err)
				}

				if g != nil {
					t.Error("expected nil provider on error")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if g == nil || g.client == nil {
				t.Fatal("expected non-nil provider and client")
			}
		})
	}
}

// TestGoogleStreamToolUseAcrossChunks asserts that when Gemini emits a
// function_call in one chunk and the FinishReason in a later chunk, the
// completion event reports StopReasonToolUse. Regression test for a bug where
// hasToolCalls was reset per chunk, causing trailing STOP-only chunks to emit
// StopReasonEndTurn and silently drop tool calls in the agent loop.
func TestGoogleStreamToolUseAcrossChunks(t *testing.T) {
	t.Parallel()

	ch := make(chan Event, 16)
	ctx := context.Background()
	stream := &googleStream{hasToolCalls: false}

	chunk1 := &genai.GenerateContentResponse{
		Candidates: []*genai.Candidate{
			{
				Content: &genai.Content{
					Role: genai.RoleModel,
					Parts: []*genai.Part{
						{
							FunctionCall: &genai.FunctionCall{
								Name: "search",
								Args: map[string]any{"q": "test"},
							},
						},
					},
				},
			},
		},
	}

	if !stream.processCandidates(ctx, ch, chunk1) {
		t.Fatal("processCandidates returned false on chunk 1")
	}

	if !stream.hasToolCalls {
		t.Fatal("expected hasToolCalls=true after function_call chunk")
	}

	chunk2 := &genai.GenerateContentResponse{
		Candidates: []*genai.Candidate{
			{
				Content:      &genai.Content{Role: genai.RoleModel, Parts: nil},
				FinishReason: genai.FinishReasonStop,
			},
		},
	}

	if !stream.processCandidates(ctx, ch, chunk2) {
		t.Fatal("processCandidates returned false on chunk 2")
	}

	close(ch)

	var (
		sawToolStart bool
		sawToolDone  bool
		complete     *Event
	)

	for evt := range ch {
		switch evt.Type {
		case EventToolUseStart:
			sawToolStart = true
		case EventToolUseDone:
			sawToolDone = true
		case EventComplete:
			e := evt
			complete = &e
		case EventContentDelta, EventToolUseDelta, EventError:
		}
	}

	if !sawToolStart || !sawToolDone {
		t.Errorf("expected tool_use_start and tool_use_done events; got start=%v done=%v",
			sawToolStart, sawToolDone)
	}

	if complete == nil {
		t.Fatal("expected complete event after FinishReason chunk")
	}

	if complete.StopReason != StopReasonToolUse {
		t.Errorf("expected StopReason=%q, got %q", StopReasonToolUse, complete.StopReason)
	}
}

func TestMapGeminiFinishReason(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		fr   genai.FinishReason
		want string
	}{
		{name: "stop maps to end turn", fr: genai.FinishReasonStop, want: StopReasonEndTurn},
		{name: "max tokens", fr: genai.FinishReasonMaxTokens, want: StopReasonMaxTokens},
		{name: "safety", fr: genai.FinishReasonSafety, want: StopReasonRefusal},
		{
			name: "prohibited content",
			fr:   genai.FinishReasonProhibitedContent,
			want: StopReasonRefusal,
		},
		{name: "blocklist", fr: genai.FinishReasonBlocklist, want: StopReasonRefusal},
		{name: "spii", fr: genai.FinishReasonSPII, want: StopReasonRefusal},
		{name: "recitation", fr: genai.FinishReasonRecitation, want: StopReasonRefusal},
		{name: "other defaults to end turn", fr: genai.FinishReasonOther, want: StopReasonEndTurn},
		{
			name: "unspecified defaults to end turn",
			fr:   genai.FinishReasonUnspecified,
			want: StopReasonEndTurn,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := mapGeminiFinishReason(tc.fr); got != tc.want {
				t.Errorf("mapGeminiFinishReason(%q) = %q, want %q", tc.fr, got, tc.want)
			}
		})
	}
}

// TestProcessCandidatesPropagatesFinishReason verifies that a Gemini turn
// truncated by MAX_TOKENS or blocked by a safety filter surfaces a distinct
// StopReason instead of being collapsed to end_turn.
func TestProcessCandidatesPropagatesFinishReason(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		hasToolCalls bool
		finishReason genai.FinishReason
		want         string
	}{
		{
			name:         "stop with no tool calls -> end turn",
			hasToolCalls: false,
			finishReason: genai.FinishReasonStop,
			want:         StopReasonEndTurn,
		},
		{
			name:         "stop with tool calls -> tool use",
			hasToolCalls: true,
			finishReason: genai.FinishReasonStop,
			want:         StopReasonToolUse,
		},
		{
			name:         "max tokens beats tool use",
			hasToolCalls: true,
			finishReason: genai.FinishReasonMaxTokens,
			want:         StopReasonMaxTokens,
		},
		{
			name:         "safety beats tool use",
			hasToolCalls: true,
			finishReason: genai.FinishReasonSafety,
			want:         StopReasonRefusal,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan Event, 4)
			stream := &googleStream{hasToolCalls: tc.hasToolCalls}

			resp := &genai.GenerateContentResponse{
				Candidates: []*genai.Candidate{
					{
						Content:      &genai.Content{Role: genai.RoleModel, Parts: nil},
						FinishReason: tc.finishReason,
					},
				},
			}

			if !stream.processCandidates(context.Background(), ch, resp) {
				t.Fatal("processCandidates returned false")
			}

			close(ch)

			var complete *Event
			for evt := range ch {
				if evt.Type == EventComplete {
					e := evt
					complete = &e
				}
			}

			if complete == nil {
				t.Fatal("expected complete event")
			}

			if complete.StopReason != tc.want {
				t.Errorf("StopReason: expected %q, got %q", tc.want, complete.StopReason)
			}
		})
	}
}

func TestProcessPartFunctionCallID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		inputID       string
		wantGenerated bool
	}{
		{name: "preserves Gemini ID", inputID: "gemini-call-123", wantGenerated: false},
		{name: "generates missing ID", inputID: "", wantGenerated: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan Event, 4)
			stream := &googleStream{hasToolCalls: false}
			part := &genai.Part{
				FunctionCall: &genai.FunctionCall{
					ID:   tc.inputID,
					Name: "search",
					Args: nil,
				},
			}

			if !stream.processPart(context.Background(), ch, part) {
				t.Fatal("processPart returned false")
			}

			close(ch)
			assertGeminiToolEventIDs(t, ch, tc.inputID, tc.wantGenerated)
		})
	}
}

func assertGeminiToolEventIDs(
	t *testing.T,
	ch <-chan Event,
	inputID string,
	wantGenerated bool,
) {
	t.Helper()

	seen := 0

	gotID := ""
	for evt := range ch {
		if evt.Type != EventToolUseStart && evt.Type != EventToolUseDone {
			continue
		}

		seen++

		if evt.ToolCall == nil {
			t.Fatal("expected tool call on tool event")
		}

		if gotID == "" {
			gotID = evt.ToolCall.ID
		} else if evt.ToolCall.ID != gotID {
			t.Fatalf(
				"expected repeated tool events to share ID %q, got %q",
				gotID,
				evt.ToolCall.ID,
			)
		}

		if wantGenerated {
			if _, err := uuid.Parse(evt.ToolCall.ID); err != nil {
				t.Fatalf("expected generated UUID ID, got %q: %v", evt.ToolCall.ID, err)
			}
		} else if evt.ToolCall.ID != inputID {
			t.Fatalf("expected preserved ID %q, got %q", inputID, evt.ToolCall.ID)
		}
	}

	if seen != 2 {
		t.Fatalf("expected two tool events, got %d", seen)
	}
}

// TestProcessPartNilArgsNormalizedToObject pins the contract that empty
// FunctionCall.Args produce "{}" rather than "null". Downstream tools that
// decode into map[string]any would break on Gemini-only otherwise.
func TestProcessPartNilArgsNormalizedToObject(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		args map[string]any
		want string
	}{
		{name: "nil args", args: nil, want: "{}"},
		{name: "empty args", args: map[string]any{}, want: "{}"},
		{
			name: "non-empty args",
			args: map[string]any{"q": "test"},
			want: `{"q":"test"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan Event, 4)
			stream := &googleStream{hasToolCalls: false}

			part := &genai.Part{
				FunctionCall: &genai.FunctionCall{
					Name: "search",
					Args: tc.args,
				},
			}

			if !stream.processPart(context.Background(), ch, part) {
				t.Fatal("processPart returned false")
			}

			close(ch)

			var sawDone bool

			for evt := range ch {
				if evt.Type == EventToolUseDone && evt.ToolCall != nil {
					sawDone = true

					if evt.ToolCall.Arguments != tc.want {
						t.Errorf(
							"Arguments: expected %q, got %q",
							tc.want, evt.ToolCall.Arguments,
						)
					}
				}
			}

			if !sawDone {
				t.Fatal("expected tool_use_done event")
			}
		})
	}
}
