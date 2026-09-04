package nhost_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestConfigUseAuthAppliesOnlyToAuth(t *testing.T) {
	t.Parallel()

	type observedRequest struct {
		path   string
		header string
	}

	observed := make(chan observedRequest, 2)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		observed <- observedRequest{path: req.URL.Path, header: req.Header.Get("X-Auth-Only")}

		w.Header().Set("Content-Type", "application/json")

		body := []byte(`{}`)
		if req.URL.Path == "/auth/v1/healthz" {
			body = []byte(`"OK"`)
		}

		if _, err := w.Write(body); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	client := nhost.NewBareClient(nhost.Options{
		AuthURL:      server.URL + "/auth/v1",
		StorageURL:   server.URL + "/storage/v1",
		GraphQLURL:   server.URL + "/graphql/v1",
		FunctionsURL: server.URL + "/functions/v1",
		HTTPClient:   server.Client(),
		Configure: []nhost.ConfigureFunc{
			func(config *nhost.Config) {
				config.UseAuth(func(next http.RoundTripper) http.RoundTripper {
					return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
						req = req.Clone(req.Context())
						req.Header.Set("X-Auth-Only", "yes")

						return next.RoundTrip(req)
					})
				})
			},
		},
	})

	if _, _, err := client.Auth.HealthCheckGet(context.Background(), nil); err != nil {
		t.Fatalf("auth health check: %v", err)
	}

	if _, _, err := client.Functions.Call(
		context.Background(),
		"echo",
		http.MethodGet,
		nil,
		nil,
	); err != nil {
		t.Fatalf("functions call: %v", err)
	}

	gotAuth := <-observed
	if gotAuth.path != "/auth/v1/healthz" || gotAuth.header != "yes" {
		t.Fatalf("auth request = %+v, want auth-only header", gotAuth)
	}

	gotFunctions := <-observed
	if gotFunctions.path != "/functions/v1/echo" || gotFunctions.header != "" {
		t.Fatalf("functions request = %+v, want no auth-only header", gotFunctions)
	}
}

func TestConfigUseDataServicesNeverHitsAuth(t *testing.T) {
	t.Parallel()

	type observedRequest struct {
		path        string
		adminSecret string
	}

	observed := make(chan observedRequest, 5)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		got := observedRequest{
			path:        req.URL.Path,
			adminSecret: req.Header.Get("x-hasura-admin-secret"),
		}
		select {
		case observed <- got:
		default:
			t.Errorf("unexpected extra request: %+v", got)
		}

		w.Header().Set("Content-Type", "application/json")

		responses := map[string]string{
			"/auth/v1/healthz":    `"OK"`,
			"/storage/v1/version": `{"buildVersion":"test"}`,
			"/graphql/v1":         `{"data":{}}`,
			"/functions/v1/echo":  `{}`,
		}

		body, ok := responses[req.URL.Path]
		if !ok {
			t.Errorf("unexpected request path %q", req.URL.Path)
			w.WriteHeader(http.StatusNotFound)

			return
		}

		if _, err := w.Write([]byte(body)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	adminCredential := t.Name()
	adminMiddleware := middleware.WithAdminSession(
		middleware.AdminSessionOptions{AdminSecret: adminCredential},
		server.URL,
	)

	client := nhost.NewBareClient(nhost.Options{
		AuthURL:      server.URL + "/auth/v1",
		StorageURL:   server.URL + "/storage/v1",
		GraphQLURL:   server.URL + "/graphql/v1",
		FunctionsURL: server.URL + "/functions/v1",
		HTTPClient:   server.Client(),
		Configure: []nhost.ConfigureFunc{
			func(config *nhost.Config) {
				config.UseDataServices(adminMiddleware)
			},
		},
	})

	ctx := context.Background()
	if _, _, err := client.Auth.HealthCheckGet(ctx, nil); err != nil {
		t.Fatalf("auth health check: %v", err)
	}

	if _, _, err := client.Storage.GetVersion(ctx, nil); err != nil {
		t.Fatalf("storage version: %v", err)
	}

	if _, _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, "", nil); err != nil {
		t.Fatalf("graphql request: %v", err)
	}

	if _, _, err := client.Functions.Call(ctx, "echo", http.MethodGet, nil, nil); err != nil {
		t.Fatalf("functions call: %v", err)
	}

	expected := []observedRequest{
		{path: "/auth/v1/healthz", adminSecret: ""},
		{path: "/storage/v1/version", adminSecret: adminCredential},
		{path: "/graphql/v1", adminSecret: adminCredential},
		{path: "/functions/v1/echo", adminSecret: adminCredential},
	}

	for _, want := range expected {
		if got := <-observed; got != want {
			t.Errorf("request = %+v, want %+v", got, want)
		}
	}

	select {
	case got := <-observed:
		t.Errorf("unexpected extra request: %+v", got)
	default:
	}
}

