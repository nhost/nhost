package agents

import (
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/agents/mock"
	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"github.com/nhost/nhost/services/ai/agents/tool"
	toolmock "github.com/nhost/nhost/services/ai/agents/tool/mock"
	"github.com/nhost/nhost/services/ai/hasura"
	"go.uber.org/mock/gomock"
)

var (
	errSSEWriteFailed   = errors.New("write failed")
	errProviderStreamUp = errors.New("provider stream broke")
)

func TestHasPendingApprovals(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		msgs []provider.Message
		want bool
	}{
		{
			name: "nil messages",
			msgs: nil,
			want: false,
		},
		{
			name: "empty messages",
			msgs: []provider.Message{},
			want: false,
		},
		{
			name: "last message is user",
			msgs: []provider.Message{
				{
					Role: provider.RoleUser, Content: "hello",
					ToolCalls: nil, ToolCallID: "", ToolName: "",
				},
			},
			want: false,
		},
		{
			name: "last message is assistant without tool calls",
			msgs: []provider.Message{
				{
					Role: provider.RoleAssistant, Content: "hi",
					ToolCalls: nil, ToolCallID: "", ToolName: "",
				},
			},
			want: false,
		},
		{
			name: "last message is assistant with tool calls",
			msgs: []provider.Message{
				{
					Role: provider.RoleUser, Content: "search for cats",
					ToolCalls: nil, ToolCallID: "", ToolName: "",
				},
				{
					Role: provider.RoleAssistant, Content: "Let me search",
					ToolCalls: []provider.ToolCall{
						{ID: "tc1", Name: "web_search", Arguments: `{"q":"cats"}`},
					},
					ToolCallID: "", ToolName: "",
				},
			},
			want: true,
		},
		{
			name: "tool calls followed by tool result",
			msgs: []provider.Message{
				{
					Role: provider.RoleAssistant, Content: "",
					ToolCalls: []provider.ToolCall{
						{ID: "tc1", Name: "search", Arguments: "{}"},
					},
					ToolCallID: "", ToolName: "",
				},
				{
					Role: provider.RoleTool, Content: "result",
					ToolCalls: nil, ToolCallID: "tc1", ToolName: "search",
				},
			},
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := hasPendingApprovals(tc.msgs); got != tc.want {
				t.Errorf("hasPendingApprovals() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestValidateDecisions(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		calls     []provider.ToolCall
		decisions []toolDecision
		wantErr   error // sentinel to check with errors.Is, or nil for "any error"
		wantOK    bool  // true when no error is expected
	}{
		{
			name: "all decisions present",
			calls: []provider.ToolCall{
				{ID: "tc1", Name: "a", Arguments: "{}"},
				{ID: "tc2", Name: "b", Arguments: "{}"},
			},
			decisions: []toolDecision{
				{ToolCallID: "tc1", Approved: true},
				{ToolCallID: "tc2", Approved: false},
			},
			wantOK: true,
		},
		{
			name: "missing decision",
			calls: []provider.ToolCall{
				{ID: "tc1", Name: "a", Arguments: "{}"},
				{ID: "tc2", Name: "b", Arguments: "{}"},
			},
			decisions: []toolDecision{
				{ToolCallID: "tc1", Approved: true},
			},
			wantErr: errMissingDecision,
		},
		{
			name:      "empty calls",
			calls:     nil,
			decisions: nil,
			wantOK:    true,
		},
		{
			name: "unknown decision id",
			calls: []provider.ToolCall{
				{ID: "tc1", Name: "a", Arguments: "{}"},
			},
			decisions: []toolDecision{
				{ToolCallID: "tc1", Approved: true},
				{ToolCallID: "stale-id", Approved: true},
			},
			wantErr: errUnknownDecision,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := validateDecisions(tc.calls, tc.decisions)

			if tc.wantOK {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}

				return
			}

			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if tc.wantErr != nil && !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got %v", tc.wantErr, err)
			}
		})
	}
}

func TestProcessDecisionsContinuesOnSSEWriteFailure(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	w := mock.NewMockEventWriter(ctrl)

	gomock.InOrder(
		w.EXPECT().
			WriteEvent("tool_result", gomock.Any()).
			Return(nil),
		w.EXPECT().
			WriteEvent("tool_denied", gomock.Any()).
			Return(errSSEWriteFailed),
		w.EXPECT().
			WriteEvent("tool_result", gomock.Any()).
			Return(errSSEWriteFailed),
	)
	w.EXPECT().Flush().Times(1)

	t1 := toolmock.NewMockTool(ctrl)
	t1.EXPECT().
		Definition().
		Return(provider.ToolDefinition{Name: "t1", Description: "", Parameters: nil}).
		Times(1)
	t1.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any()).
		Return("result-1", nil)

	t3 := toolmock.NewMockTool(ctrl)
	t3.EXPECT().
		Definition().
		Return(provider.ToolDefinition{Name: "t3", Description: "", Parameters: nil}).
		Times(1)
	t3.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any()).
		Return("result-3", nil)

	r := tool.NewRegistry()
	mustRegister(t, r, t1)
	mustRegister(t, r, t3)

	pendingCalls := []provider.ToolCall{
		{ID: "tc1", Name: "t1", Arguments: "{}"},
		{ID: "tc2", Name: "denied", Arguments: "{}"},
		{ID: "tc3", Name: "t3", Arguments: "{}"},
	}

	decisionMap := map[string]bool{
		"tc1": true,
		"tc2": false,
		"tc3": true,
	}

	rec := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(rec, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	results := processDecisions(c, pendingCalls, decisionMap, r, w, slog.Default())

	if len(results) != len(pendingCalls) {
		t.Fatalf(
			"expected %d results (one per pending call), got %d",
			len(pendingCalls), len(results),
		)
	}

	expected := []struct {
		id      string
		content string
	}{
		{id: "tc1", content: "result-1"},
		{id: "tc2", content: "Tool call denied by user"},
		{id: "tc3", content: "result-3"},
	}

	for i, e := range expected {
		if results[i].ToolCallID != e.id {
			t.Errorf(
				"results[%d].ToolCallID: expected %q, got %q",
				i, e.id, results[i].ToolCallID,
			)
		}

		if results[i].Content != e.content {
			t.Errorf(
				"results[%d].Content: expected %q, got %q",
				i, e.content, results[i].Content,
			)
		}

		if results[i].Role != provider.RoleTool {
			t.Errorf("results[%d].Role: expected %q, got %q",
				i, provider.RoleTool, results[i].Role)
		}
	}
}

