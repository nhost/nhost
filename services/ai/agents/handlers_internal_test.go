package agents

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/agents/mock"
	"github.com/nhost/nhost/services/ai/agents/provider"
	providermock "github.com/nhost/nhost/services/ai/agents/provider/mock"
	"github.com/nhost/nhost/services/ai/hasura"
	"go.uber.org/mock/gomock"
)

const (
	handlerTestAdminSecret = "secret"
	handlerTestAgentID     = "agent-1"
	handlerTestSessionID   = "session-1"
)

type handlerLockRecorder struct {
	acquired int
	released int
	err      error
}

func (l *handlerLockRecorder) lock(_ context.Context, _ string) (func(), error) {
	l.acquired++
	if l.err != nil {
		return nil, l.err
	}

	return func() { l.released++ }, nil
}

func newHandlerContext(body string, sessionID string) (*gin.Context, *httptest.ResponseRecorder) {
	rec := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(rec, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("X-Hasura-Admin-Secret", handlerTestAdminSecret)

	if sessionID != "" {
		c.Params = gin.Params{{Key: "sessionID", Value: sessionID}}
	}

	return c, rec
}

func assertJSONError(t *testing.T, rec *httptest.ResponseRecorder, status int, wantError string) {
	t.Helper()

	if rec.Code != status {
		t.Fatalf("status = %d, want %d (body %q)", rec.Code, status, rec.Body.String())
	}

	contentType := rec.Header().Get("Content-Type")
	if strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("JSON error response used SSE content type: %q", contentType)
	}

	if !strings.Contains(contentType, "application/json") {
		t.Fatalf("content type = %q, want application/json", contentType)
	}

	if rec.Header().Get("Cache-Control") == "no-cache" {
		t.Fatal("JSON error response has SSE cache header")
	}

	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response body is not JSON: %v (body %q)", err, rec.Body.String())
	}

	if payload["error"] != wantError {
		t.Fatalf("error = %q, want %q", payload["error"], wantError)
	}
}

func assertSSE(t *testing.T, rec *httptest.ResponseRecorder, wantEvents ...string) {
	t.Helper()

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	contentType := rec.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("content type = %q, want text/event-stream", contentType)
	}

	body := rec.Body.String()
	for _, event := range wantEvents {
		if !strings.Contains(body, "event: "+event+"\n") {
			t.Fatalf("SSE body missing %q event: %q", event, body)
		}
	}
}

func handlerTestService(
	hc hasuraClient,
	lock *handlerLockRecorder,
	factory providerFactory,
) *Service {
	return &Service{
		hasura:      hc,
		hasuraAuth:  &mockAuthClient{},
		db:          nil,
		providers:   ProviderConfig{OpenAIKey: "test-openai-key"},
		baseURL:     "",
		adminSecret: handlerTestAdminSecret,
		graphqlURL:  "http://hasura.test/v1/graphql",
		newProvider: factory,
		lockSession: lock.lock,
	}
}

func testAgent() *hasura.GetAgent_AiAgent {
	return &hasura.GetAgent_AiAgent{
		ID:           handlerTestAgentID,
		Name:         "test agent",
		Description:  "",
		Instructions: "be helpful",
		Provider:     hasura.AiAgentProvidersEnumOpenai,
		Model:        "test-model",
		ToolsConfig:  nil,
		UserID:       nil,
	}
}

func expectLoadAgent(mockHasura *mock.MockhasuraClient) {
	mockHasura.EXPECT().
		GetAgentSession(gomock.Any(), handlerTestSessionID).
		Return(&hasura.GetAgentSession{
			AiAgentSession: &hasura.GetAgentSession_AiAgentSession{
				AgentID: handlerTestAgentID,
			},
		}, nil)
	mockHasura.EXPECT().
		GetAgent(gomock.Any(), handlerTestAgentID).
		Return(&hasura.GetAgent{AiAgent: testAgent()}, nil)
}

type handlerJSONErrorCase struct {
	name      string
	sessionID string
	body      string
	wantError string
}

