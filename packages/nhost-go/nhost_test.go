package nhost_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

func TestGenerateServiceURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		service   nhost.ServiceType
		subdomain string
		region    string
		customURL string
		want      string
	}{
		{
			name:      "cloud",
			service:   nhost.ServiceAuth,
			subdomain: "demo",
			region:    "eu-central-1",
			want:      "https://demo.auth.eu-central-1.nhost.run/v1",
		},
		{
			name:    "local",
			service: nhost.ServiceGraphQL,
			want:    "https://local.graphql.local.nhost.run/v1",
		},
		{
			name:      "custom",
			service:   nhost.ServiceStorage,
			customURL: "http://localhost:1337/v1/storage",
			want:      "http://localhost:1337/v1/storage",
		},
		{
			name:      "scheme-less loopback custom URL",
			service:   nhost.ServiceAuth,
			customURL: "localhost:1337/v1",
			want:      "http://localhost:1337/v1",
		},
		{
			name:      "scheme-less remote custom URL",
			service:   nhost.ServiceAuth,
			customURL: "auth.example.com/v1",
			want:      "https://auth.example.com/v1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := nhost.GenerateServiceURL(tt.service, tt.subdomain, tt.region, tt.customURL)
			if got != tt.want {
				t.Fatalf("GenerateServiceURL = %q, want %q", got, tt.want)
			}
		})
	}
}

// serviceOptions points all four services at server, under /auth, /storage,
// /graphql and /functions.
func serviceOptions(server *httptest.Server) []nhost.Option {
	return []nhost.Option{
		nhost.WithAuthURL(server.URL + "/auth"),
		nhost.WithStorageURL(server.URL + "/storage"),
		nhost.WithGraphQLURL(server.URL + "/graphql"),
		nhost.WithFunctionsURL(server.URL + "/functions"),
		nhost.WithHTTPClient(server.Client()),
	}
}

func newClient(t *testing.T, opts ...nhost.Option) *nhost.Client {
	t.Helper()

	client, err := nhost.New(opts...)
	if err != nil {
		t.Fatalf("nhost.New: %v", err)
	}

	return client
}

// writeCanned answers the one request each test makes to every service.
func writeCanned(t *testing.T, w http.ResponseWriter, req *http.Request) {
	t.Helper()

	body, ok := map[string]string{
		"/auth/healthz":    `"OK"`,
		"/auth/user":       `{}`,
		"/storage/version": `{"buildVersion":"test"}`,
		"/graphql":         `{"data":{}}`,
		"/functions/echo":  `{}`,
	}[req.URL.Path]
	if !ok {
		t.Errorf("unexpected request path %q", req.URL.Path)
		w.WriteHeader(http.StatusNotFound)

		return
	}

	w.Header().Set("Content-Type", "application/json")

	if _, err := w.Write([]byte(body)); err != nil {
		t.Errorf("write response: %v", err)
	}
}

// callEveryService makes one request to each service.
func callEveryService(t *testing.T, client *nhost.Client) {
	t.Helper()

	ctx := t.Context()

	if _, _, err := client.Auth.HealthCheckGet(ctx, nil); err != nil {
		t.Fatalf("auth health check: %v", err)
	}

	if _, _, err := client.Storage.GetVersion(ctx, nil); err != nil {
		t.Fatalf("storage version: %v", err)
	}

	if _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, nil); err != nil {
		t.Fatalf("graphql request: %v", err)
	}

	if _, _, err := client.Functions.Call(ctx, "echo", http.MethodGet, nil, nil); err != nil {
		t.Fatalf("functions call: %v", err)
	}
}

