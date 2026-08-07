package providers

import (
	"context"
	"net/http"

	"github.com/nhost/nhost/services/auth/go/oidc"
)

// This file holds the built-in providers that are pure configuration: an OIDC
// discovery document pinned in code, run on the same engine as the
// operator-configured custom providers. A preset that grows behaviour (an
// authorization-request parameter, a non-standard subject claim, a templated
// issuer) has stopped being data and should leave this file for one of its own.

// presetHTTPClient returns the client the built-in OIDC presets use for their
// outbound calls (token exchange, JWKS, userinfo).
//
// Deliberately not safehttp.New: that client ignores HTTP(S)_PROXY on purpose,
// so an egress-proxied self-hoster would find exactly the migrated provider
// broken — and a preset only talks to hosts pinned here at compile time, so it
// gains nothing from the denylist.
//
// It also gives up safehttp's body, header and redirect caps and TLS floor. Of
// the three calls, only the JWKS read is otherwise uncapped (keyfunc reads it
// through this client); acceptable only because the host is a compile-time
// constant over verified TLS. A less pinned preset needs a different client.
func presetHTTPClient() *http.Client {
	return &http.Client{ //nolint:exhaustruct
		Timeout: fetchProfileTimeout,
	}
}

// newOIDCPresetProvider builds a built-in provider on the OIDC engine from a
// discovery document pinned in code. It derives the redirect URI rather than
// taking one: that value has to match what the IdP has registered.
//
// The oidc.CustomProvider anchor is discarded, against newOIDCProvider's
// "build further validators over the anchor" rule: google does serve the native
// POST /signin/idtoken flow, but that flow builds its own validator over
// oidc.Google at startup, before getOauth2Providers runs. Two consequences,
// both follow-up work: with AUTH_PROVIDER_GOOGLE_AUDIENCE set two keyfunc
// refreshers poll the same JWKS URI, and the browser callback accepts all nine
// asymmetric algs where /signin/idtoken pins RS256 (not exploitable — Google
// publishes only RS256 keys — but a widening).
func newOIDCPresetProvider(
	appCtx context.Context,
	id string,
	doc oidc.DiscoveryDocument,
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	provider, _ := newOIDCProvider(
		appCtx, presetHTTPClient(), oidc.NewStaticDiscoverer(doc), doc.Issuer,
		oidcParams{
			ID:           id,
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURI(authServerURL, id),
			Scopes:       scopes, // newOIDCProvider guarantees the openid scope.
		},
	)

	return provider
}

// oidcPresetDocuments lists every pinned document. Add a row when you add a
// preset, and a matching row to presetCases in the tests: TestPresetDocuments
// cross-checks the two, so a preset missing from either fails rather than
// shipping unasserted.
//
// It is deliberately not the lookup path — each constructor names its own
// document, so a typo there is a compile error rather than a nil map read on
// the first sign-in.
func oidcPresetDocuments() map[string]oidc.DiscoveryDocument {
	return map[string]oidc.DiscoveryDocument{
		GoogleID: googleDiscovery(),
	}
}

// googleDiscovery pins the subset of
// https://accounts.google.com/.well-known/openid-configuration this service
// uses. Issuer and JWKS URI come from oidc, which already validates Google
// id_tokens on the native POST /signin/idtoken flow, so both flows read one
// copy of each.
func googleDiscovery() oidc.DiscoveryDocument {
	return oidc.DiscoveryDocument{
		Issuer:                oidc.GoogleIssuer,
		AuthorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
		TokenEndpoint:         "https://oauth2.googleapis.com/token",
		UserinfoEndpoint:      "https://openidconnect.googleapis.com/v1/userinfo",
		JWKSURI:               oidc.GoogleJWKSURI,
	}
}

// NewGoogleProvider builds the built-in google provider on the OIDC engine.
// ctx bounds the background JWKS-refresh goroutine, as it does for apple.
//
// Identity comes from the id_token sub — the same value the native
// POST /signin/idtoken flow has always recorded under this provider ID, and the
// same value the legacy oauth2/v2/userinfo endpoint returned as `id`. Userinfo
// is now only a fallback for an id_token without an email, and only when its
// sub matches.
//
// One-off upgrade cost: the nonce is minted on authorize and enforced on the
// callback, so a sign-in spanning the upgrade is refused once
// (ErrOauthProfileFetchFailed) and succeeds on retry. Bounded by the state
// JWT's 60s TTL, single-instance restarts included; the reverse direction is
// unaffected.
func NewGoogleProvider(
	ctx context.Context,
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	return newOIDCPresetProvider(
		ctx, GoogleID, googleDiscovery(), clientID, clientSecret, authServerURL, scopes,
	)
}
