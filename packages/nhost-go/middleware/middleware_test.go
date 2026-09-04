package middleware_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/transport"
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

func run(t *testing.T, mw transport.Middleware, req *http.Request) *http.Request {
	t.Helper()

	var seen *http.Request

	next := transport.RoundTripFunc(func(r *http.Request) (*http.Response, error) {
		seen = r

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       http.NoBody,
		}, nil
	})

	resp, err := mw(next).RoundTrip(req)
	if err != nil {
		t.Fatalf("chain returned error: %v", err)
	}

	_ = resp.Body.Close()

	return seen
}

func TestAttachAccessToken(t *testing.T) {
	t.Parallel()

	store := session.NewStorage(&fakeBackend{
		sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}},
	})

	req := newReq(t, "https://x/v1/graphql")

	seen := run(t, middleware.AttachAccessToken(store, "https://x/v1"), req)
	if got := seen.Header.Get("Authorization"); got != "Bearer tok" {
		t.Fatalf("Authorization = %q, want %q", got, "Bearer tok")
	}

	if got := req.Header.Get("Authorization"); got != "" {
		t.Fatalf("caller's Authorization mutated to %q", got)
	}

	// An existing Authorization header must be preserved without cloning.
	req = newReq(t, "https://x/v1/graphql")
	req.Header.Set("Authorization", "Bearer keep")
	seen = run(t, middleware.AttachAccessToken(store, "https://x/v1"), req)

	if got := seen.Header.Get("Authorization"); got != "Bearer keep" {
		t.Fatalf("Authorization overwritten: %q", got)
	}

	if seen != req {
		t.Fatal("no-op path cloned the request")
	}
}

func TestAttachAccessTokenScopeURLs(t *testing.T) {
	t.Parallel()

	store := session.NewStorage(&fakeBackend{
		sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}},
	})
	tests := []struct {
		name           string
		serviceURL     string
		requestURL     string
		wantAuth       string
		wantErrContain string
		wantNextCalls  int
	}{
		{
			name:          "well-formed",
			serviceURL:    "http://127.0.0.1:42893/v1",
			requestURL:    "http://127.0.0.1:42893/v1/graphql",
			wantAuth:      "Bearer tok",
			wantNextCalls: 1,
		},
		{
			name:          "scheme-less loopback authority",
			serviceURL:    "127.0.0.1:46855/v1",
			requestURL:    "http://127.0.0.1:46855/v1/graphql",
			wantAuth:      "Bearer tok",
			wantNextCalls: 1,
		},
		{
			name:           "empty",
			serviceURL:     "",
			requestURL:     "http://127.0.0.1:42893/v1/graphql",
			wantErrContain: "invalid service URL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			nextCalls := 0
			gotAuth := ""
			next := transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
				nextCalls++
				gotAuth = req.Header.Get("Authorization")

				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{},
					Body:       http.NoBody,
				}, nil
			})

			resp, err := middleware.AttachAccessToken(store, tt.serviceURL)(next).RoundTrip(
				newReq(t, tt.requestURL),
			)
			if tt.wantErrContain == "" && err != nil {
				t.Fatalf("RoundTrip error = %v, want nil", err)
			}

			if tt.wantErrContain != "" &&
				(err == nil || !strings.Contains(err.Error(), tt.wantErrContain)) {
				t.Fatalf("RoundTrip error = %v, want containing %q", err, tt.wantErrContain)
			}

			if resp != nil {
				if err := resp.Body.Close(); err != nil {
					t.Fatalf("close response body: %v", err)
				}
			}

			if nextCalls != tt.wantNextCalls {
				t.Fatalf("next calls = %d, want %d", nextCalls, tt.wantNextCalls)
			}

			if gotAuth != tt.wantAuth {
				t.Fatalf("Authorization = %q, want %q", gotAuth, tt.wantAuth)
			}

			t.Logf(
				"scope=%q Authorization=%q error=%v",
				tt.serviceURL,
				gotAuth,
				err,
			)
		})
	}
}

func TestCredentialMiddlewareStripsOwnCredentialsOutsideOrigin(t *testing.T) {
	t.Parallel()

	store := session.NewStorage(&fakeBackend{
		sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}},
	})
	accessTokenRequest := newReq(t, "https://other.example/v1/graphql")
	accessTokenRequest.Header.Set("Authorization", "Bearer tok")

	seen := run(
		t,
		middleware.AttachAccessToken(store, "https://service.example/v1"),
		accessTokenRequest,
	)
	if got := seen.Header.Get("Authorization"); got != "" {
		t.Fatalf("out-of-scope Authorization = %q, want empty", got)
	}

	if got := accessTokenRequest.Header.Get("Authorization"); got != "Bearer tok" {
		t.Fatalf("caller's Authorization mutated to %q", got)
	}

	adminRequest := newReq(t, "https://other.example/v1/graphql")
	adminRequest.Header.Set("x-hasura-admin-secret", "secret")

	seen = run(t, middleware.WithAdminSession(middleware.AdminSessionOptions{
		AdminSecret:       "secret",
		Role:              "",
		SessionVariables:  nil,
		AllowInsecureHTTP: false,
	}, "https://service.example/v1"), adminRequest)
	if got := seen.Header.Get("x-hasura-admin-secret"); got != "" {
		t.Fatalf("out-of-scope admin secret = %q, want empty", got)
	}

	if got := adminRequest.Header.Get("x-hasura-admin-secret"); got != "secret" {
		t.Fatalf("caller's admin secret mutated to %q", got)
	}
}

