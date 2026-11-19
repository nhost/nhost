package clienv //nolint:testpackage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func newTestCliEnv() *CliEnv {
	return New(
		io.Discard, io.Discard,
		NewPathStructure("", "", "", ""),
		"", "", "", "", "", "", "",
	)
}

func setupAuthFile(t *testing.T, refreshToken string) {
	t.Helper()
	setupAuthFileWithCreds(t, Credentials{
		RefreshToken:       refreshToken,
		OAuth2RefreshToken: "",
	})
}

func setupAuthFileWithCreds(t *testing.T, creds Credentials) {
	t.Helper()

	nhostDir := filepath.Join(os.Getenv("XDG_STATE_HOME"), "nhost")
	if err := os.MkdirAll(nhostDir, 0o755); err != nil {
		t.Fatalf("failed to create nhost dir: %v", err)
	}

	data, err := json.Marshal(creds)
	if err != nil {
		t.Fatalf("failed to marshal credentials: %v", err)
	}

	authFile := filepath.Join(nhostDir, "auth.json")
	if err := os.WriteFile(authFile, data, 0o600); err != nil {
		t.Fatalf("failed to write auth file: %v", err)
	}
}

func TestCredentials(t *testing.T) {
	t.Run("valid credentials", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "test-refresh-token")

		result, err := newTestCliEnv().Credentials()
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if result.RefreshToken != "test-refresh-token" {
			t.Fatalf(
				"expected refresh token %q, got %q",
				"test-refresh-token",
				result.RefreshToken,
			)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())

		_, err := newTestCliEnv().Credentials()
		if err == nil {
			t.Fatal("expected error for missing auth file")
		}
	})

	t.Run("valid oauth2 credentials", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFileWithCreds(t, Credentials{
			RefreshToken:       "",
			OAuth2RefreshToken: "test-oauth2-refresh-token",
		})

		result, err := newTestCliEnv().Credentials()
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if result.OAuth2RefreshToken != "test-oauth2-refresh-token" {
			t.Fatalf(
				"expected oauth2 refresh token %q, got %q",
				"test-oauth2-refresh-token",
				result.OAuth2RefreshToken,
			)
		}

		if result.RefreshToken != "" {
			t.Fatalf(
				"expected empty refresh token, got %q",
				result.RefreshToken,
			)
		}
	})

	t.Run("empty refresh token", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "")

		_, err := newTestCliEnv().Credentials()
		if !errors.Is(err, errMissingRefreshToken) {
			t.Fatalf(
				"expected errMissingRefreshToken, got: %v",
				err,
			)
		}
	})
}

func TestSaveCredentials(t *testing.T) {
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	ce := newTestCliEnv()
	creds := Credentials{RefreshToken: "saved-token", OAuth2RefreshToken: ""}

	if err := saveCredentials(ce, creds); err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	result, err := ce.Credentials()
	if err != nil {
		t.Fatalf("expected no error reading back, got: %v", err)
	}

	if result.RefreshToken != "saved-token" {
		t.Fatalf(
			"expected refresh token %q, got %q",
			"saved-token",
			result.RefreshToken,
		)
	}
}

func TestSaveOAuth2Credentials(t *testing.T) {
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	ce := newTestCliEnv()
	creds := Credentials{RefreshToken: "", OAuth2RefreshToken: "saved-oauth2-token"}

	if err := saveCredentials(ce, creds); err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	result, err := ce.Credentials()
	if err != nil {
		t.Fatalf("expected no error reading back, got: %v", err)
	}

	if result.OAuth2RefreshToken != "saved-oauth2-token" {
		t.Fatalf(
			"expected oauth2 refresh token %q, got %q",
			"saved-oauth2-token",
			result.OAuth2RefreshToken,
		)
	}

	if result.RefreshToken != "" {
		t.Fatalf(
			"expected empty refresh token, got %q",
			result.RefreshToken,
		)
	}
}

type tokenServer struct {
	*httptest.Server

	expiresIn int

	mu       sync.Mutex
	current  string
	rotation int
}