func runHandlerJSONErrorPathCases(
	t *testing.T,
	cases []handlerJSONErrorCase,
	handle func(*Service, *gin.Context),
) {
	t.Helper()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			lock := &handlerLockRecorder{}
			svc := handlerTestService(nil, lock, nil)
			c, rec := newHandlerContext(tc.body, tc.sessionID)

			handle(svc, c)

			assertJSONError(t, rec, http.StatusBadRequest, tc.wantError)

			if lock.acquired != 0 || lock.released != 0 {
				t.Fatalf(
					"lock acquired/released = %d/%d, want 0/0",
					lock.acquired,
					lock.released,
				)
			}
		})
	}
}

func TestHandleStreamMessageJSONErrorPaths(t *testing.T) {
	t.Parallel()

	cases := []handlerJSONErrorCase{
		{
			name:      "missing session ID",
			sessionID: "",
			body:      `{"message":"hello"}`,
			wantError: "session ID is required",
		},
		{
			name:      "invalid body",
			sessionID: handlerTestSessionID,
			body:      `{`,
			wantError: "invalid request body",
		},
		{
			name:      "empty message",
			sessionID: handlerTestSessionID,
			body:      `{"message":""}`,
			wantError: "message is required",
		},
	}

	runHandlerJSONErrorPathCases(t, cases, (*Service).HandleStreamMessage)
}

func TestHandleStreamMessageForbiddenBeforeLock(t *testing.T) {
	t.Parallel()

	svc := &Service{
		hasuraAuth:  &mockAuthClient{resp: &hasura.GetAgentSession{AiAgentSession: nil}},
		adminSecret: handlerTestAdminSecret,
	}
	c, rec := newHandlerContext(`{"message":"hello"}`, handlerTestSessionID)
	c.Request.Header.Set("X-Hasura-Admin-Secret", "wrong")

	svc.HandleStreamMessage(c)

	assertJSONError(t, rec, http.StatusForbidden, "forbidden")
}

func TestHandleStreamMessageBusyUsesJSON(t *testing.T) {
	t.Parallel()

	lock := &handlerLockRecorder{err: errSessionBusy}
	svc := handlerTestService(nil, lock, nil)
	c, rec := newHandlerContext(`{"message":"hello"}`, handlerTestSessionID)

	svc.HandleStreamMessage(c)

	assertJSONError(t, rec, http.StatusConflict, "session is busy")

	if lock.acquired != 1 || lock.released != 0 {
		t.Fatalf("lock acquired/released = %d/%d, want 1/0", lock.acquired, lock.released)
	}
}

func TestHandleStreamMessagePendingApprovalsReleasesLock(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockHasura := mock.NewMockhasuraClient(ctrl)
	expectLoadAgent(mockHasura)
	mockHasura.EXPECT().
		GetAgentMessages(gomock.Any(), gomock.Any()).
		Return(&hasura.GetAgentMessages{
			AiAgentMessages: []*hasura.GetAgentMessages_AiAgentMessages{
				{
					ID:        "msg-1",
					SessionID: handlerTestSessionID,
					Role:      provider.RoleAssistant,
					Content:   "",
					ToolCalls: json.RawMessage(
						`[{"id":"tc-1","name":"web_search","arguments":"{}"}]`,
					),
				},
			},
		}, nil)

	factory := func(
		_ context.Context,
		_ provider.Name,
		_ string,
		_ string,
	) (provider.Provider, error) {
		return providermock.NewMockProvider(ctrl), nil
	}
	lock := &handlerLockRecorder{}
	svc := handlerTestService(mockHasura, lock, factory)
	c, rec := newHandlerContext(`{"message":"hello"}`, handlerTestSessionID)

	svc.HandleStreamMessage(c)

	assertJSONError(t, rec, http.StatusConflict, "session has pending tool approvals")

	if lock.acquired != 1 || lock.released != 1 {
		t.Fatalf("lock acquired/released = %d/%d, want 1/1", lock.acquired, lock.released)
	}
}

