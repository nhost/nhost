package middleware_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/fetch"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
)

// fakeBackend is a session.Backend that stores a single StoredSession in memory
// and records whether Set/Remove were called, without JWT decoding.
type fakeBackend struct {
	sess     *session.StoredSession
	setCalls int
	removed  bool
}

func (f *fakeBackend) Get() (*session.StoredSession, bool) { return f.sess, f.sess != nil }
func (f *fakeBackend) Set(v session.StoredSession)         { f.setCalls++; f.sess = &v }
func (f *fakeBackend) Remove()                             { f.removed = true; f.sess = nil }

func makeToken(t *testing.T) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := json.Marshal(map[string]any{"exp": 9999999999, "sub": "u"})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	return header + "." + base64.RawURLEncoding.EncodeToString(payload) + ".sig"
}

func newReq(t *testing.T, target string) *http.Request {
	t.Helper()

	return httptest.NewRequest(http.MethodGet, target, nil)
}

func run(t *testing.T, cf fetch.ChainFunction, req *http.Request) (*http.Request, *http.Response) {
	t.Helper()

	var seen *http.Request

	next := func(r *http.Request) (*http.Response, error) {
		seen = r

		return &http.Response{ //nolint:exhaustruct
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       http.NoBody,
		}, nil
	}

	resp, err := cf(next)(req)
	if err != nil {
		t.Fatalf("chain returned error: %v", err)
	}

	return seen, resp
}

func TestAttachAccessToken(t *testing.T) {
	t.Parallel()

	store := session.NewStorage(&fakeBackend{ //nolint:exhaustruct
		sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}}, //nolint:exhaustruct
	})

	seen, _ := run(t, middleware.AttachAccessToken(store), newReq(t, "https://x/v1/graphql"))
	if got := seen.Header.Get("Authorization"); got != "Bearer tok" {
		t.Fatalf("Authorization = %q, want %q", got, "Bearer tok")
	}

	// An existing Authorization header must be preserved.
	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("Authorization", "Bearer keep")
	seen, _ = run(t, middleware.AttachAccessToken(store), req)

	if got := seen.Header.Get("Authorization"); got != "Bearer keep" {
		t.Fatalf("Authorization overwritten: %q", got)
	}
}

func TestWithRole(t *testing.T) {
	t.Parallel()

	seen, _ := run(t, middleware.WithRole("editor"), newReq(t, "https://x/v1/graphql"))
	if got := seen.Header.Get("x-hasura-role"); got != "editor" {
		t.Fatalf("x-hasura-role = %q", got)
	}

	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("x-hasura-role", "keep")
	seen, _ = run(t, middleware.WithRole("editor"), req)

	if got := seen.Header.Get("x-hasura-role"); got != "keep" {
		t.Fatalf("x-hasura-role overwritten: %q", got)
	}
}

func TestWithHeaders(t *testing.T) {
	t.Parallel()

	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("X-Keep", "existing")
	seen, _ := run(t, middleware.WithHeaders(map[string]string{
		"X-Default": "default",
		"X-Keep":    "override",
	}), req)

	if got := seen.Header.Get("X-Default"); got != "default" {
		t.Fatalf("X-Default = %q", got)
	}

	if got := seen.Header.Get("X-Keep"); got != "existing" {
		t.Fatalf("X-Keep overwritten: %q", got)
	}
}

func TestWithAdminSession(t *testing.T) {
	t.Parallel()

	seen, _ := run(t, middleware.WithAdminSession(middleware.AdminSessionOptions{
		AdminSecret:      "secret",
		Role:             "admin",
		SessionVariables: map[string]string{"org-id": "42"},
	}), newReq(t, "https://x/v1/graphql"))

	if got := seen.Header.Get("x-hasura-admin-secret"); got != "secret" {
		t.Fatalf("admin-secret = %q", got)
	}

	if got := seen.Header.Get("x-hasura-role"); got != "admin" {
		t.Fatalf("role = %q", got)
	}

	// Session variables are normalized with the x-hasura- prefix.
	if got := seen.Header.Get("x-hasura-org-id"); got != "42" {
		t.Fatalf("x-hasura-org-id = %q", got)
	}
}

func TestUpdateSessionFromResponseSignout(t *testing.T) {
	t.Parallel()

	fb := &fakeBackend{sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}}} //nolint:exhaustruct
	store := session.NewStorage(fb)

	_, _ = run(t, middleware.UpdateSessionFromResponse(store), newReq(t, "https://x/v1/signout"))

	if !fb.removed {
		t.Fatal("expected signout to remove the stored session")
	}
}

func TestUpdateSessionFromResponseStoresAndRestoresBody(t *testing.T) {
	t.Parallel()

	fb := &fakeBackend{} //nolint:exhaustruct
	store := session.NewStorage(fb)

	body, err := json.Marshal(map[string]any{
		"session": auth.Session{AccessToken: makeToken(t), RefreshToken: "r"}, //nolint:exhaustruct
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	next := func(_ *http.Request) (*http.Response, error) {
		return &http.Response{ //nolint:exhaustruct
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewReader(body)),
		}, nil
	}

	resp, err := middleware.UpdateSessionFromResponse(store)(next)(newReq(t, "https://x/v1/token"))
	if err != nil {
		t.Fatalf("chain error: %v", err)
	}

	if fb.setCalls != 1 {
		t.Fatalf("expected session to be stored once, got %d", fb.setCalls)
	}

	// The body must be restored so downstream decoding still works.
	got, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read restored body: %v", err)
	}

	if !bytes.Equal(got, body) {
		t.Fatalf("response body not restored")
	}
}

func TestSessionRefreshSkips(t *testing.T) {
	t.Parallel()

	// With an Authorization header already present, no refresh is attempted, so
	// the (unreachable) auth client is never called and next runs normally.
	authClient := auth.NewClient("https://unused.invalid/v1", nil, nil)
	store := session.NewStorage(&fakeBackend{}) //nolint:exhaustruct

	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("Authorization", "Bearer tok")

	seen, resp := run(t, middleware.SessionRefresh(authClient, store, 60), req)
	if seen == nil || resp.StatusCode != http.StatusOK {
		t.Fatal("expected next to run when Authorization is present")
	}
}
