package clienv //nolint:testpackage

import (
	"context"
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
		{
			name:         "missing code",
			query:        "?state=test-state",
			expectedCode: "",
			expectErr:    true,
			expectedBody: "Login failed: no authorization code received",
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
