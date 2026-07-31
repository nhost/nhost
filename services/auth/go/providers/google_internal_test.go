package providers

import (
	"errors"
	"net/url"
	"testing"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

// googleTestSub is a realistically shaped Google subject: the same value the
// legacy oauth2/v2/userinfo endpoint returned as `id`.
const googleTestSub = "110169484474386276334"

// TestGoogleDiscoveryDocument pins the document inlined in presets.go against
// what the service needs from it. TestPresetDocuments covers the invariants
// every preset shares; this covers the exact values for google.
func TestGoogleDiscoveryDocument(t *testing.T) {
	t.Parallel()

	doc, err := oidc.NewStaticDiscoverer(googleDiscovery()).Get(t.Context())
	if err != nil {
		t.Fatalf("pinned google discovery document is invalid: %v", err)
	}

	expected := oidc.DiscoveryDocument{
		Issuer:                "https://accounts.google.com",
		AuthorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
		TokenEndpoint:         "https://oauth2.googleapis.com/token",
		UserinfoEndpoint:      "https://openidconnect.googleapis.com/v1/userinfo",
		JWKSURI:               "https://www.googleapis.com/oauth2/v3/certs",
	}

	if *doc != expected {
		t.Errorf("pinned document drifted:\ngot:  %+v\nwant: %+v", *doc, expected)
	}

	// The native /signin/idtoken flow validates Google id_tokens through
	// oidc.Google. Both flows must anchor on the same issuer and keys.
	if doc.Issuer != oidc.GoogleIssuer || doc.JWKSURI != oidc.GoogleJWKSURI {
		t.Error("preset and native flow disagree on google's issuer or JWKS URI")
	}
}

// TestGoogleAuthCodeURL exercises the real preset — pinned document included —
// since building the authorization URL needs no network.
func TestGoogleAuthCodeURL(t *testing.T) {
	t.Parallel()

	provider := NewGoogleProvider(
		t.Context(),
		presetTestClientID,
		"client-secret",
		"https://local.auth.nhost.run",
		DefaultGoogleScopes,
	)

	raw, err := provider.Oauth2().AuthCodeURL(
		t.Context(), "state-value", nil,
		oauth2.SetAuthURLParam("nonce", oidc.HashNonce(presetTestRawNonce)),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("failed to parse authorize URL: %v", err)
	}

	if got.Scheme+"://"+got.Host+got.Path != "https://accounts.google.com/o/oauth2/v2/auth" {
		t.Errorf("unexpected authorization endpoint: %q", raw)
	}

	q := got.Query()

	for _, tc := range []struct{ param, want string }{
		{"client_id", presetTestClientID},
		{"state", "state-value"},
		{"redirect_uri", "https://local.auth.nhost.run/signin/provider/google/callback"},
		{"nonce", oidc.HashNonce(presetTestRawNonce)},
		{"scope", "openid email profile"},
		{"response_type", "code"},
	} {
		if q.Get(tc.param) != tc.want {
			t.Errorf("%s: got %q, want %q", tc.param, q.Get(tc.param), tc.want)
		}
	}
}

// TestGoogleProviderUsesNonce pins that the built-in google provider
// round-trips a nonce, which is what makes the controller add one to the
// authorization request.
func TestGoogleProviderUsesNonce(t *testing.T) {
	t.Parallel()

	provider := NewGoogleProvider(
		t.Context(), presetTestClientID, "client-secret",
		"https://local.auth.nhost.run", DefaultGoogleScopes,
	)

	np, ok := provider.Oauth2().(NonceProvider)
	if !ok || !np.UsesNonce() {
		t.Error("the google preset must round-trip an OIDC nonce")
	}
}

// TestGooglePresetProfile pins how the preset derives an oidc.Profile from a
// google id_token: the standard-claim extraction, the one semantics change
// carried over from the hand-written adapter (an absent email_verified claim
// was Unverified there, Unknown here), and that both google flows read identity
// from the same claim.
//
// It does not check that the id_token sub equals the legacy oauth2/v2/userinfo
// `id` — that is an external fact about Google, and the fixture mints the sub it
// then asserts. See googleTestSub.
func TestGooglePresetProfile(t *testing.T) {
	t.Parallel()

	// The Unverified -> Unknown move is safe only while both answer false to
	// IsVerified(). Asserted on the statuses themselves: comparing two
	// expectations that already agree never exercises it.
	if oidc.EmailVerificationStatusUnknown.IsVerified() ||
		oidc.EmailVerificationStatusUnverified.IsVerified() {
		t.Fatal("an unverified email must never read as verified")
	}

	cases := []struct {
		name     string
		override map[string]any
		expected oidc.Profile
	}{
		{
			name:     "verified email",
			override: nil,
			expected: oidc.Profile{
				ProviderUserID: googleTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusVerified,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
		{
			name:     "unverified email must not be marked verified",
			override: map[string]any{"email_verified": false},
			expected: oidc.Profile{
				ProviderUserID: googleTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnverified,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
		{
			// The adapter read the legacy `verified_email` field into a plain
			// bool, so an absent claim landed on Unverified. The engine reports
			// Unknown instead. Both answer false to IsVerified(), which is what
			// every caller asks, so no linking or verification decision moves.
			name:     "absent email_verified is not verified",
			override: map[string]any{"email_verified": nil},
			expected: oidc.Profile{
				ProviderUserID: googleTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnknown,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newPresetTestIDP(t)

			claims := idp.claims(googleTestSub)
			for k, v := range tc.override {
				if v == nil {
					delete(claims, k)
					continue
				}

				claims[k] = v
			}

			idToken := idp.mint(t, claims)

			profile, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken,
				map[string]any{"nonce": presetTestRawNonce},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if profile != tc.expected {
				t.Errorf("profile:\ngot:  %+v\nwant: %+v", profile, tc.expected)
			}

			// The native flow over the same token, identity only: both write
			// into the same auth.user_providers (provider_id, provider_user_id)
			// pair, so a flow that derived its subject from another claim would
			// strand every existing google user.
			native, err := (&oidc.Google{}).GetProfile(idp.parse(t, idToken))
			if err != nil {
				t.Fatalf("native flow: unexpected error: %v", err)
			}

			if profile.ProviderUserID != native.ProviderUserID {
				t.Errorf("the two google flows disagree on identity: %q vs %q",
					profile.ProviderUserID, native.ProviderUserID)
			}
		})
	}
}

// TestGooglePresetUserinfoFallback covers the one case that still reaches the
// userinfo endpoint: an id_token without an email claim.
func TestGooglePresetUserinfoFallback(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		userinfoSub   string
		expectedEmail string
		expectedErr   error
	}{
		{
			name:          "fills the missing email",
			userinfoSub:   googleTestSub,
			expectedEmail: "jane@example.com",
			expectedErr:   nil,
		},
		{
			// A userinfo response describing a different subject is no
			// evidence about this user: merging its email would hand this
			// identity a verified claim on somebody else's address.
			name:          "rejects a mismatched subject",
			userinfoSub:   "some-other-subject",
			expectedEmail: "",
			expectedErr:   ErrUserinfoSubjectMismatch,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newPresetTestIDP(t)
			idp.userinfo = map[string]any{
				"sub":            tc.userinfoSub,
				"email":          "jane@example.com",
				"email_verified": true,
			}

			claims := idp.claims(googleTestSub)
			delete(claims, "email")
			delete(claims, "email_verified")

			idToken := idp.mint(t, claims)

			profile, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken,
				map[string]any{"nonce": presetTestRawNonce},
			)

			if tc.expectedErr != nil {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("expected %v, got: %v", tc.expectedErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if profile.Email != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", profile.Email, tc.expectedEmail)
			}

			if !profile.EmailVerified.IsVerified() {
				t.Error("email_verified from userinfo was not carried over")
			}

			if profile.ProviderUserID != googleTestSub {
				t.Errorf("identity moved: got %q", profile.ProviderUserID)
			}
		})
	}
}

// TestGooglePresetNonceRejections pins that the browser flow's replay
// protection is enforced, not merely requested.
func TestGooglePresetNonceRejections(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		tokenNonce  any
		extra       map[string]any
		expectedErr error
	}{
		{
			name:        "no nonce in the state",
			tokenNonce:  oidc.HashNonce(presetTestRawNonce),
			extra:       map[string]any{},
			expectedErr: ErrMissingNonce,
		},
		{
			name:        "id_token echoes a different nonce",
			tokenNonce:  oidc.HashNonce("someone-elses-nonce"),
			extra:       map[string]any{"nonce": presetTestRawNonce},
			expectedErr: oidc.ErrNonceMismatch,
		},
		{
			name:        "id_token carries no nonce claim",
			tokenNonce:  nil,
			extra:       map[string]any{"nonce": presetTestRawNonce},
			expectedErr: oidc.ErrNonceMissing,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newPresetTestIDP(t)

			claims := idp.claims(googleTestSub)
			if tc.tokenNonce == nil {
				delete(claims, "nonce")
			} else {
				claims["nonce"] = tc.tokenNonce
			}

			idToken := idp.mint(t, claims)

			_, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken, tc.extra,
			)

			// The exact sentinel, not merely "some error": this fixture reaches
			// its own JWKS over TLS, so err != nil would also be satisfied by a
			// broken fixture, a bad exp or a wrong aud.
			if !errors.Is(err, tc.expectedErr) {
				t.Fatalf("expected %v, got: %v", tc.expectedErr, err)
			}
		})
	}
}