func TestWithRole(t *testing.T) {
	t.Parallel()

	req := newReq(t, "https://x/v1/graphql")

	seen := run(t, middleware.WithRole("editor"), req)
	if got := seen.Header.Get("x-hasura-role"); got != "editor" {
		t.Fatalf("x-hasura-role = %q", got)
	}

	if got := req.Header.Get("x-hasura-role"); got != "" {
		t.Fatalf("caller's x-hasura-role mutated to %q", got)
	}

	req = newReq(t, "https://x/v1/graphql")
	req.Header.Set("x-hasura-role", "keep")
	seen = run(t, middleware.WithRole("editor"), req)

	if got := seen.Header.Get("x-hasura-role"); got != "keep" {
		t.Fatalf("x-hasura-role overwritten: %q", got)
	}

	if seen != req {
		t.Fatal("no-op path cloned the request")
	}
}

func TestWithHeaders(t *testing.T) {
	t.Parallel()

	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("X-Keep", "existing")
	seen := run(t, middleware.WithHeaders(map[string]string{
		"X-Default": "default",
		"X-Keep":    "override",
	}), req)

	if got := seen.Header.Get("X-Default"); got != "default" {
		t.Fatalf("X-Default = %q", got)
	}

	if got := seen.Header.Get("X-Keep"); got != "existing" {
		t.Fatalf("X-Keep overwritten: %q", got)
	}

	if got := req.Header.Get("X-Default"); got != "" {
		t.Fatalf("caller's X-Default mutated to %q", got)
	}

	if got := req.Header.Get("X-Keep"); got != "existing" {
		t.Fatalf("caller's X-Keep mutated to %q", got)
	}
}

func TestWithAdminSession(t *testing.T) {
	t.Parallel()

	req := newReq(t, "https://x/v1/graphql")
	seen := run(t, middleware.WithAdminSession(middleware.AdminSessionOptions{
		AdminSecret:       "secret",
		Role:              "admin",
		SessionVariables:  map[string]string{"org-id": "42"},
		AllowInsecureHTTP: false,
	}, "https://x/v1"), req)

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

	if len(req.Header) != 0 {
		t.Fatalf("caller's headers mutated: %v", req.Header)
	}
}

func TestWithAdminSessionInsecureHTTPRequiresOptIn(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		allowInsecure bool
		wantSecret    string
	}{
		{name: "secure by default", allowInsecure: false, wantSecret: ""},
		{name: "explicit insecure opt-in", allowInsecure: true, wantSecret: "secret"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			seen := run(t, middleware.WithAdminSession(middleware.AdminSessionOptions{
				AdminSecret:       "secret",
				Role:              "",
				SessionVariables:  nil,
				AllowInsecureHTTP: tt.allowInsecure,
			}, "http://selfhosted.internal:1337/v1"), newReq(
				t,
				"http://selfhosted.internal:1337/v1/graphql",
			))
			if got := seen.Header.Get("x-hasura-admin-secret"); got != tt.wantSecret {
				t.Fatalf("admin secret = %q, want %q", got, tt.wantSecret)
			}
		})
	}
}

func TestCredentialsAreNotForwardedAcrossHosts(t *testing.T) {
	t.Parallel()

	type observedHeaders struct {
		authorization string
		adminSecret   string
	}

	destinationHeaders := make(chan observedHeaders, 1)

	destination := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			destinationHeaders <- observedHeaders{
				authorization: req.Header.Get("Authorization"),
				adminSecret:   req.Header.Get("x-hasura-admin-secret"),
			}

			w.WriteHeader(http.StatusOK)
		}),
	)
	defer destination.Close()

	originHeaders := make(chan observedHeaders, 1)

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		originHeaders <- observedHeaders{
			authorization: req.Header.Get("Authorization"),
			adminSecret:   req.Header.Get("x-hasura-admin-secret"),
		}

		http.Redirect(w, req, destination.URL, http.StatusFound)
	}))
	defer origin.Close()

	store := session.NewStorage(&fakeBackend{
		sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}},
	})
	client := transport.NewHTTPClient(
		origin.Client(),
		middleware.AttachAccessToken(store, origin.URL),
		middleware.WithAdminSession(middleware.AdminSessionOptions{
			AdminSecret:       "secret",
			Role:              "",
			SessionVariables:  nil,
			AllowInsecureHTTP: false,
		}, origin.URL),
	)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, origin.URL, nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request through redirect: %v", err)
	}

	if err := resp.Body.Close(); err != nil {
		t.Fatalf("close response body: %v", err)
	}

	if got := <-originHeaders; got.authorization != "Bearer tok" || got.adminSecret != "secret" {
		t.Fatalf("origin headers = %+v, want access token and admin secret", got)
	}

	if got := <-destinationHeaders; got.authorization != "" || got.adminSecret != "" {
		t.Fatalf("cross-host redirect leaked credentials: %+v", got)
	}
}

