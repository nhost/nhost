package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

const refreshMarginSeconds = 60

type countingBackend struct {
	delegate *session.MemoryStorage
	removes  atomic.Int32
}

func (b *countingBackend) Get() (*session.StoredSession, bool) {
	return b.delegate.Get()
}

func (b *countingBackend) Set(value session.StoredSession) {
	b.delegate.Set(value)
}

func (b *countingBackend) Remove() {
	b.removes.Add(1)
	b.delegate.Remove()
}

func waitGroupWithin(t *testing.T, waitGroup *sync.WaitGroup, timeout time.Duration) {
	t.Helper()

	done := make(chan struct{})
	go func() {
		waitGroup.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(timeout):
		t.Fatalf("goroutines did not finish within %s", timeout)
	}
}

func tokenWithExpiry(t *testing.T, expiry int64) string {
	t.Helper()

	return makeToken(t, map[string]any{"exp": expiry, "sub": "user-1"})
}

func seedSession(t *testing.T, expiry int64) (*session.Storage, auth.Session) {
	t.Helper()

	value := auth.Session{
		AccessToken:  tokenWithExpiry(t, expiry),
		RefreshToken: "old-refresh-token",
	}

	store := session.NewStorage(&session.MemoryStorage{})
	if err := store.Set(value); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	return store, value
}

func writeAuthSession(t *testing.T, writer http.ResponseWriter, value auth.Session) {
	t.Helper()

	writer.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(writer).Encode(value); err != nil {
		t.Errorf("encode session response: %v", err)
	}
}

func TestRefreshSessionHappyPath(t *testing.T) {
	t.Parallel()

	store, _ := seedSession(t, time.Now().Add(30*time.Second).Unix())
	refreshed := auth.Session{
		AccessToken:  tokenWithExpiry(t, time.Now().Add(time.Hour).Unix()),
		RefreshToken: "rotated-refresh-token",
	}

	var hits atomic.Int32

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			hits.Add(1)

			if request.Method != http.MethodPost || request.URL.Path != "/token" {
				t.Errorf("request = %s %s, want POST /token", request.Method, request.URL.Path)
			}

			var body auth.RefreshTokenRequest
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Errorf("decode request: %v", err)
			} else if body.RefreshToken != "old-refresh-token" {
				t.Errorf("refresh token = %q, want old-refresh-token", body.RefreshToken)
			}

			writeAuthSession(t, writer, refreshed)
		}),
	)
	defer server.Close()

	got, err := session.RefreshSession(
		context.Background(),
		auth.NewClient(server.URL, server.Client()),
		store,
		refreshMarginSeconds,
	)
	if err != nil {
		t.Fatalf("refresh session: %v", err)
	}

	if got == nil || got.AccessToken != refreshed.AccessToken ||
		got.RefreshToken != refreshed.RefreshToken {
		t.Fatalf("refreshed session = %#v, want rotated tokens", got)
	}

	if hits.Load() != 1 {
		t.Fatalf("token endpoint hits = %d, want 1", hits.Load())
	}

	stored, ok := store.Get()
	if !ok || stored.RefreshToken != "rotated-refresh-token" {
		t.Fatalf("stored session = %#v, ok=%v", stored, ok)
	}
}

