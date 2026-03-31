package nhostclient_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
)

// mockAuthClient satisfies auth.ClientWithResponsesInterface by embedding it,
// overriding SignInPATWithResponse and RefreshTokenWithResponse.
type mockAuthClient struct {
	auth.ClientWithResponsesInterface // satisfies unused interface methods

	calls       int
	accessToken string
	expiresIn   int64
	err         error
	statusCode  int

	rtCalls       int
	rtAccessToken string
	rtRefreshTok  string
	rtExpiresIn   int64
	rtErr         error
	rtStatusCode  int
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
		JSON200:      nil,
		JSONDefault:  nil,
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

func (m *mockAuthClient) RefreshTokenWithResponse(
	_ context.Context,
	_ auth.RefreshTokenJSONRequestBody,
	_ ...auth.RequestEditorFn,
) (*auth.RefreshTokenR, error) {
	m.rtCalls++

	if m.rtErr != nil {
		return nil, m.rtErr
	}

	resp := &auth.RefreshTokenR{
		Body:         []byte(`{}`),
		HTTPResponse: &http.Response{StatusCode: m.rtStatusCode}, //nolint:exhaustruct
		JSON200:      nil,
		JSONDefault:  nil,
	}

	if m.rtStatusCode == http.StatusOK {
		resp.JSON200 = &auth.Session{ //nolint:exhaustruct
			AccessToken:          m.rtAccessToken,
			AccessTokenExpiresIn: m.rtExpiresIn,
			RefreshToken:         m.rtRefreshTok,
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

func TestRefreshTokenInterceptor_CachesToken(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtAccessToken: "access-abc",
		rtRefreshTok:  "rt-abc",
		rtExpiresIn:   3600,
		rtStatusCode:  http.StatusOK,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-abc")

	req1, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)
	req2, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req1); err != nil {
		t.Fatalf("first call: %v", err)
	}

	if err := interceptor.Intercept(context.Background(), req2); err != nil {
		t.Fatalf("second call: %v", err)
	}

	if mock.rtCalls != 1 {
		t.Fatalf("expected 1 refresh call (cached), got %d", mock.rtCalls)
	}

	if got := req1.Header.Get("Authorization"); got != "Bearer access-abc" {
		t.Fatalf("expected 'Bearer access-abc', got %q", got)
	}

	if got := req2.Header.Get("Authorization"); got != "Bearer access-abc" {
		t.Fatalf("expected cached 'Bearer access-abc', got %q", got)
	}
}

func TestRefreshTokenInterceptor_RefreshesExpiredToken(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtAccessToken: "token-1",
		rtRefreshTok:  "rt-1",
		rtExpiresIn:   0, // expires immediately
		rtStatusCode:  http.StatusOK,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-1")

	req1, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req1); err != nil {
		t.Fatalf("first call: %v", err)
	}

	if mock.rtCalls != 1 {
		t.Fatalf("expected 1 call, got %d", mock.rtCalls)
	}

	mock.rtAccessToken = "token-2"

	req2, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req2); err != nil {
		t.Fatalf("second call: %v", err)
	}

	if mock.rtCalls != 2 {
		t.Fatalf("expected 2 calls (expired token refreshed), got %d", mock.rtCalls)
	}

	if got := req2.Header.Get("Authorization"); got != "Bearer token-2" {
		t.Fatalf("expected 'Bearer token-2', got %q", got)
	}
}

func TestRefreshTokenInterceptor_PropagatesError(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtErr: errTransient,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-1")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestRefreshTokenInterceptor_HandlesNon200(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtStatusCode: http.StatusUnauthorized,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-1")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req); err == nil {
		t.Fatal("expected error for non-200 status, got nil")
	}
}

func TestRefreshTokenInterceptor_RotatesRefreshToken(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtAccessToken: "access-1",
		rtRefreshTok:  "rt-rotated",
		rtExpiresIn:   3600,
		rtStatusCode:  http.StatusOK,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-original")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := interceptor.GetRefreshToken(); got != "rt-rotated" {
		t.Fatalf("expected rotated refresh token 'rt-rotated', got %q", got)
	}
}

func TestRefreshTokenInterceptor_KeepsRefreshTokenWhenEmpty(t *testing.T) {
	t.Parallel()

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtAccessToken: "access-1",
		rtRefreshTok:  "",
		rtExpiresIn:   3600,
		rtStatusCode:  http.StatusOK,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-original")

	req, _ := http.NewRequestWithContext(
		context.Background(), http.MethodGet, "http://localhost/test", nil,
	)

	if err := interceptor.Intercept(context.Background(), req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := interceptor.GetRefreshToken(); got != "rt-original" {
		t.Fatalf("expected original refresh token 'rt-original', got %q", got)
	}
}

func TestRefreshTokenInterceptor_ConcurrentAccess(t *testing.T) {
	t.Parallel()

	const goroutines = 10

	mock := &mockAuthClient{ //nolint:exhaustruct
		rtAccessToken: "concurrent-token",
		rtRefreshTok:  "rt-concurrent",
		rtExpiresIn:   3600,
		rtStatusCode:  http.StatusOK,
	}

	interceptor := nhostclient.NewRefreshTokenInterceptor(mock, "rt-concurrent")

	done := make(chan error, goroutines)

	for range goroutines {
		go func() {
			req, _ := http.NewRequestWithContext(
				context.Background(), http.MethodGet, "http://localhost/test", nil,
			)

			done <- interceptor.Intercept(context.Background(), req)
		}()
	}

	for range goroutines {
		if err := <-done; err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	if mock.rtCalls < 1 {
		t.Fatal("expected at least 1 refresh call")
	}
}