func TestNewRejectsInvalidOptions(t *testing.T) {
	t.Parallel()

	admin := nhost.WithAdminSecret(middleware.AdminSessionOptions{AdminSecret: "secret"})

	tests := []struct {
		name string
		opts []nhost.Option
		want error
	}{
		{
			name: "project without a region",
			opts: []nhost.Option{nhost.WithProject("demo", "")},
			want: nhost.ErrInvalidProject,
		},
		{
			name: "project without a subdomain",
			opts: []nhost.Option{nhost.WithProject("", "eu-central-1")},
			want: nhost.ErrInvalidProject,
		},
		{
			name: "non-HTTP service URL",
			opts: []nhost.Option{nhost.WithGraphQLURL("ftp://example.com/v1")},
			want: nhost.ErrInvalidServiceURL,
		},
		{
			name: "service URL without a host",
			opts: []nhost.Option{nhost.WithAuthURL("https:///v1")},
			want: nhost.ErrInvalidServiceURL,
		},
		{
			name: "nil session storage",
			opts: []nhost.Option{nhost.WithSessionStorage(nil)},
			want: nhost.ErrNilSessionStorage,
		},
		{
			name: "empty admin secret",
			opts: []nhost.Option{nhost.WithAdminSecret(middleware.AdminSessionOptions{})},
			want: nhost.ErrEmptyAdminSecret,
		},
		{
			name: "admin secret with session storage",
			opts: []nhost.Option{admin, nhost.WithSessionStorage(&session.MemoryStorage{})},
			want: nhost.ErrAdminSecretWithSessionStorage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client, err := nhost.New(tt.opts...)
			if !errors.Is(err, tt.want) {
				t.Fatalf("New() error = %v, want %v", err, tt.want)
			}

			if client != nil {
				t.Fatal("New() returned a client alongside the error")
			}
		})
	}
}

func TestNewTargetsTheProject(t *testing.T) {
	t.Parallel()

	client := newClient(t,
		nhost.WithProject("demo", "eu-central-1"),
		nhost.WithAuthURL("https://auth.example.com/v1"),
	)

	if got := client.Auth.BaseURL; got != "https://auth.example.com/v1" {
		t.Errorf("auth URL = %q, want the override", got)
	}

	if got := client.GraphQL.URL; got != "https://demo.graphql.eu-central-1.nhost.run/v1" {
		t.Errorf("graphql URL = %q, want the project's", got)
	}
}

func TestWithHTTPHeadersAppliesToEveryService(t *testing.T) {
	t.Parallel()

	seen := make(chan string, 4)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		seen <- req.URL.Path + " " + req.Header.Get("X-Tenant")

		writeCanned(t, w, req)
	}))
	defer server.Close()

	client := newClient(t, append(
		serviceOptions(server),
		nhost.WithHTTPHeaders(http.Header{"X-Tenant": {"acme"}}),
	)...)

	callEveryService(t, client)

	for _, want := range []string{
		"/auth/healthz acme", "/storage/version acme", "/graphql acme", "/functions/echo acme",
	} {
		if got := <-seen; got != want {
			t.Errorf("request = %q, want %q", got, want)
		}
	}
}

func TestWithAdminSecretNeverHitsAuth(t *testing.T) {
	t.Parallel()

	seen := make(chan string, 4)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		seen <- req.URL.Path + " " + req.Header.Get("x-hasura-admin-secret")

		writeCanned(t, w, req)
	}))
	defer server.Close()

	adminCredential := t.Name()
	client := newClient(t, append(
		serviceOptions(server),
		nhost.WithAdminSecret(middleware.AdminSessionOptions{AdminSecret: adminCredential}),
	)...)

	callEveryService(t, client)

	for _, want := range []string{
		"/auth/healthz ",
		"/storage/version " + adminCredential,
		"/graphql " + adminCredential,
		"/functions/echo " + adminCredential,
	} {
		if got := <-seen; got != want {
			t.Errorf("request = %q, want %q", got, want)
		}
	}
}

// TestAdminClientRejectsRequestToken: on data services a caller's token and the
// admin secret would both be sent and the request would run as admin, so it
// fails; auth never gets the admin secret, so a token there is unambiguous.
func TestAdminClientRejectsRequestToken(t *testing.T) {
	t.Parallel()

	seen := make(chan string, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		seen <- req.URL.Path + " " + req.Header.Get("Authorization")

		writeCanned(t, w, req)
	}))
	defer server.Close()

	client := newClient(t, append(
		serviceOptions(server),
		nhost.WithAdminSecret(middleware.AdminSessionOptions{AdminSecret: "secret"}),
	)...)

	ctx := session.WithAccessToken(t.Context(), "caller")

	_, err := client.GraphQL.Request(ctx, "query { __typename }", nil, nil)
	if !errors.Is(err, middleware.ErrAccessTokenWithAdminSession) {
		t.Fatalf("graphql error = %v, want ErrAccessTokenWithAdminSession", err)
	}

	if _, _, err := client.Auth.GetUser(ctx, nil); err != nil {
		t.Fatalf("auth get user: %v", err)
	}

	if got := <-seen; got != "/auth/user Bearer caller" {
		t.Fatalf("auth request = %q, want the caller's token", got)
	}
}

