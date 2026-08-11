package middleware //nolint:testpackage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

// turnstileCases lists every auth endpoint and whether Turnstile must gate
// it. When a new endpoint is added to the OpenAPI spec, add a row here so we
// can't silently drop or mis-classify it.
func turnstileCases() []struct {
	path string
	want bool
} {
	return []struct {
		path string
		want bool
	}{
		// Signin — passwordless & OTP email/SMS senders: gated.
		{"/signin/passwordless/email", true},
		{"/signin/passwordless/sms", true},
		{"/signin/otp/email", true},

		// Signin — verification endpoints: excluded.
		{"/signin/passwordless/sms/otp", false}, // SMS OTP verify (suffix /otp)
		{"/signin/otp/email/verify", false},
		{"/signin/webauthn/verify", false},

		// Signin — other methods: not gated (not sending emails/SMS).
		{"/signin/email-password", false},
		{"/signin/idtoken", false},
		{"/signin/webauthn", false},
		{"/signin/mfa/totp", false},
		{"/signin/pat", false},
		{"/signin/anonymous", false},

		// Signin — OAuth: GET redirects cannot carry custom headers, excluded.
		{"/signin/provider/google", false},
		{"/signin/provider/google/callback", false},
		{"/signin/provider/google/callback/tokens", false},

		// Signup — all methods: gated by default via /signup/ prefix.
		{"/signup/email-password", true},
		{"/signup/passwordless/email", true},
		{"/signup/otp/email", true},
		{"/signup/passwordless/sms", true},
		{"/signup/idtoken", true},
		{"/signup/webauthn", true},

		// Signup — verification endpoint: excluded.
		{"/signup/webauthn/verify", false},

		// Signup — OAuth: same GET-redirect reasoning as signin.
		{"/signup/provider/google", false},

		// Password reset.
		{"/user/password/reset", true},

		// Unrelated user endpoints are not gated by Turnstile.
		{"/user/email/change", false},
		{"/user/email/send-verification-email", false},
		{"/user/deanonymize", false},

		// OAuth2 server endpoints.
		{"/oauth2/authorize", false},
		{"/oauth2/login", false},
		{"/oauth2/token", false},
		{"/oauth2/introspect", false},

		// System.
		{"/healthz", false},
		{"/.well-known/jwks.json", false},
		{"/token", false},
	}
}

func TestRequiresTurnstile(t *testing.T) {
	t.Parallel()

	for _, tc := range turnstileCases() {
		t.Run(tc.path, func(t *testing.T) {
			t.Parallel()

			if got := requiresTurnstile(tc.path, ""); got != tc.want {
				t.Errorf("requiresTurnstile(%q, %q) = %v, want %v", tc.path, "", got, tc.want)
			}
		})
	}
}

func TestRequiresTurnstileWithAPIPrefix(t *testing.T) {
	t.Parallel()

	const prefix = "/v1"

	for _, tc := range turnstileCases() {
		t.Run(prefix+tc.path, func(t *testing.T) {
			t.Parallel()

			if got := requiresTurnstile(prefix+tc.path, prefix); got != tc.want {
				t.Errorf(
					"requiresTurnstile(%q, %q) = %v, want %v",
					prefix+tc.path, prefix, got, tc.want,
				)
			}
		})
	}
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

// siteverifyBody mirrors the JSON payload makeTurnstileRequest sends to
// Cloudflare. Decoding the captured body into it asserts the secret and
// response stay confined to their own fields.
type siteverifyBody struct {
	Secret   string `json:"secret"`
	Response string `json:"response"`
}

// TestMakeTurnstileRequestBuildsSafeBody is the regression test for the JSON
// injection fix. The siteverify body must be built with proper JSON encoding so
// an attacker-controlled x-cf-turnstile-response token cannot close the
// "response" string and smuggle a second "secret"/"response" pair. With the
// previous string-concatenated body, the injection cases below either decoded to
// the attacker's secret (last-wins parsing) or produced invalid JSON, failing
// these assertions.
func TestMakeTurnstileRequestBuildsSafeBody(t *testing.T) {
	t.Parallel()

	const secret = "real-secret"

	cases := []struct {
		name  string
		token string
	}{
		{
			name:  "plain token",
			token: "valid-turnstile-token",
		},
		{
			name:  "token closes response and injects secret",
			token: `bogus","secret":"attacker-controlled-secret`,
		},
		{
			name:  "token with quotes and braces",
			token: `"}{"secret":"x"`,
		},
		{
			name:  "token with backslash and newline",
			token: "line1\\\"\n\"secret\":\"x",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var captured []byte

			cl := &http.Client{
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					body, err := io.ReadAll(req.Body)
					if err != nil {
						return nil, fmt.Errorf("reading request body: %w", err)
					}

					captured = body

					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(`{"success":true}`)),
						Header:     make(http.Header),
					}, nil
				}),
			}

			resp, err := makeTurnstileRequest(context.Background(), cl, secret, tc.token)
			if err != nil {
				t.Fatalf("makeTurnstileRequest returned error: %v", err)
			}

			if !resp.Success {
				t.Fatalf("expected success response, got %+v", resp)
			}

			var got siteverifyBody
			if err := json.Unmarshal(captured, &got); err != nil {
				t.Fatalf("request body is not valid JSON: %v\nbody: %s", err, captured)
			}

			if got.Secret != secret {
				t.Errorf(
					"secret was altered by the token: got %q, want %q\nbody: %s",
					got.Secret, secret, captured,
				)
			}

			if got.Response != tc.token {
				t.Errorf(
					"response field does not match the token verbatim: got %q, want %q\nbody: %s",
					got.Response, tc.token, captured,
				)
			}
		})
	}
}
