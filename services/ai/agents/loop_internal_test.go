package agents

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"github.com/nhost/nhost/services/ai/agents/tool"
	"go.uber.org/mock/gomock"
)

const testSearchToolName = "search"

type fakeWriter struct {
	events []string
}

func (f *fakeWriter) WriteEvent(event, data string) error {
	f.events = append(f.events, fmt.Sprintf("%s:%s", event, data))

	return nil
}

func (f *fakeWriter) Flush() {}

type failWriter struct{}

func (f *failWriter) WriteEvent(_, _ string) error {
	return errors.New("write failed") //nolint:err113
}

func (f *failWriter) Flush() {}

type failOnEventWriter struct {
	events    []string
	failEvent string
}

func (f *failOnEventWriter) WriteEvent(event, data string) error {
	f.events = append(f.events, fmt.Sprintf("%s:%s", event, data))
	if event == f.failEvent {
		return errEventWriteFailed
	}

	return nil
}

func (f *failOnEventWriter) Flush() {}

type fakeTool struct {
	name   string
	result string
	err    error
}

func (f *fakeTool) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name:        f.name,
		Description: "fake",
		Parameters:  map[string]any{},
	}
}

func (f *fakeTool) Execute(_ context.Context, _ string, _ *slog.Logger) (string, error) {
	return f.result, f.err
}

func mustRegister(t *testing.T, r *tool.Registry, tt tool.Tool) {
	t.Helper()

	if err := r.Register(tt); err != nil {
		t.Fatalf("unexpected register error for %q: %v", tt.Definition().Name, err)
	}
}