func TestUpdateSessionFromResponseSignout(t *testing.T) {
	t.Parallel()

	fb := &fakeBackend{sess: &session.StoredSession{Session: auth.Session{AccessToken: "tok"}}}
	store := session.NewStorage(fb)

	run(
		t,
		middleware.UpdateSessionFromResponse(store, "https://x/v1"),
		newReq(t, "https://x/v1/signout"),
	)

	if !fb.removed {
		t.Fatal("expected signout to remove the stored session")
	}
}

func TestUpdateSessionFromResponseStoresAndRestoresBody(t *testing.T) {
	t.Parallel()

	fb := &fakeBackend{}
	store := session.NewStorage(fb)

	body, err := json.Marshal(map[string]any{
		"session": auth.Session{AccessToken: makeToken(t), RefreshToken: "r"},
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	next := transport.RoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewReader(body)),
		}, nil
	})

	resp, err := middleware.UpdateSessionFromResponse(store, "https://x/v1")(next).RoundTrip(
		newReq(t, "https://x/v1/token"),
	)
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

	if err := resp.Body.Close(); err != nil {
		t.Fatalf("close body: %v", err)
	}

	if !bytes.Equal(got, body) {
		t.Fatalf("response body not restored")
	}
}

func TestUpdateSessionFromResponseIgnoresNonAuthRequests(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
	}{
		{name: "signout on another host", url: "https://functions.example/v1/signout"},
		{name: "token on another host", url: "https://functions.example/v1/token"},
		{name: "signout below another path", url: "https://auth.example/v1/functions/signout"},
		{name: "token below another path", url: "https://auth.example/v1/functions/token"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			original := &session.StoredSession{Session: auth.Session{AccessToken: "original"}}
			backend := &fakeBackend{sess: original}
			store := session.NewStorage(backend)
			body := io.NopCloser(bytes.NewBufferString(
				`{"accessToken":"replacement","refreshToken":"replacement"}`,
			))
			next := transport.RoundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{},
					Body:       body,
				}, nil
			})

			resp, err := middleware.UpdateSessionFromResponse(store, "https://auth.example/v1")(
				next,
			).
				RoundTrip(newReq(t, tt.url))
			if err != nil {
				t.Fatalf("round trip: %v", err)
			}

			if resp.Body != body {
				t.Fatal("non-auth response body was buffered and replaced")
			}

			if err := resp.Body.Close(); err != nil {
				t.Fatalf("close response body: %v", err)
			}

			if backend.removed || backend.setCalls != 0 || backend.sess != original {
				t.Fatalf(
					"session changed: removed=%v setCalls=%d session=%+v",
					backend.removed,
					backend.setCalls,
					backend.sess,
				)
			}
		})
	}
}

func TestSessionRefreshDoesNotTreatFunctionTokenPathAsAuthToken(t *testing.T) {
	t.Parallel()

	var refreshCalls atomic.Int32

	refreshedAccessToken := makeToken(t)

	refreshServer := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			refreshCalls.Add(1)

			if req.URL.Path != "/v1/token" {
				t.Errorf("refresh path = %q, want /v1/token", req.URL.Path)
			}

			w.Header().Set("Content-Type", "application/json")

			if err := json.NewEncoder(w).Encode(auth.Session{
				AccessToken:  refreshedAccessToken,
				RefreshToken: "new-refresh",
			}); err != nil {
				t.Errorf("encode refresh response: %v", err)
			}
		}),
	)
	defer refreshServer.Close()

	store := session.NewStorage(&fakeBackend{sess: &session.StoredSession{
		Session:      auth.Session{AccessToken: "expired", RefreshToken: "refresh"},
		DecodedToken: session.DecodedToken{Exp: 1},
	}})
	authClient := auth.NewClient(refreshServer.URL+"/v1", refreshServer.Client())

	run(
		t,
		middleware.SessionRefresh(authClient, store, 60),
		newReq(t, "https://functions.example/v1/token"),
	)

	if got := refreshCalls.Load(); got != 1 {
		t.Fatalf("refresh calls = %d, want 1", got)
	}
}

func TestSessionRefreshSkips(t *testing.T) {
	t.Parallel()

	// With an Authorization header already present, no refresh is attempted, so
	// the (unreachable) auth client is never called and next runs normally.
	authClient := auth.NewClient("https://unused.invalid/v1", nil)
	store := session.NewStorage(&fakeBackend{})

	req := newReq(t, "https://x/v1/graphql")
	req.Header.Set("Authorization", "Bearer tok")

	seen := run(t, middleware.SessionRefresh(authClient, store, 60), req)
	if seen == nil {
		t.Fatal("expected next to run when Authorization is present")
	}
}