// newTokenServer emulates the Auth and OAuth2 token endpoints: each refresh token
// works once, and access tokens expire after expiresIn seconds.
func newTokenServer(t *testing.T, expiresIn int) *tokenServer {
	t.Helper()

	s := &tokenServer{
		Server:    nil,
		expiresIn: expiresIn,
		mu:        sync.Mutex{},
		current:   "refresh-0",
		rotation:  0,
	}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			writeResponsef(t, w, `{"issuer":%q,"token_endpoint":%q}`, s.URL, s.URL+"/oauth2/token")
		case "/oauth2/token":
			access, refresh, ok := s.rotate(r.FormValue("refresh_token"))
			if !ok {
				w.WriteHeader(http.StatusBadRequest)
				writeResponsef(t, w, `{"error":"invalid_grant"}`)

				return
			}

			writeResponsef(t, w,
				`{"access_token":%q,"token_type":"Bearer","refresh_token":%q,"expires_in":%d}`,
				access, refresh, s.expiresIn,
			)
		case "/token":
			var body struct {
				RefreshToken string `json:"refreshToken"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
			}

			access, refresh, ok := s.rotate(body.RefreshToken)
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				writeResponsef(t, w, `{"status":401,"error":"invalid-refresh-token"}`)

				return
			}

			writeResponsef(
				t,
				w,
				`{"accessToken":%q,"accessTokenExpiresIn":%d,"refreshToken":%q,"refreshTokenId":"id"}`,
				access,
				s.expiresIn,
				refresh,
			)
		case "/signin/pat":
			access, refresh := s.signIn()
			writeResponsef(
				t,
				w,
				`{"session":{"accessToken":%q,"accessTokenExpiresIn":%d,"refreshToken":%q,"refreshTokenId":"id"}}`,
				access,
				s.expiresIn,
				refresh,
			)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.Close)

	return s
}

func (s *tokenServer) rotate(presented string) (string, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if presented != s.current {
		return "", "", false
	}

	access, refresh := s.issue()

	return access, refresh, true
}

// signIn issues tokens without a refresh token, as a login does.
func (s *tokenServer) signIn() (string, string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.issue()
}

// issue must be called with s.mu held.
func (s *tokenServer) issue() (string, string) {
	s.rotation++
	s.current = fmt.Sprintf("refresh-%d", s.rotation)

	return fmt.Sprintf("access-%d", s.rotation), s.current
}

func newServerEnv(server *tokenServer, pat string) *CliEnv {
	return New(
		io.Discard, io.Discard, NewPathStructure("", "", "", ""),
		server.URL, "", "test-client", pat, "", "", "",
	)
}

func writeResponsef(t *testing.T, w io.Writer, format string, args ...any) {
	t.Helper()

	if _, err := fmt.Fprintf(w, format, args...); err != nil {
		t.Error(err)
	}
}

func TestSessionSharedByProcesses(t *testing.T) {
	tests := []struct {
		name  string
		creds Credentials
	}{
		{name: "oauth2", creds: Credentials{RefreshToken: "", OAuth2RefreshToken: "refresh-0"}},
		{name: "pat", creds: Credentials{RefreshToken: "refresh-0", OAuth2RefreshToken: ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())
			setupAuthFileWithCreds(t, tt.creds)

			// oauth2 treats a token as expired 10 seconds early, so 1-second tokens
			// are expired at once and every interceptor call refreshes.
			server := newTokenServer(t, 1)

			longRunning, err := newServerEnv(server, "").NewCloudInterceptor(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			authorize(t, longRunning)

			// If a refresh fails, LoadSession logs in; a PAT makes that a request to
			// the test server instead of a browser login.
			var wg sync.WaitGroup
			for range 10 {
				wg.Go(func() {
					token, err := newServerEnv(server, "unused-pat").LoadSession(t.Context())
					if err != nil || !strings.HasPrefix(token, "access-") {
						t.Errorf("LoadSession() = %q, %v", token, err)
					}
				})
			}

			wg.Wait()

			authorize(t, longRunning)

			creds, err := newServerEnv(server, "").Credentials()
			if err != nil {
				t.Fatal(err)
			}

			if got := creds.OAuth2RefreshToken + creds.RefreshToken; got != "refresh-12" {
				t.Errorf("stored refresh token = %q, want refresh-12", got)
			}
		})
	}
}

func TestCloudInterceptorReusesAccessToken(t *testing.T) {
	tests := []struct {
		name  string
		creds Credentials
	}{
		{name: "oauth2", creds: Credentials{RefreshToken: "", OAuth2RefreshToken: "refresh-0"}},
		{name: "pat", creds: Credentials{RefreshToken: "refresh-0", OAuth2RefreshToken: ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())
			setupAuthFileWithCreds(t, tt.creds)

			server := newTokenServer(t, 3600)

			intercept, err := newServerEnv(server, "").NewCloudInterceptor(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			first := authorize(t, intercept)
			second := authorize(t, intercept)

			if first != "Bearer access-1" || second != first {
				t.Errorf(
					"Authorization = %q then %q, want Bearer access-1 for both",
					first, second,
				)
			}
		})
	}
}

func TestRejectedRefreshToken(t *testing.T) {
	t.Run("interceptor reports the server response", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "revoked")

		server := newTokenServer(t, 1)

		intercept, err := newServerEnv(server, "").NewCloudInterceptor(t.Context())
		if err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", nil)
		want := "failed to refresh access token: error during token refresh: 401 Unauthorized\n" +
			`{"status":401,"error":"invalid-refresh-token"}`

		if err := intercept(t.Context(), req); err == nil || err.Error() != want {
			t.Errorf("intercept() error = %v, want %q", err, want)
		}
	})

	t.Run("LoadSession logs in again", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "revoked")

		server := newTokenServer(t, 1)

		// The login issues refresh-1, and LoadSession refreshes it to access-2.
		token, err := newServerEnv(server, "pat").LoadSession(t.Context())
		if err != nil || token != "access-2" {
			t.Errorf("LoadSession() = %q, %v, want access-2", token, err)
		}
	})
}

func authorize(t *testing.T, intercept func(context.Context, *http.Request) error) string {
	t.Helper()

	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", nil)
	if err := intercept(t.Context(), req); err != nil {
		t.Fatal(err)
	}

	got := req.Header.Get("Authorization")
	if !strings.HasPrefix(got, "Bearer access-") {
		t.Fatalf("Authorization = %q", got)
	}

	return got
}
