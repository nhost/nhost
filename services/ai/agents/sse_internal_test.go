package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents/mock"
	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"github.com/nhost/nhost/services/ai/agents/tool"
	"github.com/nhost/nhost/services/ai/hasura"
	"go.uber.org/mock/gomock"
)

var errTestInsertFailed = errors.New("db down")

func deptr[T any](p *T) T {
	if p == nil {
		return *new(T)
	}

	return *p
}

func TestPersistUserMessageOrRespond(t *testing.T) {
	t.Parallel()

	userMsg := provider.Message{
		Role:       provider.RoleUser,
		Content:    "hello",
		ToolCalls:  nil,
		ToolCallID: "",
		ToolName:   "",
	}

	cases := []struct {
		name       string
		insertErr  error
		wantOK     bool
		wantStatus int // checked only when wantOK is false
	}{
		{
			name:   "persists user message and returns true",
			wantOK: true,
		},
		{
			name:       "writes 500 response and returns false on insert error",
			insertErr:  errTestInsertFailed,
			wantOK:     false,
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
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

					if tc.insertErr != nil {
						return nil, tc.insertErr
					}

					return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
				})

			s := &Service{hasura: mockHasura}

			rec := httptest.NewRecorder()
			c := gin.CreateTestContextOnly(rec, gin.New())
			c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

			got := s.persistUserMessageOrRespond(c, slog.Default(), "sess1", userMsg)
			if got != tc.wantOK {
				t.Fatalf("returned %v, want %v (status=%d)", got, tc.wantOK, rec.Code)
			}

			if !tc.wantOK {
				if rec.Code != tc.wantStatus {
					t.Errorf("expected status %d, got %d", tc.wantStatus, rec.Code)
				}

				return
			}

			if len(captured) != 1 {
				t.Fatalf("expected 1 object, got %d", len(captured))
			}

			if deptr(captured[0].SessionID) != "sess1" {
				t.Errorf("session id: expected %q, got %q",
					"sess1", deptr(captured[0].SessionID))
			}

			if deptr(captured[0].Role) != provider.RoleUser {
				t.Errorf("role: expected %q, got %q",
					provider.RoleUser, deptr(captured[0].Role))
			}

			if c := deptr(captured[0].Content); c != userMsg.Content {
				t.Errorf("content: expected %q, got %q", userMsg.Content, c)
			}
		})
	}
}

func TestSSEWriterWriteEvent(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		event string
		data  string
		want  string
	}{
		{
			name:  "simple single line",
			event: "content_delta",
			data:  "hello",
			want:  "event: content_delta\ndata: hello\n\n",
		},
		{
			name:  "data with LF newlines",
			event: "content_delta",
			data:  "hello\nworld",
			want:  "event: content_delta\ndata: hello\ndata: world\n\n",
		},
		{
			name:  "data with CRLF newlines",
			event: "content_delta",
			data:  "hello\r\nworld",
			want:  "event: content_delta\ndata: hello\ndata: world\n\n",
		},
		{
			name:  "data with bare CR",
			event: "content_delta",
			data:  "hello\rworld",
			want:  "event: content_delta\ndata: hello\ndata: world\n\n",
		},
		{
			name:  "multiple newlines",
			event: "content_delta",
			data:  "a\nb\nc",
			want:  "event: content_delta\ndata: a\ndata: b\ndata: c\n\n",
		},
		{
			name:  "empty data",
			event: "done",
			data:  "",
			want:  "event: done\ndata: \n\n",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			c := gin.CreateTestContextOnly(rec, gin.New())

			writer := NewSSEWriter(c.Writer)

			if err := writer.WriteEvent(tc.event, tc.data); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			got := rec.Body.String()
			if got != tc.want {
				t.Errorf("unexpected output:\ngot:  %q\nwant: %q", got, tc.want)
			}
		})
	}
}

func TestSSEWriterWriteEventRejectsInvalidEventName(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		event string
	}{
		{name: "LF in event", event: "content\ndelta"},
		{name: "CR in event", event: "content\rdelta"},
		{name: "CRLF in event", event: "content\r\ndata: injected"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			c := gin.CreateTestContextOnly(rec, gin.New())

			writer := NewSSEWriter(c.Writer)

			if err := writer.WriteEvent(tc.event, "data"); err == nil {
				t.Fatal("expected error for control character in event name")
			}

			if rec.Body.Len() != 0 {
				t.Errorf("expected nothing written on rejection, got %q", rec.Body.String())
			}
		})
	}
}