// TestClientWithoutSessionStorage is the quickstart's server: one client, no
// stored sessions, and each request carrying its caller's token.
func TestClientWithoutSessionStorage(t *testing.T) {
	t.Parallel()

	seen := make(chan string, 2)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		seen <- req.Header.Get("Authorization")

		if req.URL.Path == "/auth/signin/email-password" {
			w.Header().Set("Content-Type", "application/json")

			if err := json.NewEncoder(w).Encode(auth.SignInEmailPasswordResponse{
				Session: &auth.Session{
					AccessToken:  testAccessToken(t, time.Now().Add(time.Hour).Unix()),
					RefreshToken: "refresh-token",
				},
			}); err != nil {
				t.Errorf("encode sign-in response: %v", err)
			}

			return
		}

		writeCanned(t, w, req)
	}))
	defer server.Close()

	client := newClient(t, serviceOptions(server)...)

	signedIn, _, err := client.Auth.SignInEmailPassword(t.Context(),
		auth.SignInEmailPasswordRequest{Email: "ada@example.com", Password: "secret"}, nil)
	if err != nil || signedIn.Session == nil {
		t.Fatalf("sign in = (%#v, %v), want the session returned to the caller", signedIn, err)
	}

	<-seen

	if _, err := client.Session(t.Context()); !errors.Is(err, nhost.ErrNoSessionStorage) {
		t.Fatalf("Session() error = %v, want ErrNoSessionStorage", err)
	}

	ctx := session.WithAccessToken(t.Context(), signedIn.Session.AccessToken)
	if _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, nil); err != nil {
		t.Fatalf("graphql request: %v", err)
	}

	if got := <-seen; got != "Bearer "+signedIn.Session.AccessToken {
		t.Fatalf("graphql Authorization = %q, want the request's token", got)
	}
}

// TestClientServesManyUsers is the multi-user server: one client over one
// store, each sign-in stored under its user, and the context picking the
// session each request carries.
func TestClientServesManyUsers(t *testing.T) {
	t.Parallel()

	tokens := map[string]string{
		"user-1": testUserAccessToken(t, "user-1", time.Now().Add(time.Hour).Unix()),
		"user-2": testUserAccessToken(t, "user-2", time.Now().Add(time.Hour).Unix()),
	}
	seen := make(chan string, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/auth/signin/email-password" {
			seen <- req.Header.Get("Authorization")

			writeCanned(t, w, req)

			return
		}

		var body auth.SignInEmailPasswordRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Errorf("decode sign-in: %v", err)
		}

		userID := strings.TrimSuffix(body.Email, "@example.com")

		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(auth.SignInEmailPasswordResponse{
			Session: &auth.Session{
				AccessToken:  tokens[userID],
				RefreshToken: "refresh-" + userID,
				User:         &auth.User{ID: userID},
			},
		}); err != nil {
			t.Errorf("encode sign-in response: %v", err)
		}
	}))
	defer server.Close()

	client := newClient(t, append(
		serviceOptions(server),
		nhost.WithSessionStorage(&session.MultiUserMemoryStorage{}),
	)...)

	for userID := range tokens {
		if _, _, err := client.Auth.SignInEmailPassword(
			t.Context(),
			auth.SignInEmailPasswordRequest{
				Email:    userID + "@example.com",
				Password: "secret",
			},
			nil,
		); err != nil {
			t.Fatalf("sign in %s: %v", userID, err)
		}
	}

	for userID, token := range tokens {
		ctx := session.WithUserID(t.Context(), userID)
		if _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, nil); err != nil {
			t.Fatalf("graphql as %s: %v", userID, err)
		}

		if got := <-seen; got != "Bearer "+token {
			t.Errorf("%s request Authorization = %q, want its own token", userID, got)
		}
	}

	if _, err := client.GraphQL.Request(t.Context(), "query { __typename }", nil, nil); err != nil {
		t.Fatalf("graphql without a user: %v", err)
	}

	if got := <-seen; got != "" {
		t.Errorf("request naming no user sent Authorization %q, want none", got)
	}

	if err := client.ClearSession(session.WithUserID(t.Context(), "user-1")); err != nil {
		t.Fatalf("clear user-1: %v", err)
	}

	if got, err := client.Session(session.WithUserID(t.Context(), "user-2")); err != nil ||
		got == nil {
		t.Fatalf("user-2 session after clearing user-1 = (%#v, %v), want it kept", got, err)
	}
}