// TestResumeAfterApprovalPersistsToolResultsOnLoopError verifies that when the
// agent loop fails *after* approved tools have already been executed, their
// outputs are still persisted. Without this, hasPendingApprovals() would keep
// reporting the session as wedged on the original assistant tool_calls
// message, and a retry through /approve-tools would re-run the (already
// executed) side-effecting tools.
func TestResumeAfterApprovalPersistsToolResultsOnLoopError(t *testing.T) {
	t.Parallel()

	const sessionID = "sess-1"

	approvedCall := provider.ToolCall{
		ID: "tc-approved", Name: "approved_tool", Arguments: "{}",
	}
	deniedCall := provider.ToolCall{
		ID: "tc-denied", Name: "denied_tool", Arguments: "{}",
	}
	pendingCalls := []provider.ToolCall{approvedCall, deniedCall}

	priorMessages := []provider.Message{
		{
			Role: provider.RoleUser, Content: "do it",
			ToolCalls: nil, ToolCallID: "", ToolName: "",
		},
		{
			Role: provider.RoleAssistant, Content: "",
			ToolCalls: pendingCalls, ToolCallID: "", ToolName: "",
		},
	}

	ctrl := gomock.NewController(t)

	approvedTool := toolmock.NewMockTool(ctrl)
	approvedTool.EXPECT().
		Definition().
		Return(provider.ToolDefinition{
			Name: "approved_tool", Description: "", Parameters: nil,
		}).
		AnyTimes()
	approvedTool.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any()).
		Return("approved-tool-output", nil)

	registry := tool.NewRegistry()
	mustRegister(t, registry, approvedTool)

	// Provider returns an error event so RunAgentLoop fails on its first
	// iteration, after processDecisions has already executed approved_tool.
	p := providermock.NewMockProvider(ctrl)
	p.EXPECT().
		StreamResponse(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(eventChan(provider.NewErrorEvent(errProviderStreamUp)))

	mockHasura := mock.NewMockhasuraClient(ctrl)

	var captured []*hasura.AiAgentMessagesInsertInput

	mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ any,
			objects []*hasura.AiAgentMessagesInsertInput,
			_ ...any,
		) (*hasura.InsertAgentMessages, error) {
			captured = objects
			return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
		})

	s := &Service{hasura: mockHasura}

	rec := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(rec, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	w := &fakeWriter{events: nil}

	agent := &hasura.GetAgent_AiAgent{
		ID: "agent-1", Instructions: "be helpful",
	}

	decisions := []toolDecision{
		{ToolCallID: approvedCall.ID, Approved: true},
		{ToolCallID: deniedCall.ID, Approved: false},
	}

	s.resumeAfterApproval(
		c, slog.Default(), w, p, agent, registry,
		priorMessages, pendingCalls, decisions, sessionID,
	)

	if len(captured) != len(pendingCalls) {
		t.Fatalf(
			"expected %d persisted messages (one per tool call), got %d",
			len(pendingCalls), len(captured),
		)
	}

	wantByID := map[string]string{
		approvedCall.ID: "approved-tool-output",
		deniedCall.ID:   "Tool call denied by user",
	}

	for _, obj := range captured {
		if obj.SessionID == nil || *obj.SessionID != sessionID {
			t.Errorf("session id: expected %q, got %v", sessionID, obj.SessionID)
		}

		if obj.Role == nil || *obj.Role != provider.RoleTool {
			t.Errorf("role: expected %q, got %v", provider.RoleTool, obj.Role)
		}

		if obj.ToolCallID == nil {
			t.Fatal("tool_call_id: expected non-nil")
		}

		want, ok := wantByID[*obj.ToolCallID]
		if !ok {
			t.Errorf("unexpected tool_call_id: %q", *obj.ToolCallID)
			continue
		}

		if obj.Content == nil || *obj.Content != want {
			t.Errorf(
				"content for %q: expected %q, got %v",
				*obj.ToolCallID, want, obj.Content,
			)
		}
	}

	errorEvents := 0
	for _, event := range w.events {
		if event == "error:internal error" {
			errorEvents++
		}
	}

	if errorEvents != 1 {
		t.Errorf("expected exactly 1 error SSE, got %d in %v", errorEvents, w.events)
	}
}
