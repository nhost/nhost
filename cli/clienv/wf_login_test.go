package clienv //nolint:testpackage

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCallbackHandler(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		query        string
		expectedCode string
		expectErr    bool
		expectedBody string
	}{
		{
			name:         "success",
			query:        "?state=test-state&code=auth-code-123",
			expectedCode: "auth-code-123",
			expectErr:    false,
			expectedBody: "Login successful. You may close this window.",
		},
		{
			name:         "state mismatch",
			query:        "?state=wrong-state&code=auth-code",
			expectedCode: "",
			expectErr:    true,
			expectedBody: "Login failed: state mismatch",
		},
		{
			name:         "error parameter",
			query:        "?error=access_denied&error_description=User+denied+access",
			expectedCode: "",
			expectErr:    true,
			expectedBody: "Login failed: User denied access",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resultCh := make(chan callbackResult, 1)
			handler := callbackHandler("test-state", resultCh)

			req := httptest.NewRequest(
				http.MethodGet,
				"/callback"+tc.query,
				nil,
			)
			w := httptest.NewRecorder()

			handler(w, req)

			result := <-resultCh

			if tc.expectErr && result.err == nil {
				t.Fatal("expected error but got nil")
			}

			if !tc.expectErr && result.err != nil {
				t.Fatalf("expected no error, got: %v", result.err)
			}

			if result.code != tc.expectedCode {
				t.Fatalf(
					"expected code %q, got %q",
					tc.expectedCode,
					result.code,
				)
			}

			if body := w.Body.String(); body != tc.expectedBody {
				t.Fatalf(
					"expected body %q, got %q",
					tc.expectedBody,
					body,
				)
			}
		})
	}
}

func TestWaitForCallback(t *testing.T) {
	t.Parallel()

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		resultCh := make(chan callbackResult, 1)
		resultCh <- callbackResult{code: "test-code", err: nil}

		code, err := waitForCallback(context.Background(), resultCh)
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if code != "test-code" {
			t.Fatalf("expected code %q, got %q", "test-code", code)
		}
	})

	t.Run("error in result", func(t *testing.T) {
		t.Parallel()

		resultCh := make(chan callbackResult, 1)
		resultCh <- callbackResult{
			code: "",
			err:  context.Canceled,
		}

		code, err := waitForCallback(context.Background(), resultCh)
		if err == nil {
			t.Fatal("expected error but got nil")
		}

		if code != "" {
			t.Fatalf("expected empty code, got %q", code)
		}
	})

	t.Run("context cancellation", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		resultCh := make(chan callbackResult)

		_, err := waitForCallback(ctx, resultCh)
		if err == nil {
			t.Fatal("expected error for cancelled context")
		}
	})
}

func TestFetchOAuth2Metadata(t *testing.T) {
	t.Parallel()

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		expected := OAuth2Metadata{
			AuthorizationEndpoint: "https://auth.example.com/authorize",
			TokenEndpoint:         "https://auth.example.com/token",
		}

		srv := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/.well-known/oauth-authorization-server" {
					http.NotFound(w, r)

					return
				}

				w.Header().Set("Content-Type", "application/json")

				if err := json.NewEncoder(w).Encode(expected); err != nil {
					http.Error(
						w,
						"encode error",
						http.StatusInternalServerError,
					)
				}
			}),
		)
		defer srv.Close()

		metadata, err := FetchOAuth2Metadata(
			context.Background(),
			srv.URL,
		)
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if metadata != expected {
			t.Fatalf("expected %+v, got %+v", expected, metadata)
		}
	})

	t.Run("bad status code", func(t *testing.T) {
		t.Parallel()

		srv := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			}),
		)
		defer srv.Close()

		_, err := FetchOAuth2Metadata(context.Background(), srv.URL)
		if err == nil {
			t.Fatal("expected error for bad status code")
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		t.Parallel()

		srv := httptest.NewServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				fmt.Fprint(w, "not-json")
			}),
		)
		defer srv.Close()

		_, err := FetchOAuth2Metadata(context.Background(), srv.URL)
		if err == nil {
			t.Fatal("expected error for invalid JSON")
		}
	})
}

func TestOAuth2Config(t *testing.T) {
	t.Parallel()

	metadata := OAuth2Metadata{
		AuthorizationEndpoint: "https://auth.example.com/authorize",
		TokenEndpoint:         "https://auth.example.com/token",
	}

	cfg := OAuth2Config(
		metadata,
		"test-client-id",
		"http://localhost:8080/callback",
	)

	if cfg.ClientID != "test-client-id" {
		t.Fatalf(
			"expected client ID %q, got %q",
			"test-client-id",
			cfg.ClientID,
		)
	}

	if cfg.Endpoint.AuthURL != metadata.AuthorizationEndpoint {
		t.Fatalf(
			"expected auth URL %q, got %q",
			metadata.AuthorizationEndpoint,
			cfg.Endpoint.AuthURL,
		)
	}

	if cfg.Endpoint.TokenURL != metadata.TokenEndpoint {
		t.Fatalf(
			"expected token URL %q, got %q",
			metadata.TokenEndpoint,
			cfg.Endpoint.TokenURL,
		)
	}

	if cfg.RedirectURL != "http://localhost:8080/callback" {
		t.Fatalf(
			"expected redirect URL %q, got %q",
			"http://localhost:8080/callback",
			cfg.RedirectURL,
		)
	}

	expectedScopes := []string{"openid", "offline_access", "graphql"}
	if len(cfg.Scopes) != len(expectedScopes) {
		t.Fatalf(
			"expected %d scopes, got %d",
			len(expectedScopes),
			len(cfg.Scopes),
		)
	}

	for i, s := range expectedScopes {
		if cfg.Scopes[i] != s {
			t.Fatalf(
				"expected scope %q at index %d, got %q",
				s, i, cfg.Scopes[i],
			)
		}
	}
}

func TestGenerateState(t *testing.T) {
	t.Parallel()

	state1, err := generateState()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if state1 == "" {
		t.Fatal("expected non-empty state")
	}

	state2, err := generateState()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if state1 == state2 {
		t.Fatal("expected unique states across calls")
	}
}

func TestStartCallbackServer(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	state := "integration-test-state"

	cb, err := startCallbackServer(ctx, state)
	if err != nil {
		t.Fatalf("failed to start callback server: %v", err)
	}

	defer func() {
		if err := cb.server.Shutdown(ctx); err != nil {
			t.Logf("shutdown error: %v", err)
		}
	}()

	callbackURL := fmt.Sprintf(
		"http://localhost:%d/callback?state=%s&code=test-code",
		cb.port,
		state,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		callbackURL,
		nil,
	)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to make callback request: %v", err)
	}
	defer resp.Body.Close()

	result := <-cb.resultCh

	if result.err != nil {
		t.Fatalf("expected no error, got: %v", result.err)
	}

	if result.code != "test-code" {
		t.Fatalf(
			"expected code %q, got %q",
			"test-code",
			result.code,
		)
	}
}
