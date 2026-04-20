package ratelimit //nolint:testpackage

import (
	"slices"
	"testing"
)

type bucket string

const (
	bucketEmailNoVerify   bucket = "email-no-verify"
	bucketEmailWithVerify bucket = "email-with-verify"
	bucketSMS             bucket = "sms"
	bucketBruteForce      bucket = "brute-force"
	bucketSignup          bucket = "signup"
	bucketOAuth2Server    bucket = "oauth2-server"
)

// classifierCases lists every path the rate-limit middleware is expected to
// see and the buckets it belongs to. When a new endpoint is added to the
// OpenAPI spec, add a row here so we can't silently forget to classify it.
func classifierCases() []struct {
	path    string
	buckets []bucket
} {
	return []struct {
		path    string
		buckets []bucket
	}{
		// Signin endpoints that send magic links / OTPs via email.
		{
			path: "/signin/passwordless/email",
			buckets: []bucket{
				bucketEmailNoVerify,
				bucketEmailWithVerify,
				bucketBruteForce,
			},
		},
		{
			path: "/signin/otp/email",
			buckets: []bucket{
				bucketEmailNoVerify,
				bucketEmailWithVerify,
				bucketBruteForce,
			},
		},
		{path: "/signin/otp/email/verify", buckets: []bucket{bucketBruteForce}},

		// Signin SMS endpoints.
		{
			path:    "/signin/passwordless/sms",
			buckets: []bucket{bucketSMS, bucketBruteForce},
		},
		{path: "/signin/passwordless/sms/otp", buckets: []bucket{bucketBruteForce}},

		// Other signin endpoints: brute-force bucket only.
		{path: "/signin/email-password", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/idtoken", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/pat", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/webauthn", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/webauthn/verify", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/mfa/totp", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/anonymous", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/provider/google", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/provider/google/callback", buckets: []bucket{bucketBruteForce}},
		{path: "/signin/provider/google/callback/tokens", buckets: []bucket{bucketBruteForce}},

		// Signup endpoints.
		{
			path: "/signup/passwordless/email",
			buckets: []bucket{
				bucketEmailNoVerify,
				bucketEmailWithVerify,
				bucketSignup,
			},
		},
		{
			path: "/signup/otp/email",
			buckets: []bucket{
				bucketEmailNoVerify,
				bucketEmailWithVerify,
				bucketSignup,
			},
		},
		{
			path:    "/signup/passwordless/sms",
			buckets: []bucket{bucketSMS, bucketSignup},
		},
		{path: "/signup/idtoken", buckets: []bucket{bucketSignup}},
		{path: "/signup/provider/google", buckets: []bucket{bucketSignup}},
		{
			path:    "/signup/email-password",
			buckets: []bucket{bucketEmailWithVerify, bucketSignup},
		},
		{path: "/signup/webauthn", buckets: []bucket{bucketSignup}},
		{
			path:    "/signup/webauthn/verify",
			buckets: []bucket{bucketBruteForce, bucketSignup},
		},

		// User endpoints that send emails.
		{
			path:    "/user/email/change",
			buckets: []bucket{bucketEmailNoVerify, bucketEmailWithVerify},
		},
		{
			path:    "/user/email/send-verification-email",
			buckets: []bucket{bucketEmailWithVerify},
		},
		{
			path:    "/user/password/reset",
			buckets: []bucket{bucketEmailNoVerify, bucketEmailWithVerify},
		},
		{
			path:    "/user/deanonymize",
			buckets: []bucket{bucketEmailWithVerify},
		},

		// OAuth2 brute-force paths.
		{path: "/oauth2/authorize", buckets: []bucket{bucketBruteForce}},
		{path: "/oauth2/login", buckets: []bucket{bucketBruteForce}},

		// OAuth2 server-to-server.
		{path: "/oauth2/token", buckets: []bucket{bucketOAuth2Server}},
		{path: "/oauth2/introspect", buckets: []bucket{bucketOAuth2Server}},

		// Unrelated endpoints end up in no bucket (just the global one).
		{path: "/healthz", buckets: nil},
		{path: "/.well-known/jwks.json", buckets: nil},
		{path: "/token", buckets: nil},
	}
}

func TestClassifiers(t *testing.T) {
	t.Parallel()

	for _, tc := range classifierCases() {
		t.Run(tc.path, func(t *testing.T) {
			t.Parallel()

			check := func(name string, got bool, want bucket) {
				t.Helper()

				if wantHas := slices.Contains(tc.buckets, want); got != wantHas {
					t.Errorf("%s(%q) = %v, want %v", name, tc.path, got, wantHas)
				}
			}

			check("sendsEmail(verifyEmailEnabled=false)",
				sendsEmail(tc.path, false), bucketEmailNoVerify)
			check("sendsEmail(verifyEmailEnabled=true)",
				sendsEmail(tc.path, true), bucketEmailWithVerify)
			check("sendsSMS", sendsSMS(tc.path), bucketSMS)
			check("bruteForceProtected", bruteForceProtected(tc.path), bucketBruteForce)
			check("isSignup", isSignup(tc.path), bucketSignup)
			check("isOAuth2Server", isOAuth2Server(tc.path), bucketOAuth2Server)
		})
	}
}