func TestProcessStreamEvents(t *testing.T) {
	t.Parallel()

	t.Run("content delta events", func(t *testing.T) {
		t.Parallel()

		ch := make(chan provider.Event, 3)
		ch <- provider.NewContentDeltaEvent("hello ")

		ch <- provider.NewContentDeltaEvent("world")

		ch <- provider.NewCompleteEvent(provider.StopReasonEndTurn)

		close(ch)

		w := &fakeWriter{events: nil}

		result, err := processStreamEvents(ch, w)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.content != "hello world" {
			t.Errorf("expected 'hello world', got %q", result.content)
		}

		if result.stopReason != provider.StopReasonEndTurn {
			t.Errorf("expected stop reason 'end_turn', got %q", result.stopReason)
		}

		if len(result.toolCalls) != 0 {
			t.Errorf("expected 0 tool calls, got %d", len(result.toolCalls))
		}
	})

	t.Run("tool use events", func(t *testing.T) {
		t.Parallel()

		tc := &provider.ToolCall{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`}

		ch := make(chan provider.Event, 4)
		ch <- provider.NewToolEvent(provider.EventToolUseStart, tc)

		ch <- provider.NewToolEvent(provider.EventToolUseDelta, tc)

		ch <- provider.NewToolEvent(provider.EventToolUseDone, tc)

		ch <- provider.NewCompleteEvent(provider.StopReasonToolUse)

		close(ch)

		w := &fakeWriter{events: nil}

		result, err := processStreamEvents(ch, w)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(result.toolCalls) != 1 {
			t.Fatalf("expected 1 tool call, got %d", len(result.toolCalls))
		}

		if result.toolCalls[0].Name != testSearchToolName {
			t.Errorf("expected tool name 'search', got %q", result.toolCalls[0].Name)
		}

		if result.stopReason != provider.StopReasonToolUse {
			t.Errorf("expected stop reason 'tool_use', got %q", result.stopReason)
		}
	})

	t.Run("error event", func(t *testing.T) {
		t.Parallel()

		ch := make(chan provider.Event, 1)
		ch <- provider.NewErrorEvent(errors.New("provider error")) //nolint:err113

		close(ch)

		w := &fakeWriter{events: nil}

		_, err := processStreamEvents(ch, w)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if err.Error() != "provider error" {
			t.Errorf("expected 'provider error', got %q", err.Error())
		}
	})

	t.Run("error event with nil error", func(t *testing.T) {
		t.Parallel()

		ch := make(chan provider.Event, 1)
		ch <- provider.Event{
			Type: provider.EventError, Content: "",
			ToolCall: nil, Error: nil, StopReason: "",
		}

		close(ch)

		w := &fakeWriter{events: nil}

		_, err := processStreamEvents(ch, w)
		if !errors.Is(err, errUnknownProvider) {
			t.Fatalf("expected errUnknownProvider, got %v", err)
		}
	})
}

func TestProcessStreamEventsEmitsStopReason(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		stopReason string
		wantEvent  bool
	}{
		{name: "max tokens", stopReason: provider.StopReasonMaxTokens, wantEvent: true},
		{name: "refusal", stopReason: provider.StopReasonRefusal, wantEvent: true},
		{name: "end turn", stopReason: provider.StopReasonEndTurn, wantEvent: false},
		{name: "tool use", stopReason: provider.StopReasonToolUse, wantEvent: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ch := make(chan provider.Event, 1)
			ch <- provider.NewCompleteEvent(tc.stopReason)

			close(ch)

			w := &fakeWriter{events: nil}

			result, err := processStreamEvents(ch, w)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.stopReason != tc.stopReason {
				t.Errorf("expected stop reason %q, got %q", tc.stopReason, result.stopReason)
			}

			emitted := false

			for _, e := range w.events {
				if strings.HasPrefix(e, "stop_reason:") {
					emitted = true
				}
			}

			if emitted != tc.wantEvent {
				t.Errorf(
					"stop_reason event emitted = %v, want %v (events: %v)",
					emitted, tc.wantEvent, w.events,
				)
			}
		})
	}
}

func TestHandleStreamEventWriterError(t *testing.T) {
	t.Parallel()

	var (
		content    strings.Builder
		toolCalls  []provider.ToolCall
		stopReason string
	)

	w := &failWriter{}

	err := handleStreamEvent(
		provider.NewContentDeltaEvent("text"),
		w,
		&content,
		&toolCalls,
		&stopReason,
	)
	if err == nil {
		t.Fatal("expected error from writer failure")
	}
}

var (
	errEventWriteFailed = errors.New("event write failed")
	errExecForTest      = errors.New("exec failed")
)

func TestExecuteToolCalls(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		registered  []*fakeTool
		toolCalls   []provider.ToolCall
		useFailedWr bool
		wantErr     bool
		wantContent string // skipped when wantErr is true or len(toolCalls)==0
		wantRole    string
	}{
		{
			name:       "successful execution",
			registered: []*fakeTool{{name: testSearchToolName, result: "found it", err: nil}},
			toolCalls: []provider.ToolCall{
				{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`},
			},
			wantContent: "found it",
			wantRole:    provider.RoleTool,
		},
		{
			name:        "tool not found",
			registered:  nil,
			toolCalls:   []provider.ToolCall{{ID: "tc1", Name: "unknown_tool", Arguments: "{}"}},
			wantContent: "Tool not found: unknown_tool",
			wantRole:    provider.RoleTool,
		},
		{
			name:        "tool execution error",
			registered:  []*fakeTool{{name: "failing", result: "", err: errExecForTest}},
			toolCalls:   []provider.ToolCall{{ID: "tc1", Name: "failing", Arguments: "{}"}},
			wantContent: toolExecutionFailMsg,
			wantRole:    provider.RoleTool,
		},
		{
			name:        "writer error during tool result",
			registered:  []*fakeTool{{name: "t1", result: "ok", err: nil}},
			toolCalls:   []provider.ToolCall{{ID: "tc1", Name: "t1", Arguments: "{}"}},
			useFailedWr: true,
			wantErr:     true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			r := tool.NewRegistry()
			for _, ft := range tc.registered {
				mustRegister(t, r, ft)
			}

			var w EventWriter
			if tc.useFailedWr {
				w = &failWriter{}
			} else {
				w = &fakeWriter{events: nil}
			}

			results, err := executeToolCalls(
				context.Background(), tc.toolCalls, r, w, slog.Default(),
			)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(results) != len(tc.toolCalls) {
				t.Fatalf(
					"expected %d results, got %d", len(tc.toolCalls), len(results),
				)
			}

			if results[0].Role != tc.wantRole {
				t.Errorf("role: expected %q, got %q", tc.wantRole, results[0].Role)
			}

			if results[0].Content != tc.wantContent {
				t.Errorf(
					"content: expected %q, got %q", tc.wantContent, results[0].Content,
				)
			}
		})
	}
}

// eventChan returns a closed channel buffered with the given events. Used to
// stub provider.Provider.StreamResponse return values.
func eventChan(events ...provider.Event) <-chan provider.Event {
	ch := make(chan provider.Event, len(events))
	for _, e := range events {
		ch <- e
	}

	close(ch)

	return ch
}

