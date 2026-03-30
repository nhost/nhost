package nhostclient_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
)

// mockAuthClient satisfies auth.ClientWithResponsesInterface by embedding it,
// but only overrides SignInPATWithResponse which is the only method used by
// WithPAT.
type mockAuthClient struct {
	auth.ClientWithResponsesInterface // satisfies unused interface methods

	calls       int
	accessToken string
	expiresIn   int64
	err         error
	statusCode  int
}

func (m *mockAuthClient) SignInPATWithResponse(
	_ context.Context,
	_ auth.SignInPATJSONRequestBody,
	_ ...auth.RequestEditorFn,
) (*auth.SignInPATR, error) {
	m.calls++

	if m.err != nil {
		return nil, m.err
	}

	resp := &auth.SignInPATR{
		Body:         []byte(`{}`),
		HTTPResponse: &http.Response{StatusCode: m.statusCode}, //nolint:exhaustruct
	}

	if m.statusCode == http.StatusOK {
		resp.JSON200 = &auth.SessionPayload{
			Session: &auth.Session{ //nolint:exhaustruct
				AccessToken:          m.accessToken,
				AccessTokenExpiresIn: m.expiresIn,
			},
		}
	}

	return resp, nil
}

func TestWithPAT_CachesToken(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		accessToken: "token-abc",
		expiresIn:   3600,
		statusCode:  http.StatusOK,
	}

	interceptor := nhostclient.WithPAT(mock, "my-pat")

	req1, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)
	req2, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req1); err != nil {
		t.Fatalf("first call: %v", err)
	}

	if err := interceptor(context.Background(), req2); err != nil {
		t.Fatalf("second call: %v", err)
	}

	if mock.calls != 1 {
		t.Fatalf("expected 1 sign-in call (cached), got %d", mock.calls)
	}

	if got := req1.Header.Get("Authorization"); got != "Bearer token-abc" {
		t.Fatalf("expected 'Bearer token-abc', got %q", got)
	}

	if got := req2.Header.Get("Authorization"); got != "Bearer token-abc" {
		t.Fatalf("expected cached 'Bearer token-abc', got %q", got)
	}
}

func TestWithPAT_RefreshesExpiredToken(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		accessToken: "token-1",
		expiresIn:   0, // expires immediately
		statusCode:  http.StatusOK,
	}

	interceptor := nhostclient.WithPAT(mock, "my-pat")

	req1, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req1); err != nil {
		t.Fatalf("first call: %v", err)
	}

	if mock.calls != 1 {
		t.Fatalf("expected 1 call, got %d", mock.calls)
	}

	// Second call should trigger refresh since expiresIn=0
	mock.accessToken = "token-2"

	req2, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req2); err != nil {
		t.Fatalf("second call: %v", err)
	}

	if mock.calls != 2 {
		t.Fatalf("expected 2 calls (expired token refreshed), got %d", mock.calls)
	}

	if got := req2.Header.Get("Authorization"); got != "Bearer token-2" {
		t.Fatalf("expected 'Bearer token-2', got %q", got)
	}
}

func TestWithPAT_PropagatesSignInError(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		err: errTransient,
	}

	interceptor := nhostclient.WithPAT(mock, "my-pat")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestWithPAT_HandlesNon200(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		statusCode: http.StatusUnauthorized,
	}

	interceptor := nhostclient.WithPAT(mock, "bad-pat")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req); err == nil {
		t.Fatal("expected error for non-200 status, got nil")
	}
}

func TestWithAdminSecret(t *testing.T) {
	t.Parallel()

	interceptor := nhostclient.WithAdminSecret("secret-123")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := req.Header.Get("X-Hasura-Admin-Secret"); got != "secret-123" {
		t.Fatalf("expected 'secret-123', got %q", got)
	}
}

func TestWithRole(t *testing.T) {
	t.Parallel()

	interceptor := nhostclient.WithRole("admin")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := req.Header.Get("X-Hasura-Role"); got != "admin" {
		t.Fatalf("expected 'admin', got %q", got)
	}
}

func TestWithUserID(t *testing.T) {
	t.Parallel()

	interceptor := nhostclient.WithUserID("user-42")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := req.Header.Get("X-Hasura-User-Id"); got != "user-42" {
		t.Fatalf("expected 'user-42', got %q", got)
	}
}

func TestWithPAT_ConcurrentAccess(t *testing.T) {
	t.Parallel()

	const goroutines = 10

	mock := &mockAuthClient{ //nolint:exhaustruct
		accessToken: "concurrent-token",
		expiresIn:   3600,
		statusCode:  http.StatusOK,
	}

	interceptor := nhostclient.WithPAT(mock, "my-pat")

	done := make(chan error, goroutines)

	for range goroutines {
		go func() {
			req, _ := http.NewRequestWithContext(
				context.Background(), http.MethodGet, "http://localhost/test", nil,
			)

			done <- interceptor(context.Background(), req)
		}()
	}

	for range goroutines {
		if err := <-done; err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	if mock.calls < 1 {
		t.Fatal("expected at least 1 sign-in call")
	}
}
