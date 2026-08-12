package providers

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

const googleTestSub = "110169484474386276334"

// presetCase describes one built-in preset. A preset is pure configuration, so
// one row here is the whole per-provider cost of adding one; the engine
// behaviour they all share is tested over newOIDCProvider in
// custom_internal_test.go.
type presetCase struct {
	id string

	build func(
		ctx context.Context,
		clientID, clientSecret, authServerURL string,
		scopes []string,
	) *Provider

	// doc is spelled out as literals rather than read from the constants
	// presets.go uses: that second copy is what turns an edit there into a
	// deliberate edit here.
	doc oidc.DiscoveryDocument

	// wantScope is what scopes must serialise to, order included — that string
	// is what reaches the IdP.
	scopes    []string
	wantScope string
}

func presetCases() []presetCase {
	return []presetCase{
		{
			id:    GoogleID,
			build: NewGoogleProvider,
			doc: oidc.DiscoveryDocument{
				Issuer:                "https://accounts.google.com",
				AuthorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
				TokenEndpoint:         "https://oauth2.googleapis.com/token",
				UserinfoEndpoint:      "https://openidconnect.googleapis.com/v1/userinfo",
				JWKSURI:               "https://www.googleapis.com/oauth2/v3/certs",
			},
			scopes:    DefaultGoogleScopes,
			wantScope: "openid email profile",
		},
	}
}

// TestPresetDocuments pins every preset's discovery document and the invariants
// they all share. The count check catches a preset added to presetCases or
// oidcPresetDocuments but not the other.
func TestPresetDocuments(t *testing.T) {
	t.Parallel()

	pinned := oidcPresetDocuments()
	cases := presetCases()

	if len(pinned) != len(cases) {
		t.Errorf("presetCases and oidcPresetDocuments disagree: %d rows vs %d presets",
			len(cases), len(pinned))
	}

	for _, tc := range cases {
		t.Run(tc.id, func(t *testing.T) {
			t.Parallel()

			doc, ok := pinned[tc.id]
			if !ok {
				t.Fatalf("preset %q is missing from oidcPresetDocuments", tc.id)
			}

			if doc != tc.doc {
				t.Errorf("pinned document drifted:\ngot:  %+v\nwant: %+v", doc, tc.doc)
			}

			// The same validation a fetched document goes through.
			if _, err := oidc.NewStaticDiscoverer(doc).Get(t.Context()); err != nil {
				t.Fatalf("pinned document is invalid: %v", err)
			}

			issuer, err := url.Parse(doc.Issuer)
			if err != nil || issuer.Host == "" || issuer.Scheme != "https" {
				t.Errorf("issuer must be an absolute https URL, got %q", doc.Issuer)
			}

			// An ID that looked custom would be misread by isCustomProviderID,
			// silently changing who its users can auto-link with.
			if strings.HasPrefix(tc.id, CustomProviderPrefix) {
				t.Errorf("preset ID %q must not use the custom provider prefix", tc.id)
			}

			// The browser flow falls back to userinfo when an id_token carries
			// no email, so a preset without one cannot recover.
			if doc.UserinfoEndpoint == "" {
				t.Error("preset document must advertise a userinfo endpoint")
			}
		})
	}
}

// TestPresetAuthCodeURL exercises the real presets, pinned documents included,
// since building an authorization URL needs no network.
func TestPresetAuthCodeURL(t *testing.T) {
	t.Parallel()

	for _, tc := range presetCases() {
		t.Run(tc.id, func(t *testing.T) {
			t.Parallel()

			provider := tc.build(
				t.Context(),
				oidcTestClientID,
				"client-secret",
				"https://local.auth.nhost.run",
				tc.scopes,
			)

			raw, err := provider.Oauth2().AuthCodeURL(
				t.Context(), "state-value", nil,
				oauth2.SetAuthURLParam("nonce", oidc.HashNonce(oidcTestRawNonce)),
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			got, err := url.Parse(raw)
			if err != nil {
				t.Fatalf("failed to parse authorize URL: %v", err)
			}

			endpoint := got.Scheme + "://" + got.Host + got.Path
			if endpoint != tc.doc.AuthorizationEndpoint {
				t.Errorf("authorization endpoint: got %q, want %q",
					endpoint, tc.doc.AuthorizationEndpoint)
			}

			q := got.Query()

			for _, param := range []struct{ name, want string }{
				{"client_id", oidcTestClientID},
				{"state", "state-value"},
				{"redirect_uri", "https://local.auth.nhost.run/signin/provider/" + tc.id + "/callback"},
				{"nonce", oidc.HashNonce(oidcTestRawNonce)},
				{"scope", tc.wantScope},
				{"response_type", "code"},
			} {
				if q.Get(param.name) != param.want {
					t.Errorf("%s: got %q, want %q", param.name, q.Get(param.name), param.want)
				}
			}
		})
	}
}

// TestPresetUsesNonce guards the replay protection: a preset that silently
// stopped round-tripping the nonce would lose it with no other signal.
func TestPresetUsesNonce(t *testing.T) {
	t.Parallel()

	for _, tc := range presetCases() {
		t.Run(tc.id, func(t *testing.T) {
			t.Parallel()

			provider := tc.build(
				t.Context(),
				oidcTestClientID,
				"client-secret",
				"https://local.auth.nhost.run",
				tc.scopes,
			)

			np, ok := provider.Oauth2().(NonceProvider)
			if !ok || !np.UsesNonce() {
				t.Errorf("the %s preset must round-trip an OIDC nonce", tc.id)
			}
		})
	}
}

// TestGoogleSharesIdentityWithNativeFlow covers the one invariant that is
// google's rather than the engine's: google is the only preset that also serves
// POST /signin/idtoken, and both flows write the same auth.user_providers
// (provider_id, provider_user_id) pair. A divergence in subject, issuer or key
// set would strand every existing google user.
func TestGoogleSharesIdentityWithNativeFlow(t *testing.T) {
	t.Parallel()

	doc := googleDiscovery()
	if doc.Issuer != oidc.GoogleIssuer || doc.JWKSURI != oidc.GoogleJWKSURI {
		t.Error("preset and native flow disagree on google's issuer or JWKS URI")
	}

	idp := newOIDCTestIDP(t)
	idToken := idp.mint(t, idp.claims(googleTestSub))

	profile, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
		t.Context(), "access-token", &idToken,
		map[string]any{"nonce": oidcTestRawNonce},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	native, err := (&oidc.Google{}).GetProfile(idp.parse(t, idToken))
	if err != nil {
		t.Fatalf("native flow: unexpected error: %v", err)
	}

	if profile.ProviderUserID != native.ProviderUserID {
		t.Errorf("the two google flows disagree on identity: %q vs %q",
			profile.ProviderUserID, native.ProviderUserID)
	}
}