func TestHandleStreamMessageHappyPathSSEAndReleasesLock(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockHasura := mock.NewMockhasuraClient(ctrl)
	expectLoadAgent(mockHasura)
	mockHasura.EXPECT().
		GetAgentMessages(gomock.Any(), gomock.Any()).
		Return(&hasura.GetAgentMessages{AiAgentMessages: nil}, nil)

	firstInsert := mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			objects []*hasura.AiAgentMessagesInsertInput,
			_ ...any,
		) (*hasura.InsertAgentMessages, error) {
			if len(objects) != 1 || objects[0].Role == nil ||
				*objects[0].Role != provider.RoleUser {
				t.Fatalf("first insert = %#v, want one user message", objects)
			}

			return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
		})
	secondInsert := mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			objects []*hasura.AiAgentMessagesInsertInput,
			_ ...any,
		) (*hasura.InsertAgentMessages, error) {
			if len(objects) != 1 || objects[0].Role == nil ||
				*objects[0].Role != provider.RoleAssistant {
				t.Fatalf("second insert = %#v, want one assistant message", objects)
			}

			return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
		})
	gomock.InOrder(firstInsert, secondInsert)

	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewContentDeltaEvent("hello"),
		provider.NewCompleteEvent(provider.StopReasonEndTurn),
	))

	factory := func(
		_ context.Context,
		_ provider.Name,
		_ string,
		_ string,
	) (provider.Provider, error) {
		return p, nil
	}
	lock := &handlerLockRecorder{}
	svc := handlerTestService(mockHasura, lock, factory)
	c, rec := newHandlerContext(`{"message":"hello"}`, handlerTestSessionID)

	svc.HandleStreamMessage(c)

	assertSSE(t, rec, "content_delta", "done")

	if lock.acquired != 1 || lock.released != 1 {
		t.Fatalf("lock acquired/released = %d/%d, want 1/1", lock.acquired, lock.released)
	}
}

func TestHandleApproveToolsJSONErrorPaths(t *testing.T) {
	t.Parallel()

	cases := []handlerJSONErrorCase{
		{
			name:      "missing session ID",
			sessionID: "",
			body:      `{"decisions":[{"tool_call_id":"tc-1","approved":true}]}`,
			wantError: "session ID is required",
		},
		{
			name:      "invalid body",
			sessionID: handlerTestSessionID,
			body:      `{`,
			wantError: "invalid request body",
		},
		{
			name:      "empty decisions",
			sessionID: handlerTestSessionID,
			body:      `{"decisions":[]}`,
			wantError: "decisions are required",
		},
	}

	runHandlerJSONErrorPathCases(t, cases, (*Service).HandleApproveTools)
}

func TestHandleApproveToolsForbiddenBeforeLock(t *testing.T) {
	t.Parallel()

	lock := &handlerLockRecorder{}
	svc := handlerTestService(nil, lock, nil)
	svc.hasuraAuth = &mockAuthClient{
		resp: &hasura.GetAgentSession{AiAgentSession: nil},
	}
	body := `{"decisions":[{"tool_call_id":"tc-1","approved":true}]}`
	c, rec := newHandlerContext(body, handlerTestSessionID)
	c.Request.Header.Set("X-Hasura-Admin-Secret", "wrong")

	svc.HandleApproveTools(c)

	assertJSONError(t, rec, http.StatusForbidden, "forbidden")

	if lock.acquired != 0 || lock.released != 0 {
		t.Fatalf("lock acquired/released = %d/%d, want 0/0", lock.acquired, lock.released)
	}
}

func TestHandleApproveToolsBusyUsesJSON(t *testing.T) {
	t.Parallel()

	lock := &handlerLockRecorder{err: errSessionBusy}
	svc := handlerTestService(nil, lock, nil)
	body := `{"decisions":[{"tool_call_id":"tc-1","approved":true}]}`
	c, rec := newHandlerContext(body, handlerTestSessionID)

	svc.HandleApproveTools(c)

	assertJSONError(t, rec, http.StatusConflict, "session is busy")

	if lock.acquired != 1 || lock.released != 0 {
		t.Fatalf("lock acquired/released = %d/%d, want 1/0", lock.acquired, lock.released)
	}
}