func TestRefreshSessionErrorContract(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		expiry          int64
		margin          int
		status          int
		response        auth.Session
		wantSession     bool
		wantErr         bool
		wantCleared     bool
		wantErrContains string
	}{
		{
			name:        "401 in margin",
			expiry:      time.Now().Add(30 * time.Second).Unix(),
			margin:      refreshMarginSeconds,
			status:      http.StatusUnauthorized,
			wantSession: false,
			wantErr:     false,
			wantCleared: true,
		},
		{
			name:        "5xx in margin",
			expiry:      time.Now().Add(30 * time.Second).Unix(),
			margin:      refreshMarginSeconds,
			status:      http.StatusInternalServerError,
			wantSession: true,
			wantErr:     true,
			wantCleared: false,
		},
		{
			name:        "5xx expired",
			expiry:      time.Now().Add(-time.Minute).Unix(),
			margin:      refreshMarginSeconds,
			status:      http.StatusInternalServerError,
			wantSession: false,
			wantErr:     true,
			wantCleared: false,
		},
		{
			name:        "margin zero",
			expiry:      time.Now().Add(time.Hour).Unix(),
			margin:      0,
			status:      http.StatusInternalServerError,
			wantSession: true,
			wantErr:     true,
			wantCleared: false,
		},
		{
			name:   "storage Set failure",
			expiry: time.Now().Add(30 * time.Second).Unix(),
			margin: refreshMarginSeconds,
			status: http.StatusOK,
			response: auth.Session{
				AccessToken:  "not-a-jwt",
				RefreshToken: "rotated-refresh-token",
			},
			wantSession:     true,
			wantErr:         true,
			wantCleared:     false,
			wantErrContains: "storing refreshed session: invalid access token format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			store, original := seedSession(t, tt.expiry)

			var hits atomic.Int32

			server := httptest.NewServer(http.HandlerFunc(
				func(writer http.ResponseWriter, _ *http.Request) {
					hits.Add(1)

					if tt.status == http.StatusOK {
						writeAuthSession(t, writer, tt.response)

						return
					}

					http.Error(writer, http.StatusText(tt.status), tt.status)
				},
			))
			defer server.Close()

			got, err := session.RefreshSession(
				context.Background(),
				auth.NewClient(server.URL, server.Client()),
				store,
				tt.margin,
			)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, want error present %v", err, tt.wantErr)
			}

			if tt.wantErrContains != "" && !strings.Contains(err.Error(), tt.wantErrContains) {
				t.Fatalf("error = %q, want substring %q", err, tt.wantErrContains)
			}

			if (got != nil) != tt.wantSession {
				t.Fatalf("session present = %v, want %v", got != nil, tt.wantSession)
			}

			if got != nil && got.AccessToken != original.AccessToken {
				t.Fatalf("returned access token = %q, want original", got.AccessToken)
			}

			stored, ok := store.Get()
			if ok == tt.wantCleared {
				t.Fatalf("stored session present = %v, want %v", ok, !tt.wantCleared)
			}

			if ok && (stored.AccessToken != original.AccessToken ||
				stored.RefreshToken != original.RefreshToken) {
				t.Fatalf("stored session changed: %#v", stored)
			}

			if hits.Load() != 2 {
				t.Fatalf("token endpoint hits = %d, want 2", hits.Load())
			}
		})
	}
}

func TestRefreshSessionExpiredNetworkError(t *testing.T) {
	t.Parallel()

	store, original := seedSession(t, time.Now().Add(-time.Minute).Unix())
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	client := server.Client()
	baseURL := server.URL
	server.Close()

	got, err := session.RefreshSession(
		context.Background(), auth.NewClient(baseURL, client), store, refreshMarginSeconds,
	)
	if err == nil {
		t.Fatal("expected network error")
	}

	if got != nil {
		t.Fatalf("session = %#v, want nil for expired access token", got)
	}

	stored, ok := store.Get()
	if !ok || stored.AccessToken != original.AccessToken {
		t.Fatalf("stored session changed: %#v, ok=%v", stored, ok)
	}
}

func TestRefreshSessionCollapsesConcurrentCalls(t *testing.T) {
	t.Parallel()

	store, _ := seedSession(t, time.Now().Add(30*time.Second).Unix())
	refreshed := auth.Session{
		AccessToken:  tokenWithExpiry(t, time.Now().Add(time.Hour).Unix()),
		RefreshToken: "rotated-refresh-token",
	}

	var hits atomic.Int32

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			hits.Add(1)
			time.Sleep(50 * time.Millisecond)
			writeAuthSession(t, writer, refreshed)
		}),
	)
	defer server.Close()

	const callers = 20

	start := make(chan struct{})
	results := make([]*session.StoredSession, callers)
	errs := make([]error, callers)

	var waitGroup sync.WaitGroup
	waitGroup.Add(callers)

	client := auth.NewClient(server.URL, server.Client())
	for index := range callers {
		go func() {
			defer waitGroup.Done()

			<-start

			results[index], errs[index] = session.RefreshSession(
				context.Background(), client, store, refreshMarginSeconds,
			)
		}()
	}

	close(start)
	waitGroupWithin(t, &waitGroup, time.Second)

	if hits.Load() != 1 {
		t.Fatalf("token endpoint hits = %d, want 1", hits.Load())
	}

	for index := range callers {
		if errs[index] != nil {
			t.Errorf("caller %d error: %v", index, errs[index])
		}

		if results[index] == nil || results[index].RefreshToken != refreshed.RefreshToken {
			t.Errorf("caller %d session = %#v, want refreshed session", index, results[index])
		}
	}
}