// expectStreamResponses queues an InOrder sequence of StreamResponse return
// values on the mock, one per channel. Use to drive a multi-iteration
// RunAgentLoop call.
func expectStreamResponses(p *providermock.MockProvider, returns ...<-chan provider.Event) {
	calls := make([]any, 0, len(returns))

	for _, ch := range returns {
		calls = append(calls, p.EXPECT().
			StreamResponse(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
			Return(ch))
	}

	gomock.InOrder(calls...)
}

func TestRunAgentLoopSimpleResponse(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewContentDeltaEvent("hello"),
		provider.NewCompleteEvent(provider.StopReasonEndTurn),
	))

	w := &fakeWriter{events: nil}
	r := tool.NewRegistry()

	result, err := RunAgentLoop(
		context.Background(), p, "system", nil, r, w, slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(result.Messages))
	}

	if result.Messages[0].Role != provider.RoleAssistant {
		t.Errorf("expected assistant role, got %q", result.Messages[0].Role)
	}

	if result.Messages[0].Content != "hello" {
		t.Errorf("expected content 'hello', got %q", result.Messages[0].Content)
	}

	if result.PendingCalls != nil {
		t.Errorf("expected nil PendingCalls, got %v", result.PendingCalls)
	}
}

func TestRunAgentLoopToolCallLoop(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	tc := &provider.ToolCall{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`}
	expectStreamResponses(
		p,
		eventChan(
			provider.NewToolEvent(provider.EventToolUseStart, tc),
			provider.NewToolEvent(provider.EventToolUseDone, tc),
			provider.NewCompleteEvent(provider.StopReasonToolUse),
		),
		eventChan(
			provider.NewContentDeltaEvent("done"),
			provider.NewCompleteEvent(provider.StopReasonEndTurn),
		),
	)

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: testSearchToolName, result: "result", err: nil})

	w := &fakeWriter{events: nil}

	result, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// First call: tool use → tool result, second call: end turn.
	// Expected messages: assistant(tool_call) + tool_result + assistant(final).
	if len(result.Messages) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(result.Messages))
	}

	if result.Messages[0].Role != provider.RoleAssistant {
		t.Errorf("expected assistant, got %q", result.Messages[0].Role)
	}

	if result.Messages[1].Role != provider.RoleTool {
		t.Errorf("expected tool, got %q", result.Messages[1].Role)
	}

	if result.Messages[2].Role != provider.RoleAssistant {
		t.Errorf("expected assistant, got %q", result.Messages[2].Role)
	}

	if result.PendingCalls != nil {
		t.Errorf("expected nil PendingCalls, got %v", result.PendingCalls)
	}
}

func TestRunAgentLoopKeepsToolResultWhenToolResultSSEFails(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	tc := &provider.ToolCall{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`}
	expectStreamResponses(p, eventChan(
		provider.NewToolEvent(provider.EventToolUseStart, tc),
		provider.NewToolEvent(provider.EventToolUseDone, tc),
		provider.NewCompleteEvent(provider.StopReasonToolUse),
	))

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: testSearchToolName, result: "result to persist", err: nil})

	w := &failOnEventWriter{events: nil, failEvent: "tool_result"}

	result, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if !errors.Is(err, errEventWriteFailed) {
		t.Fatalf("expected %v, got %v", errEventWriteFailed, err)
	}

	if len(result.Messages) != 2 {
		t.Fatalf("expected assistant call and tool result messages, got %d", len(result.Messages))
	}

	if result.Messages[0].Role != provider.RoleAssistant {
		t.Errorf("message 0 role: expected %q, got %q",
			provider.RoleAssistant, result.Messages[0].Role)
	}

	toolResult := result.Messages[1]
	if toolResult.Role != provider.RoleTool {
		t.Errorf("message 1 role: expected %q, got %q", provider.RoleTool, toolResult.Role)
	}

	if toolResult.Content != "result to persist" {
		t.Errorf("tool result content: expected %q, got %q",
			"result to persist", toolResult.Content)
	}

	if toolResult.ToolCallID != tc.ID {
		t.Errorf("tool result id: expected %q, got %q", tc.ID, toolResult.ToolCallID)
	}

	if toolResult.ToolName != tc.Name {
		t.Errorf("tool result name: expected %q, got %q", tc.Name, toolResult.ToolName)
	}

	if result.PendingCalls != nil {
		t.Errorf("expected nil PendingCalls, got %v", result.PendingCalls)
	}
}

