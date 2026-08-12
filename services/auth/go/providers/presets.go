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

// noncePolicy is a preset's nonce posture — the operator's disableNonce, decided
// in code because a preset's IdP is pinned here.
type noncePolicy bool

const (
	nonceRoundTrip noncePolicy = false
	// nonceUnsupported sends no nonce and checks none, for an IdP that returns
	// no claim. See NewLinkedInProvider.
	nonceUnsupported noncePolicy = true
)

// newOIDCPresetProvider builds a built-in provider on the OIDC engine from a
// discovery document pinned in code. It derives the redirect URI rather than
// taking one: that value has to match what the IdP has registered.
//
// The oidc.CustomProvider anchor is discarded, against newOIDCProvider's "build
// further validators over the anchor" rule: no preset needs a second validator,
// and google's — the only one serving POST /signin/idtoken — is built over
// oidc.Google at startup. Two known consequences, both follow-up work: two
// keyfunc refreshers poll google's JWKS when AUTH_PROVIDER_GOOGLE_AUDIENCE is
// set, and the browser callback accepts all nine asymmetric algs where
// /signin/idtoken pins RS256.
//
// One-off upgrade cost, nonceRoundTrip presets only: a sign-in spanning the
// upgrade is refused once and succeeds on retry, bounded by the state JWT's 60s
// TTL.
func newOIDCPresetProvider(
	appCtx context.Context,
	id string,
	doc oidc.DiscoveryDocument,
	clientID, clientSecret, authServerURL string,
	scopes []string,
	nonce noncePolicy,
) *Provider {
	provider, _ := newOIDCProvider(
		appCtx, presetHTTPClient(), oidc.NewStaticDiscoverer(doc), doc.Issuer,
		oidcParams{
			ID:            id,
			ClientID:      clientID,
			ClientSecret:  clientSecret,
			RedirectURL:   redirectURI(authServerURL, id),
			Scopes:        scopes, // newOIDCProvider guarantees the openid scope.
			NonceDisabled: bool(nonce),
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
		GoogleID:   googleDiscovery(),
		LinkedinID: linkedinDiscovery(),
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
// sub matches. See newOIDCPresetProvider for the one-off upgrade cost every
// migrated provider pays.
func NewGoogleProvider(
	ctx context.Context,
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	return newOIDCPresetProvider(
		ctx, GoogleID, googleDiscovery(), clientID, clientSecret, authServerURL, scopes,
		nonceRoundTrip,
	)
}

// linkedinDiscovery pins
// https://www.linkedin.com/oauth/.well-known/openid-configuration.
//
// The issuer carries the /oauth suffix, which is load-bearing: jwt.WithIssuer
// matches the id_token's iss exactly, and LinkedIn's own documentation still
// prints the bare host. The live document is the source of truth;
// TestPresetDocuments is what catches the next move.
func linkedinDiscovery() oidc.DiscoveryDocument {
	return oidc.DiscoveryDocument{
		Issuer:                "https://www.linkedin.com/oauth",
		AuthorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
		TokenEndpoint:         "https://www.linkedin.com/oauth/v2/accessToken",
		UserinfoEndpoint:      "https://api.linkedin.com/v2/userinfo",
		JWKSURI:               "https://www.linkedin.com/oauth/openid/jwks",
	}
}

// NewLinkedInProvider builds the built-in linkedin provider on the OIDC engine.
//
// Identity moves from userinfo's sub to the id_token's, which OIDC Core §5.3.2
// requires to be the same value; LinkedIn's subject is pairwise per client, so a
// fixed client ID keeps existing auth.user_providers rows addressable.
//
// nonceUnsupported because LinkedIn ignores the parameter and returns no claim:
// requiring it refuses every sign-in, as auth@0.52.0-beta2 did. It gives up the
// defence against authorization-code injection, which the pre-migration provider
// did not have either.
func NewLinkedInProvider(
	ctx context.Context,
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	return newOIDCPresetProvider(
		ctx, LinkedinID, linkedinDiscovery(), clientID, clientSecret, authServerURL, scopes,
		nonceUnsupported,
	)
}
