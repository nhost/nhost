package agents

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/hasura"
)

type mockAuthClient struct {
	resp *hasura.GetAgentSession
	err  error
}

func (m *mockAuthClient) GetAgentSession(
	_ context.Context,
	_ string,
	_ ...clientv2.RequestInterceptor,
) (*hasura.GetAgentSession, error) {
	return m.resp, m.err
}

func ginContext(headers http.Header) *gin.Context {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header = headers

	rec := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(rec, gin.New())
	c.Request = req

	return c
}

func TestAuthorizeRequest(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		adminSecret string
		headers     http.Header
		mock        mockAuthClient
		wantErr     error
	}{
		{
			name:        "valid admin secret grants access",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret123"},
			},
			mock:    mockAuthClient{},
			wantErr: nil,
		},
		{
			name:        "admin secret with user role defers to hasura and is denied",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret123"},
				"X-Hasura-Role":         []string{"user"},
				"X-Hasura-User-Id":      []string{"2e0e9147-c1f0-4d7e-bb18-f2eb4b9c9810"},
			},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: nil,
				},
			},
			wantErr: errForbidden,
		},
		{
			name:        "admin secret with user role defers to hasura and is allowed when session visible",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret123"},
				"X-Hasura-Role":         []string{"user"},
				"X-Hasura-User-Id":      []string{"2e0e9147-c1f0-4d7e-bb18-f2eb4b9c9810"},
			},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: &hasura.GetAgentSession_AiAgentSession{},
				},
			},
			wantErr: nil,
		},
		{
			name:        "admin secret with admin role bypasses hasura",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"secret123"},
				"X-Hasura-Role":         []string{"admin"},
			},
			mock:    mockAuthClient{},
			wantErr: nil,
		},
		{
			name:        "invalid admin secret falls through to hasura auth which succeeds",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"wrong"},
			},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: &hasura.GetAgentSession_AiAgentSession{},
				},
			},
			wantErr: nil,
		},
		{
			name:        "invalid admin secret and hasura returns nil session denies access",
			adminSecret: "secret123",
			headers: http.Header{
				"X-Hasura-Admin-Secret": []string{"wrong"},
			},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: nil,
				},
			},
			wantErr: errForbidden,
		},
		{
			name:        "empty server admin secret skips admin check and hasura succeeds",
			adminSecret: "",
			headers:     http.Header{},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: &hasura.GetAgentSession_AiAgentSession{},
				},
			},
			wantErr: nil,
		},
		{
			name:        "empty server admin secret and hasura returns nil session",
			adminSecret: "",
			headers:     http.Header{},
			mock: mockAuthClient{
				resp: &hasura.GetAgentSession{
					AiAgentSession: nil,
				},
			},
			wantErr: errForbidden,
		},
		{
			name:        "hasura returns error denies access",
			adminSecret: "",
			headers:     http.Header{},
			mock: mockAuthClient{
				err: errors.New("connection refused"), //nolint:err113
			},
			wantErr: errForbidden,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			svc := &Service{
				adminSecret: tc.adminSecret,
				hasuraAuth:  &tc.mock,
			}

			c := ginContext(tc.headers)

			err := svc.authorizeRequest(c, "session-id")
			if diff := cmp.Diff(tc.wantErr, err, cmp.Comparer(errors.Is)); diff != "" {
				t.Errorf("authorizeRequest() error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestWithUserHeaders(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		headers  http.Header
		wantAuth string
		wantRole string
	}{
		{
			name: "copies authorization and role headers",
			headers: http.Header{
				"Authorization": []string{"Bearer token123"},
				"X-Hasura-Role": []string{"user"},
			},
			wantAuth: "Bearer token123",
			wantRole: "user",
		},
		{
			name:     "empty headers remain empty",
			headers:  http.Header{},
			wantAuth: "",
			wantRole: "",
		},
		{
			name: "only authorization header",
			headers: http.Header{
				"Authorization": []string{"Bearer abc"},
			},
			wantAuth: "Bearer abc",
			wantRole: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			interceptor := withUserHeaders(tc.headers)

			req := httptest.NewRequest(http.MethodPost, "/", nil)
			nextCalled := false

			err := interceptor(
				t.Context(),
				req,
				&clientv2.GQLRequestInfo{},
				nil,
				func(
					_ context.Context,
					_ *http.Request,
					_ *clientv2.GQLRequestInfo,
					_ any,
				) error {
					nextCalled = true
					return nil
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if !nextCalled {
				t.Fatal("expected next to be called")
			}

			if got := req.Header.Get("Authorization"); got != tc.wantAuth {
				t.Errorf("Authorization = %q, want %q", got, tc.wantAuth)
			}

			if got := req.Header.Get("X-Hasura-Role"); got != tc.wantRole {
				t.Errorf("X-Hasura-Role = %q, want %q", got, tc.wantRole)
			}
		})
	}
}