func TestWithMiddlewareOrdering(t *testing.T) {
	t.Parallel()

	oldAccessToken := testAccessToken(t, time.Now().Add(30*time.Second).Unix())
	freshAccessToken := testAccessToken(t, time.Now().Add(time.Hour).Unix())

	type event struct {
		stage         string
		authorization string
	}

	events := make(chan event, 4)
	recordEvent := func(got event) {
		select {
		case events <- got:
		default:
			t.Errorf("unexpected extra event: %+v", got)
		}
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch req.URL.Path {
		case "/auth/token":
			recordEvent(event{stage: "refresh", authorization: req.Header.Get("Authorization")})

			if err := json.NewEncoder(w).Encode(auth.Session{
				AccessToken:  freshAccessToken,
				RefreshToken: "fresh-refresh-token",
			}); err != nil {
				t.Errorf("encode refresh response: %v", err)
			}
		case "/storage/version":
			recordEvent(event{stage: "storage", authorization: req.Header.Get("Authorization")})

			if _, err := w.Write([]byte(`{"buildVersion":"test"}`)); err != nil {
				t.Errorf("write storage response: %v", err)
			}
		default:
			t.Errorf("unexpected request path %q", req.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	backend := &session.MemoryStorage{}
	seedSession(t, backend, oldAccessToken, "old-refresh-token")

	client := newClient(t, append(
		serviceOptions(server),
		nhost.WithSessionStorage(backend),
		nhost.WithMiddleware(func(next http.RoundTripper) http.RoundTripper {
			return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
				recordEvent(event{
					stage:         "middleware",
					authorization: req.Header.Get("Authorization"),
				})

				return next.RoundTrip(req)
			})
		}),
	)...)

	if _, _, err := client.Storage.GetVersion(t.Context(), nil); err != nil {
		t.Fatalf("storage version: %v", err)
	}

	wantAuthorization := "Bearer " + freshAccessToken
	expected := []event{
		{stage: "refresh", authorization: ""},
		{stage: "middleware", authorization: wantAuthorization},
		{stage: "storage", authorization: wantAuthorization},
	}

	for _, want := range expected {
		if got := <-events; got != want {
			t.Errorf("event = %+v, want %+v", got, want)
		}
	}

	select {
	case got := <-events:
		t.Errorf("unexpected extra event: %+v", got)
	default:
	}
}

func TestClientSessionAccessors(t *testing.T) {
	t.Parallel()

	backend := &session.MemoryStorage{}
	client := newClient(t, nhost.WithSessionStorage(backend))

	got, err := client.Session(t.Context())
	if err != nil || got != nil {
		t.Fatalf("initial session = (%#v, %v), want (nil, nil)", got, err)
	}

	seedSession(t, backend, testAccessToken(t, time.Now().Add(time.Hour).Unix()), "refresh-token")

	got, err = client.Session(t.Context())
	if err != nil || got == nil || got.RefreshToken != "refresh-token" {
		t.Fatalf("stored session = (%#v, %v), want refresh-token", got, err)
	}

	if err := client.ClearSession(t.Context()); err != nil {
		t.Fatalf("clear session: %v", err)
	}

	got, err = client.Session(t.Context())
	if err != nil || got != nil {
		t.Fatalf("cleared session = (%#v, %v), want (nil, nil)", got, err)
	}

	bare := newClient(t)
	if err := bare.ClearSession(t.Context()); !errors.Is(err, nhost.ErrNoSessionStorage) {
		t.Fatalf("ClearSession() without storage = %v, want ErrNoSessionStorage", err)
	}

	if _, err := bare.RefreshSession(t.Context(), 0); !errors.Is(err, nhost.ErrNoSessionStorage) {
		t.Fatalf("RefreshSession() without storage = %v, want ErrNoSessionStorage", err)
	}
}

// TestRefreshSessionUsesBareClientWithCustomAuthURL checks an explicit refresh
// reaches the configured auth URL through a client without session middleware:
// no Authorization header, one request, one write of the rotated session.
func TestRefreshSessionUsesBareClientWithCustomAuthURL(t *testing.T) {
	t.Parallel()

	oldAccessToken := testAccessToken(t, time.Now().Add(30*time.Second).Unix())
	newAccessToken := testAccessToken(t, time.Now().Add(time.Hour).Unix())

	var (
		hits          atomic.Int32
		authorization atomic.Value
	)

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			hits.Add(1)
			authorization.Store(request.Header.Get("Authorization"))

			if request.Method != http.MethodPost || request.URL.Path != "/v1/auth/token" {
				t.Errorf(
					"request = %s %s, want POST /v1/auth/token",
					request.Method,
					request.URL.Path,
				)
			}

			writer.Header().Set("Content-Type", "application/json")

			if err := json.NewEncoder(writer).Encode(auth.Session{
				AccessToken:  newAccessToken,
				RefreshToken: "rotated-refresh-token",
			}); err != nil {
				t.Errorf("encode refresh response: %v", err)
			}
		}),
	)
	defer server.Close()

	backend := &countingSetBackend{delegate: &session.MemoryStorage{}}
	seedSession(t, backend, oldAccessToken, "old-refresh-token")
	backend.sets.Store(0)

	client := newClient(t,
		nhost.WithAuthURL(server.URL+"/v1/auth"),
		nhost.WithHTTPClient(server.Client()),
		nhost.WithSessionStorage(backend),
	)

	type refreshResult struct {
		session *session.StoredSession
		err     error
	}

	resultChannel := make(chan refreshResult, 1)
	go func() {
		got, err := client.RefreshSession(t.Context(), nhost.DefaultRefreshMarginSeconds)
		resultChannel <- refreshResult{session: got, err: err}
	}()

	select {
	case result := <-resultChannel:
		if result.err != nil {
			t.Fatalf("refresh session: %v", result.err)
		}

		if result.session == nil || result.session.RefreshToken != "rotated-refresh-token" {
			t.Fatalf("session = %#v, want rotated refresh token", result.session)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("refresh did not return before timeout")
	}

	if hits.Load() != 1 {
		t.Fatalf("token endpoint hits = %d, want 1", hits.Load())
	}

	if got, _ := authorization.Load().(string); got != "" {
		t.Errorf("refresh Authorization = %q, want empty", got)
	}

	if backend.sets.Load() != 1 {
		t.Fatalf("session storage writes = %d, want 1", backend.sets.Load())
	}
}

