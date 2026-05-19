package middleware //nolint:testpackage

import "testing"

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