func TestHandleApproveToolsValidationPathsReleaseLock(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		messages  []*hasura.GetAgentMessages_AiAgentMessages
		body      string
		wantError string
	}{
		{
			name:      "no pending approvals",
			messages:  nil,
			body:      `{"decisions":[{"tool_call_id":"tc-1","approved":true}]}`,
			wantError: "no pending tool approvals",
		},
		{
			name:      "unknown decision",
			messages:  pendingApprovalMessages(t, "tc-1"),
			body:      `{"decisions":[{"tool_call_id":"stale","approved":true}]}`,
			wantError: "decision references unknown tool call: stale",
		},
		{
			name:      "missing decision",
			messages:  pendingApprovalMessages(t, "tc-1", "tc-2"),
			body:      `{"decisions":[{"tool_call_id":"tc-1","approved":true}]}`,
			wantError: "missing decision for tool call: tc-2",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			mockHasura := mock.NewMockhasuraClient(ctrl)
			expectLoadAgent(mockHasura)
			mockHasura.EXPECT().
				GetAgentMessages(gomock.Any(), gomock.Any()).
				Return(&hasura.GetAgentMessages{AiAgentMessages: tc.messages}, nil)

			lock := &handlerLockRecorder{}
			svc := handlerTestService(mockHasura, lock, nil)
			c, rec := newHandlerContext(tc.body, handlerTestSessionID)

			svc.HandleApproveTools(c)

			assertJSONError(t, rec, http.StatusBadRequest, tc.wantError)

			if lock.acquired != 1 || lock.released != 1 {
				t.Fatalf("lock acquired/released = %d/%d, want 1/1", lock.acquired, lock.released)
			}
		})
	}
}

func TestHandleApproveToolsHappyPathSSEAndReleasesLock(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockHasura := mock.NewMockhasuraClient(ctrl)
	expectLoadAgent(mockHasura)
	mockHasura.EXPECT().
		GetAgentMessages(gomock.Any(), gomock.Any()).
		Return(&hasura.GetAgentMessages{
			AiAgentMessages: pendingApprovalMessages(t, "tc-denied"),
		}, nil)
	mockHasura.EXPECT().
		InsertAgentMessages(gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			objects []*hasura.AiAgentMessagesInsertInput,
			_ ...any,
		) (*hasura.InsertAgentMessages, error) {
			if len(objects) != 2 {
				t.Fatalf("inserted %d messages, want 2", len(objects))
			}

			if objects[0].Role == nil || *objects[0].Role != provider.RoleTool {
				t.Fatalf("first inserted role = %v, want tool", objects[0].Role)
			}

			if objects[1].Role == nil || *objects[1].Role != provider.RoleAssistant {
				t.Fatalf("second inserted role = %v, want assistant", objects[1].Role)
			}

			return &hasura.InsertAgentMessages{InsertAiAgentMessages: nil}, nil
		})

	p := providermock.NewMockProvider(ctrl)
	expectStreamResponses(p, eventChan(
		provider.NewContentDeltaEvent("resumed"),
		provider.NewCompleteEvent(provider.StopReasonEndTurn),
	))

	factory := func(
		_ context.Context,
		_ provider.Name,
		_ string,
		_ string,
	) (provider.Provider, error) {
		return p, nil
	}
	lock := &handlerLockRecorder{}
	svc := handlerTestService(mockHasura, lock, factory)
	body := `{"decisions":[{"tool_call_id":"tc-denied","approved":false}]}`
	c, rec := newHandlerContext(body, handlerTestSessionID)

	svc.HandleApproveTools(c)

	assertSSE(t, rec, "tool_denied", "content_delta", "done")

	if lock.acquired != 1 || lock.released != 1 {
		t.Fatalf("lock acquired/released = %d/%d, want 1/1", lock.acquired, lock.released)
	}
}

func pendingApprovalMessages(
	t *testing.T,
	ids ...string,
) []*hasura.GetAgentMessages_AiAgentMessages {
	t.Helper()

	toolCalls := make([]provider.ToolCall, 0, len(ids))
	for _, id := range ids {
		toolCalls = append(toolCalls, provider.ToolCall{
			ID:        id,
			Name:      "web_search",
			Arguments: "{}",
		})
	}

	raw, err := json.Marshal(toolCalls)
	if err != nil {
		t.Fatalf("marshal pending tool calls: %v", err)
	}

	return []*hasura.GetAgentMessages_AiAgentMessages{
		{
			ID:        "msg-pending",
			SessionID: handlerTestSessionID,
			Role:      provider.RoleAssistant,
			Content:   "",
			ToolCalls: raw,
		},
	}
}