// countingSetBackend counts writes so a test can assert that a refresh persists
// the rotated session exactly once.
type countingSetBackend struct {
	delegate *session.MemoryStorage
	sets     atomic.Int32
}

func (b *countingSetBackend) Get(
	ctx context.Context,
	userID string,
) (*session.StoredSession, error) {
	return b.delegate.Get(ctx, userID) //nolint:wrapcheck // Delegating to the real backend.
}

func (b *countingSetBackend) Set(ctx context.Context, value session.StoredSession) error {
	b.sets.Add(1)

	return b.delegate.Set(ctx, value) //nolint:wrapcheck // Delegating to the real backend.
}

func (b *countingSetBackend) Remove(ctx context.Context, userID string) error {
	return b.delegate.Remove(ctx, userID) //nolint:wrapcheck // Delegating to the real backend.
}

func seedSession(t *testing.T, backend session.Backend, accessToken, refreshToken string) {
	t.Helper()

	stored, err := session.ToStoredSession(auth.Session{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
	if err != nil {
		t.Fatalf("build stored session: %v", err)
	}

	if err := backend.Set(t.Context(), stored); err != nil {
		t.Fatalf("seed session: %v", err)
	}
}

func testAccessToken(t *testing.T, expiry int64) string {
	t.Helper()

	return testUserAccessToken(t, "user-1", expiry)
}

func testUserAccessToken(t *testing.T, userID string, expiry int64) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

	payload, err := json.Marshal(map[string]any{"exp": expiry, "sub": userID})
	if err != nil {
		t.Fatalf("marshal token payload: %v", err)
	}

	return header + "." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}