func TestRunAgentLoopStreamErrorPropagates(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewErrorEvent(errors.New("stream broke")), //nolint:err113
	))

	w := &fakeWriter{events: nil}
	r := tool.NewRegistry()

	_, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestRunAgentLoopApprovalPause(t *testing.T) {
	t.Parallel()

	tc := &provider.ToolCall{ID: "tc1", Name: "dangerous", Arguments: `{}`}

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewToolEvent(provider.EventToolUseStart, tc),
		provider.NewToolEvent(provider.EventToolUseDone, tc),
		provider.NewCompleteEvent(provider.StopReasonToolUse),
	))

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: "dangerous", result: "ok", err: nil})
	r.SetRequiresApproval("dangerous")

	w := &fakeWriter{events: nil}

	result, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.PendingCalls == nil {
		t.Fatal("expected PendingCalls to be non-nil")
	}

	if len(result.PendingCalls) != 1 {
		t.Fatalf("expected 1 pending call, got %d", len(result.PendingCalls))
	}

	if result.PendingCalls[0].Name != "dangerous" {
		t.Errorf("expected pending call 'dangerous', got %q", result.PendingCalls[0].Name)
	}

	// Should have 1 message: the assistant message with tool calls.
	if len(result.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(result.Messages))
	}

	if result.Messages[0].Role != provider.RoleAssistant {
		t.Errorf("expected assistant role, got %q", result.Messages[0].Role)
	}

	if len(result.Messages[0].ToolCalls) != 1 {
		t.Errorf("expected 1 tool call in message, got %d", len(result.Messages[0].ToolCalls))
	}
}

func TestRunAgentLoopNoApprovalNeeded(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)
	tc := &provider.ToolCall{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`}
	expectStreamResponses(
		p,
		eventChan(
			provider.NewToolEvent(provider.EventToolUseStart, tc),
			provider.NewToolEvent(provider.EventToolUseDone, tc),
			provider.NewCompleteEvent(provider.StopReasonToolUse),
		),
		eventChan(
			provider.NewContentDeltaEvent("done"),
			provider.NewCompleteEvent(provider.StopReasonEndTurn),
		),
	)

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: testSearchToolName, result: "result", err: nil})

	w := &fakeWriter{events: nil}

	result, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.PendingCalls != nil {
		t.Errorf("expected nil PendingCalls, got %v", result.PendingCalls)
	}

	if len(result.Messages) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(result.Messages))
	}
}

func TestRunAgentLoopMaxIterations(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	p := providermock.NewMockProvider(ctrl)

	tc := &provider.ToolCall{ID: "tc1", Name: testSearchToolName, Arguments: `{"q":"test"}`}

	p.EXPECT().
		StreamResponse(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			_ string,
			_ []provider.Message,
			_ []provider.ToolDefinition,
		) <-chan provider.Event {
			return eventChan(
				provider.NewToolEvent(provider.EventToolUseStart, tc),
				provider.NewToolEvent(provider.EventToolUseDone, tc),
				provider.NewCompleteEvent(provider.StopReasonToolUse),
			)
		}).
		Times(maxIterations)

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: testSearchToolName, result: "result", err: nil})

	w := &fakeWriter{events: nil}

	result, err := RunAgentLoop(
		context.Background(), p, "", nil, r, w, slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.PendingCalls != nil {
		t.Errorf("expected nil PendingCalls, got %v", result.PendingCalls)
	}

	if len(result.Messages) == 0 {
		t.Fatal("expected messages, got 0")
	}

	last := result.Messages[len(result.Messages)-1]
	if last.Role == provider.RoleAssistant && len(last.ToolCalls) > 0 {
		t.Errorf(
			"last message is assistant+tool_calls — session would be trapped in pending-approvals state",
		)
	}

	foundError := false

	for _, e := range w.events {
		if strings.HasPrefix(e, "error:"+maxIterationsExceededWarn) {
			foundError = true
			break
		}
	}

	if !foundError {
		t.Errorf(
			"expected 'error: %s' event, got events: %v",
			maxIterationsExceededWarn, w.events,
		)
	}
}