func TestRefreshSessionUnauthorizedNotifiesOnceForConcurrentCallers(t *testing.T) {
	t.Parallel()

	backend := &countingBackend{delegate: &session.MemoryStorage{}}

	store := session.NewStorage(backend)
	if err := store.Set(auth.Session{
		AccessToken:  tokenWithExpiry(t, time.Now().Add(30*time.Second).Unix()),
		RefreshToken: "old-refresh-token",
	}); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	var notifications atomic.Int32
	store.OnChange(func(value *session.StoredSession) {
		if value == nil {
			notifications.Add(1)
		}
	})

	var hits atomic.Int32

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			hits.Add(1)
			time.Sleep(50 * time.Millisecond)
			http.Error(writer, "refresh token rejected", http.StatusUnauthorized)
		}),
	)
	defer server.Close()

	const callers = 20

	start := make(chan struct{})
	results := make([]*session.StoredSession, callers)
	errs := make([]error, callers)

	var waitGroup sync.WaitGroup
	waitGroup.Add(callers)

	client := auth.NewClient(server.URL, server.Client())
	for index := range callers {
		go func() {
			defer waitGroup.Done()

			<-start

			results[index], errs[index] = session.RefreshSession(
				context.Background(), client, store, refreshMarginSeconds,
			)
		}()
	}

	close(start)
	waitGroupWithin(t, &waitGroup, time.Second)

	for index := range callers {
		if errs[index] != nil {
			t.Errorf("caller %d error: %v", index, errs[index])
		}

		if results[index] != nil {
			t.Errorf("caller %d session = %#v, want nil", index, results[index])
		}
	}

	if hits.Load() != 2 {
		t.Errorf("token endpoint hits = %d, want 2", hits.Load())
	}

	if backend.removes.Load() != 1 {
		t.Errorf("backend Remove calls = %d, want 1", backend.removes.Load())
	}

	if notifications.Load() != 1 {
		t.Errorf("nil OnChange notifications = %d, want 1", notifications.Load())
	}
}

func TestRefreshSessionReentrantClientDoesNotDeadlock(t *testing.T) {
	t.Parallel()

	store, _ := seedSession(t, time.Now().Add(30*time.Second).Unix())
	refreshed := auth.Session{
		AccessToken:  tokenWithExpiry(t, time.Now().Add(time.Hour).Unix()),
		RefreshToken: "rotated-refresh-token",
	}

	var hits atomic.Int32

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			hits.Add(1)

			if request.URL.Path != "/v1/auth/token" {
				t.Errorf("request path = %q, want /v1/auth/token", request.URL.Path)
			}

			writeAuthSession(t, writer, refreshed)
		}),
	)
	defer server.Close()

	middlewareClient := auth.NewClient(server.URL+"/different-auth-base", server.Client())
	reentrantHTTPClient := transport.NewHTTPClient(
		server.Client(),
		middleware.SessionRefresh(middlewareClient, store, refreshMarginSeconds),
	)
	reentrantClient := auth.NewClient(server.URL+"/v1/auth", reentrantHTTPClient)

	type result struct {
		session *session.StoredSession
		err     error
	}

	resultChannel := make(chan result, 1)
	go func() {
		got, err := session.RefreshSession(
			context.Background(), reentrantClient, store, refreshMarginSeconds,
		)
		resultChannel <- result{session: got, err: err}
	}()

	select {
	case got := <-resultChannel:
		if got.err != nil {
			t.Fatalf("refresh session: %v", got.err)
		}

		if got.session == nil || got.session.RefreshToken != refreshed.RefreshToken {
			t.Fatalf("session = %#v, want refreshed session", got.session)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("reentrant refresh did not return before timeout")
	}

	if hits.Load() != 1 {
		t.Fatalf("token endpoint hits = %d, want 1", hits.Load())
	}
}

func TestRefreshSessionWaiterHonorsContextCancellation(t *testing.T) {
	t.Parallel()

	store, original := seedSession(t, time.Now().Add(30*time.Second).Unix())
	requestStarted := make(chan struct{})
	releaseRequest := make(chan struct{})

	release := sync.OnceFunc(func() { close(releaseRequest) })

	server := httptest.NewServer(
		http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			close(requestStarted)
			<-releaseRequest
			writeAuthSession(t, writer, auth.Session{
				AccessToken:  tokenWithExpiry(t, time.Now().Add(time.Hour).Unix()),
				RefreshToken: "rotated-refresh-token",
			})
		}),
	)
	defer server.Close()
	defer release()

	client := auth.NewClient(server.URL, server.Client())

	leaderDone := make(chan error, 1)
	go func() {
		_, err := session.RefreshSession(
			context.Background(), client, store, refreshMarginSeconds,
		)
		leaderDone <- err
	}()

	select {
	case <-requestStarted:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("leader request did not start before timeout")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	type result struct {
		session *session.StoredSession
		err     error
	}

	waiterDone := make(chan result, 1)
	go func() {
		got, err := session.RefreshSession(ctx, client, store, refreshMarginSeconds)
		waiterDone <- result{session: got, err: err}
	}()

	select {
	case got := <-waiterDone:
		if !errors.Is(got.err, context.Canceled) {
			t.Fatalf("error = %v, want context canceled", got.err)
		}

		if got.session == nil || got.session.AccessToken != original.AccessToken {
			t.Fatalf("session = %#v, want still-valid original", got.session)
		}
	case <-time.After(500 * time.Millisecond):
		release()
		t.Fatal("canceled waiter did not return before timeout")
	}

	release()

	select {
	case err := <-leaderDone:
		if err != nil {
			t.Fatalf("leader refresh: %v", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("leader refresh did not return before timeout")
	}
}