func TestWithAdminSessionNeverHitsAuth(t *testing.T) {
	t.Parallel()

	type observedRequest struct {
		path        string
		adminSecret string
	}

	observed := make(chan observedRequest, 4)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		observed <- observedRequest{
			path:        req.URL.Path,
			adminSecret: req.Header.Get("x-hasura-admin-secret"),
		}

		w.Header().Set("Content-Type", "application/json")

		responses := map[string]string{
			"/auth/v1/healthz":    `"OK"`,
			"/storage/v1/version": `{"buildVersion":"test"}`,
			"/graphql/v1":         `{"data":{}}`,
			"/functions/v1/echo":  `{}`,
		}

		body, ok := responses[req.URL.Path]
		if !ok {
			t.Errorf("unexpected request path %q", req.URL.Path)
			w.WriteHeader(http.StatusNotFound)

			return
		}

		if _, err := w.Write([]byte(body)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	adminCredential := t.Name()

	client := nhost.NewBareClient(nhost.Options{
		AuthURL:      server.URL + "/auth/v1",
		StorageURL:   server.URL + "/storage/v1",
		GraphQLURL:   server.URL + "/graphql/v1",
		FunctionsURL: server.URL + "/functions/v1",
		HTTPClient:   server.Client(),
		Configure: []nhost.ConfigureFunc{
			nhost.WithAdminSession(middleware.AdminSessionOptions{AdminSecret: adminCredential}),
		},
	})

	ctx := context.Background()
	if _, _, err := client.Auth.HealthCheckGet(ctx, nil); err != nil {
		t.Fatalf("auth health check: %v", err)
	}

	if _, _, err := client.Storage.GetVersion(ctx, nil); err != nil {
		t.Fatalf("storage version: %v", err)
	}

	if _, _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, "", nil); err != nil {
		t.Fatalf("graphql request: %v", err)
	}

	if _, _, err := client.Functions.Call(ctx, "echo", http.MethodGet, nil, nil); err != nil {
		t.Fatalf("functions call: %v", err)
	}

	expected := []observedRequest{
		{path: "/auth/v1/healthz", adminSecret: ""},
		{path: "/storage/v1/version", adminSecret: adminCredential},
		{path: "/graphql/v1", adminSecret: adminCredential},
		{path: "/functions/v1/echo", adminSecret: adminCredential},
	}

	for _, want := range expected {
		if got := <-observed; got != want {
			t.Errorf("request = %+v, want %+v", got, want)
		}
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

	client := nhost.New(nhost.Options{
		AuthURL:    server.URL + "/auth",
		StorageURL: server.URL + "/storage",
		HTTPClient: server.Client(),
		Storage:    &session.MemoryStorage{},
		Configure: []nhost.ConfigureFunc{
			nhost.WithMiddleware(func(next http.RoundTripper) http.RoundTripper {
				return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
					recordEvent(event{
						stage:         "middleware",
						authorization: req.Header.Get("Authorization"),
					})

					return next.RoundTrip(req)
				})
			}),
		},
	})

	if err := client.SessionStorage.Set(auth.Session{
		AccessToken:  oldAccessToken,
		RefreshToken: "old-refresh-token",
	}); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	if _, _, err := client.Storage.GetVersion(context.Background(), nil); err != nil {
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

	client := nhost.NewBareClient(nhost.Options{Storage: &session.MemoryStorage{}})
	if got, ok := client.GetUserSession(); ok || got != nil {
		t.Fatalf("initial session = (%#v, %t), want (nil, false)", got, ok)
	}

	if err := client.SessionStorage.Set(auth.Session{
		AccessToken:  testAccessToken(t, time.Now().Add(time.Hour).Unix()),
		RefreshToken: "refresh-token",
	}); err != nil {
		t.Fatalf("set session: %v", err)
	}

	got, ok := client.GetUserSession()
	if !ok || got == nil || got.RefreshToken != "refresh-token" {
		t.Fatalf("stored session = (%#v, %t), want refresh-token", got, ok)
	}

	client.ClearSession()

	if got, ok := client.GetUserSession(); ok || got != nil {
		t.Fatalf("cleared session = (%#v, %t), want (nil, false)", got, ok)
	}
}

func TestNewServerClientRequiresStorage(t *testing.T) {
	t.Parallel()

	if _, err := nhost.NewServerClient(nhost.Options{}); err == nil {
		t.Fatal("expected error when storage is nil")
	}

	if _, err := nhost.NewServerClient(nhost.Options{
		Storage: &session.MemoryStorage{},
	}); err != nil {
		t.Fatalf("unexpected error with storage: %v", err)
	}
}

func TestConstructorsProvideBareRefreshClient(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		construct func() (*nhost.Client, error)
	}{
		{
			name: "app client",
			construct: func() (*nhost.Client, error) {
				return nhost.New(nhost.Options{}), nil
			},
		},
		{
			name: "server client",
			construct: func() (*nhost.Client, error) {
				return nhost.NewServerClient(nhost.Options{Storage: &session.MemoryStorage{}})
			},
		},
		{
			name: "bare client",
			construct: func() (*nhost.Client, error) {
				return nhost.NewBareClient(nhost.Options{}), nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client, err := tt.construct()
			if err != nil {
				t.Fatalf("construct client: %v", err)
			}

			if client.RefreshClient == nil {
				t.Fatal("RefreshClient is nil")
			}

			if client.RefreshClient == client.Auth {
				t.Fatal("RefreshClient aliases the middleware-wrapped Auth client")
			}
		})
	}
}

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

	client := nhost.New(nhost.Options{
		AuthURL:    server.URL + "/v1/auth",
		HTTPClient: server.Client(),
		Storage:    &session.MemoryStorage{},
	})

	var changes atomic.Int32
	client.SessionStorage.OnChange(func(*session.StoredSession) {
		changes.Add(1)
	})

	if err := client.SessionStorage.Set(auth.Session{
		AccessToken:  oldAccessToken,
		RefreshToken: "old-refresh-token",
	}); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	changes.Store(0)

	type refreshResult struct {
		session *session.StoredSession
		err     error
	}

	resultChannel := make(chan refreshResult, 1)
	go func() {
		got, err := client.RefreshSession(context.Background(), nhost.DefaultRefreshMarginSeconds)
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

	if changes.Load() != 1 {
		t.Fatalf("session change notifications = %d, want 1", changes.Load())
	}
}

func testAccessToken(t *testing.T, expiry int64) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

	payload, err := json.Marshal(map[string]any{"exp": expiry, "sub": "user-1"})
	if err != nil {
		t.Fatalf("marshal token payload: %v", err)
	}

	return header + "." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}