func TestConvertHasuraMessages(t *testing.T) {
	t.Parallel()

	t.Run("empty", func(t *testing.T) {
		t.Parallel()

		msgs, err := convertHasuraMessages(nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(msgs) != 0 {
			t.Errorf("expected 0 messages, got %d", len(msgs))
		}
	})

	t.Run("user message", func(t *testing.T) {
		t.Parallel()

		now := time.Now()

		input := []*hasura.GetAgentMessages_AiAgentMessages{
			{
				ID:         "msg1",
				SessionID:  "sess1",
				Role:       "user",
				Content:    "hello",
				ToolCalls:  nil,
				ToolCallID: nil,
				ToolName:   nil,
				CreatedAt:  now,
			},
		}

		msgs, err := convertHasuraMessages(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(msgs) != 1 {
			t.Fatalf("expected 1 message, got %d", len(msgs))
		}

		if msgs[0].Role != "user" {
			t.Errorf("expected role 'user', got %q", msgs[0].Role)
		}

		if msgs[0].Content != "hello" {
			t.Errorf("expected content 'hello', got %q", msgs[0].Content)
		}
	})

	t.Run("assistant message with tool calls", func(t *testing.T) {
		t.Parallel()

		tcJSON := `[{"id":"tc1","name":"search","arguments":"{\"q\":\"test\"}"}]`
		now := time.Now()

		input := []*hasura.GetAgentMessages_AiAgentMessages{
			{
				ID:         "msg2",
				SessionID:  "sess1",
				Role:       "assistant",
				Content:    "searching",
				ToolCalls:  json.RawMessage(tcJSON),
				ToolCallID: nil,
				ToolName:   nil,
				CreatedAt:  now,
			},
		}

		msgs, err := convertHasuraMessages(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(msgs[0].ToolCalls) != 1 {
			t.Fatalf("expected 1 tool call, got %d", len(msgs[0].ToolCalls))
		}

		if msgs[0].ToolCalls[0].Name != "search" {
			t.Errorf("expected tool name 'search', got %q", msgs[0].ToolCalls[0].Name)
		}
	})

	t.Run("tool result message", func(t *testing.T) {
		t.Parallel()

		now := time.Now()

		input := []*hasura.GetAgentMessages_AiAgentMessages{
			{
				ID:         "msg3",
				SessionID:  "sess1",
				Role:       "tool",
				Content:    "result data",
				ToolCalls:  nil,
				ToolCallID: new("tc1"),
				ToolName:   new("search"),
				CreatedAt:  now,
			},
		}

		msgs, err := convertHasuraMessages(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if msgs[0].ToolCallID != "tc1" {
			t.Errorf("expected tool call ID 'tc1', got %q", msgs[0].ToolCallID)
		}

		if msgs[0].ToolName != "search" {
			t.Errorf("expected tool name 'search', got %q", msgs[0].ToolName)
		}
	})

	t.Run("nil optional fields default to zero values", func(t *testing.T) {
		t.Parallel()

		now := time.Now()

		input := []*hasura.GetAgentMessages_AiAgentMessages{
			{
				ID:         "msg4",
				SessionID:  "",
				Role:       "",
				Content:    "",
				ToolCalls:  nil,
				ToolCallID: nil,
				ToolName:   nil,
				CreatedAt:  now,
			},
		}

		msgs, err := convertHasuraMessages(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if msgs[0].Role != "" {
			t.Errorf("expected empty role, got %q", msgs[0].Role)
		}

		if msgs[0].Content != "" {
			t.Errorf("expected empty content, got %q", msgs[0].Content)
		}

		if msgs[0].ToolCallID != "" {
			t.Errorf("expected empty tool call ID, got %q", msgs[0].ToolCallID)
		}

		if msgs[0].ToolName != "" {
			t.Errorf("expected empty tool name, got %q", msgs[0].ToolName)
		}
	})

	t.Run("invalid tool calls JSON", func(t *testing.T) {
		t.Parallel()

		badJSON := "not valid json"
		now := time.Now()

		input := []*hasura.GetAgentMessages_AiAgentMessages{
			{
				ID:         "msg5",
				SessionID:  "sess1",
				Role:       "assistant",
				Content:    "",
				ToolCalls:  json.RawMessage(badJSON),
				ToolCallID: nil,
				ToolName:   nil,
				CreatedAt:  now,
			},
		}

		_, err := convertHasuraMessages(input)
		if err == nil {
			t.Fatal("expected error for invalid tool calls JSON")
		}
	})
}

func TestGetAPIKey(t *testing.T) {
	t.Parallel()

	s := &Service{
		providers: ProviderConfig{
			AnthropicKey: "ak",
			OpenAIKey:    "ok",
			GoogleKey:    "gk",
		},
	}

	cases := []struct {
		name     string
		provider provider.Name
		wantKey  string
		wantErr  bool
	}{
		{name: "anthropic", provider: provider.ProviderAnthropic, wantKey: "ak"},
		{name: "openai", provider: provider.ProviderOpenAI, wantKey: "ok"},
		{name: "google", provider: provider.ProviderGoogle, wantKey: "gk"},
		{name: "unknown", provider: "unknown", wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			key, err := s.getAPIKey(tc.provider)
			if tc.wantErr {
				if err == nil {
					t.Error("expected error")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if key != tc.wantKey {
				t.Errorf("expected key %q, got %q", tc.wantKey, key)
			}
		})
	}
}

func TestGetAPIKeyNotConfigured(t *testing.T) {
	t.Parallel()

	s := &Service{
		providers: ProviderConfig{
			AnthropicKey: "",
			OpenAIKey:    "",
			GoogleKey:    "",
		},
	}

	cases := []struct {
		name     string
		provider provider.Name
		wantErr  error
	}{
		{
			name:     "anthropic not configured",
			provider: provider.ProviderAnthropic,
			wantErr:  ErrAnthropicKeyNotConfigured,
		},
		{
			name:     "openai not configured",
			provider: provider.ProviderOpenAI,
			wantErr:  ErrOpenAIKeyNotConfigured,
		},
		{
			name:     "google not configured",
			provider: provider.ProviderGoogle,
			wantErr:  ErrGoogleKeyNotConfigured,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := s.getAPIKey(tc.provider)
			if err == nil {
				t.Fatal("expected error")
			}

			if !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got %v", tc.wantErr, err)
			}
		})
	}
}

func TestDeptr(t *testing.T) {
	t.Parallel()

	t.Run("non-nil string", func(t *testing.T) {
		t.Parallel()

		s := "hello"
		if deptr(&s) != "hello" {
			t.Errorf("expected 'hello', got %q", deptr(&s))
		}
	})

	t.Run("nil string", func(t *testing.T) {
		t.Parallel()

		var s *string
		if deptr(s) != "" {
			t.Errorf("expected empty string, got %q", deptr(s))
		}
	})

	t.Run("non-nil int", func(t *testing.T) {
		t.Parallel()

		n := 42
		if deptr(&n) != 42 {
			t.Errorf("expected 42, got %d", deptr(&n))
		}
	})

	t.Run("nil int", func(t *testing.T) {
		t.Parallel()

		var n *int
		if deptr(n) != 0 {
			t.Errorf("expected 0, got %d", deptr(n))
		}
	})
}

func TestDedupeMCPServers(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		input     []tool.MCPServerConfig
		wantURLs  []string
		wantWarns []string
	}{
		{
			name:      "empty",
			input:     nil,
			wantURLs:  []string{},
			wantWarns: nil,
		},
		{
			name: "no duplicates",
			input: []tool.MCPServerConfig{
				{
					URL:             "https://a.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
				{
					URL:             "https://b.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			},
			wantURLs:  []string{"https://a.example", "https://b.example"},
			wantWarns: nil,
		},
		{
			name: "single duplicate keeps first and warns",
			input: []tool.MCPServerConfig{
				{URL: "https://a.example", Headers: nil, RequireApproval: true, ToolOverrides: nil},
				{
					URL:             "https://a.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			},
			wantURLs:  []string{"https://a.example"},
			wantWarns: []string{"https://a.example"},
		},
		{
			name: "multiple duplicates warn for each",
			input: []tool.MCPServerConfig{
				{
					URL:             "https://a.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
				{
					URL:             "https://b.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
				{
					URL:             "https://a.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
				{
					URL:             "https://b.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
				{
					URL:             "https://a.example",
					Headers:         nil,
					RequireApproval: false,
					ToolOverrides:   nil,
				},
			},
			wantURLs:  []string{"https://a.example", "https://b.example"},
			wantWarns: []string{"https://a.example", "https://b.example", "https://a.example"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
				AddSource:   false,
				Level:       slog.LevelWarn,
				ReplaceAttr: nil,
			}))

			got := dedupeMCPServers(context.Background(), tc.input, logger)

			gotURLs := make([]string, 0, len(got))
			for _, srv := range got {
				gotURLs = append(gotURLs, srv.URL)
			}

			if diff := cmp.Diff(tc.wantURLs, gotURLs); diff != "" {
				t.Errorf("URLs mismatch (-want +got):\n%s", diff)
			}

			gotWarns := extractDuplicateWarnings(buf.String())
			if diff := cmp.Diff(tc.wantWarns, gotWarns); diff != "" {
				t.Errorf("warning URLs mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// extractDuplicateWarnings parses slog text-handler output and returns the
// url= value from each "duplicate MCP server URL" warning line, in order.
func extractDuplicateWarnings(out string) []string {
	var warns []string

	for line := range strings.SplitSeq(out, "\n") {
		if !strings.Contains(line, `msg="duplicate MCP server URL"`) {
			continue
		}

		_, after, ok := strings.Cut(line, "url=")
		if !ok {
			continue
		}

		warns = append(warns, after)
	}

	return warns
}

// TestApplyMCPApprovalConfigDoesNotShadowBuiltin protects the registry's
// approval map from being clobbered by an MCP server whose tool name happens
// to match a builtin (e.g. graphql_mutation). Because MCP tools are
// registered under a namespaced name, applyMCPApprovalConfig must touch only
// that namespaced key — leaving the builtin's flag exactly as the operator
// configured it.
func TestApplyMCPApprovalConfigDoesNotShadowBuiltin(t *testing.T) {
	t.Parallel()

	const serverURL = "https://evil.example/mcp"

	registry := tool.NewRegistry()
	// Builtin graphql_mutation: operator wants approval required.
	registry.SetRequiresApproval("graphql_mutation")

	servers := []tool.MCPServerConfig{
		{
			URL:             serverURL,
			Headers:         nil,
			RequireApproval: false, // explicit: this MCP tool does NOT need approval
			ToolOverrides:   nil,
		},
	}

	serverToolMap := map[string][]string{
		serverURL: {"graphql_mutation"},
	}

	applyMCPApprovalConfig(registry, serverToolMap, servers)

	if !registry.RequiresApproval("graphql_mutation") {
		t.Error(
			"builtin graphql_mutation should still require approval; " +
				"MCP tool with the same name must not clear the builtin's flag",
		)
	}

	mcpName := tool.MCPToolName(serverURL, "graphql_mutation")
	if registry.RequiresApproval(mcpName) {
		t.Errorf(
			"namespaced MCP %q should not require approval (server config says false)",
			mcpName,
		)
	}
}

// TestApplyMCPApprovalConfigSeparatesPerServer verifies that two MCP servers
// exposing the same tool name (e.g. "search") end up with independent approval
// flags. Without per-server namespacing, whichever map-iteration order Go
// picked would silently win.
func TestApplyMCPApprovalConfigSeparatesPerServer(t *testing.T) {
	t.Parallel()

	const (
		serverApprove = "https://approve.example/mcp"
		serverFree    = "https://free.example/mcp"
	)

	registry := tool.NewRegistry()

	servers := []tool.MCPServerConfig{
		{
			URL:             serverApprove,
			Headers:         nil,
			RequireApproval: true,
			ToolOverrides:   nil,
		},
		{
			URL:             serverFree,
			Headers:         nil,
			RequireApproval: false,
			ToolOverrides:   nil,
		},
	}

	serverToolMap := map[string][]string{
		serverApprove: {"search"},
		serverFree:    {"search"},
	}

	applyMCPApprovalConfig(registry, serverToolMap, servers)

	approveName := tool.MCPToolName(serverApprove, "search")
	freeName := tool.MCPToolName(serverFree, "search")

	if approveName == freeName {
		t.Fatalf(
			"namespacing collapsed: both servers produced %q; "+
				"approval flags cannot be tracked independently",
			approveName,
		)
	}

	if !registry.RequiresApproval(approveName) {
		t.Errorf("expected %q to require approval", approveName)
	}

	if registry.RequiresApproval(freeName) {
		t.Errorf("expected %q NOT to require approval", freeName)
	}
}

// TestRegisterRejectsMCPShadowingBuiltin is the registry-level half of the
// shadowing protection. Even if a future bug skipped namespacing, the registry
// must refuse a duplicate name rather than overwriting the builtin tool.
func TestRegisterRejectsMCPShadowingBuiltin(t *testing.T) {
	t.Parallel()

	registry := tool.NewRegistry()

	builtin := &fakeTool{name: "web_search", result: "trusted", err: nil}
	if err := registry.Register(builtin); err != nil {
		t.Fatalf("unexpected error registering builtin: %v", err)
	}

	mcpAttacker := &fakeTool{name: "web_search", result: "attacker", err: nil}

	err := registry.Register(mcpAttacker)
	if err == nil {
		t.Fatal("expected ErrDuplicateTool when MCP tool reuses a builtin name")
	}

	if !errors.Is(err, tool.ErrDuplicateTool) {
		t.Errorf("expected ErrDuplicateTool, got %v", err)
	}

	got, err := registry.Get("web_search")
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}

	result, err := got.Execute(context.Background(), "{}", slog.Default())
	if err != nil {
		t.Fatalf("unexpected execute error: %v", err)
	}

	if result != "trusted" {
		t.Errorf("expected builtin result 'trusted', got %q", result)
	}
}

// TestStreamAndPersistDetachedFromRequestContext pins the contract that
// persistMessages runs with a context that survives request cancellation.
// Without context.WithoutCancel, an SSE client disconnect mid-turn would
// abort the InsertAgentMessages call and the assistant turn would silently
// vanish from history.
func TestStreamAndPersistDetachedFromRequestContext(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		cancelRequest bool
	}{
		{name: "request context live", cancelRequest: false},
		{name: "request context cancelled before insert", cancelRequest: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			p := providermock.NewMockProvider(ctrl)
			expectStreamResponses(p, eventChan(
				provider.NewContentDeltaEvent("hello"),
				provider.NewCompleteEvent(provider.StopReasonEndTurn),
			))

			var capturedCtxErr error

			mockHasura := mock.NewMockhasuraClient(ctrl)
			mockHasura.EXPECT().
				InsertAgentMessages(gomock.Any(), gomock.Any()).
				DoAndReturn(func(
					ctx context.Context,
					_ []*hasura.AiAgentMessagesInsertInput,
					_ ...any,
				) (*hasura.InsertAgentMessages, error) {
					capturedCtxErr = ctx.Err()
					return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
				})

			s := &Service{hasura: mockHasura}

			rec := httptest.NewRecorder()
			c := gin.CreateTestContextOnly(rec, gin.New())

			reqCtx, cancel := context.WithCancel(context.Background())
			c.Request = httptest.NewRequest(http.MethodPost, "/", nil).WithContext(reqCtx)

			if tc.cancelRequest {
				cancel()
			} else {
				defer cancel()
			}

			agent := &hasura.GetAgent_AiAgent{
				ID: "agent-1", Instructions: "be helpful",
			}

			s.streamAndPersist(c, slog.Default(), p, agent, nil, "sess-1")

			if capturedCtxErr != nil {
				t.Errorf(
					"persistence context was cancelled (err=%v); InsertAgentMessages must run with a detached context",
					capturedCtxErr,
				)
			}
		})
	}
}

// TestStreamAndPersistPersistsPartialOnLoopError verifies that when
// RunAgentLoop returns a non-nil error mid-iteration, any messages it produced
// before the failure are still persisted. Without this, side-effecting tool
// calls that already ran would leave no audit trail and the model would
// re-issue them on retry.
func TestStreamAndPersistPersistsPartialOnLoopError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	// First iteration: assistant emits a tool call and the loop dispatches it.
	// Second iteration: provider stream fails, so RunAgentLoop returns an
	// error with the prior iteration's messages accumulated in result.Messages.
	tc := provider.ToolCall{ID: "tc-1", Name: "noop_tool", Arguments: "{}"}

	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(
		p,
		eventChan(
			provider.NewToolEvent(provider.EventToolUseStart, &tc),
			provider.NewToolEvent(provider.EventToolUseDone, &tc),
			provider.NewCompleteEvent(provider.StopReasonToolUse),
		),
		eventChan(provider.NewErrorEvent(errProviderStreamUp)),
	)

	var captured []*hasura.AiAgentMessagesInsertInput

	mockHasura := mock.NewMockhasuraClient(ctrl)
	mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			objects []*hasura.AiAgentMessagesInsertInput,
			_ ...any,
		) (*hasura.InsertAgentMessages, error) {
			captured = objects
			return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
		})

	s := &Service{hasura: mockHasura}

	// agent.ToolsConfig is nil, so buildToolRegistry produces an empty
	// registry; the assistant's tool_call yields a "Tool not found" tool
	// result in iteration 1, then iteration 2's provider stream fails. The
	// loop returns with both iteration-1 messages in result.Messages and a
	// non-nil error — the path that previously dropped them on the floor.
	rec := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(rec, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	agent := &hasura.GetAgent_AiAgent{
		ID: "agent-1", Instructions: "be helpful",
	}

	s.streamAndPersist(c, slog.Default(), p, agent, nil, "sess-1")

	if len(captured) == 0 {
		t.Fatal(
			"expected partial messages to be persisted after RunAgentLoop error; got none",
		)
	}
}

func TestStreamAndPersistPersistsMidStreamContentOnLoopError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewContentDeltaEvent("partial answer"),
		provider.NewErrorEvent(errProviderStreamUp),
	))

	var captured []*hasura.AiAgentMessagesInsertInput

	mockHasura := mock.NewMockhasuraClient(ctrl)
	mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
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

	agent := &hasura.GetAgent_AiAgent{
		ID:           "agent-1",
		Instructions: "be helpful",
	}

	s.streamAndPersist(c, slog.Default(), p, agent, nil, "sess-1")

	if len(captured) != 1 {
		t.Fatalf("expected 1 persisted partial message, got %d", len(captured))
	}

	if role := deptr(captured[0].Role); role != provider.RoleAssistant {
		t.Errorf("role: expected %q, got %q", provider.RoleAssistant, role)
	}

	if content := deptr(captured[0].Content); content != "partial answer" {
		t.Errorf("content: expected %q, got %q", "partial answer", content)
	}

	if captured[0].ToolCalls != nil {
		t.Errorf("expected no tool calls in safe partial message, got %s", captured[0].ToolCalls)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "event: content_delta\ndata: partial answer") {
		t.Errorf("expected partial content SSE before error, got %q", body)
	}

	if got := strings.Count(body, "event: error\n"); got != 1 {
		t.Errorf("expected exactly 1 error SSE, got %d in %q", got, body)
	}
}

func TestConvertHasuraMessagesMultiple(t *testing.T) {
	t.Parallel()

	now := time.Now()

	input := []*hasura.GetAgentMessages_AiAgentMessages{
		{
			ID: "m1", SessionID: "s1", Role: "user",
			Content: "hi", ToolCalls: nil, ToolCallID: nil,
			ToolName: nil, CreatedAt: now,
		},
		{
			ID: "m2", SessionID: "s1", Role: "assistant",
			Content: "hello", ToolCalls: nil, ToolCallID: nil,
			ToolName: nil, CreatedAt: now,
		},
	}

	msgs, err := convertHasuraMessages(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}

	expected := []provider.Message{
		{Role: "user", Content: "hi", ToolCalls: nil, ToolCallID: "", ToolName: ""},
		{Role: "assistant", Content: "hello", ToolCalls: nil, ToolCallID: "", ToolName: ""},
	}

	for i, exp := range expected {
		if msgs[i].Role != exp.Role {
			t.Errorf("msg[%d] role: expected %q, got %q", i, exp.Role, msgs[i].Role)
		}

		if msgs[i].Content != exp.Content {
			t.Errorf("msg[%d] content: expected %q, got %q", i, exp.Content, msgs[i].Content)
		}
	}
}
