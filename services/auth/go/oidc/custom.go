package oidc

import (
	"context"
	"fmt"
	"net/http"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// asymmetricAlgs is the fixed signing-algorithm allowlist for custom OIDC
// providers, deliberately independent of what discovery advertises:
// symmetric algorithms and "none" must never validate an id_token issued by
// a third-party IdP.
func asymmetricAlgs() []string {
	return []string{
		"RS256", "RS384", "RS512",
		"ES256", "ES384", "ES512",
		"PS256", "PS384", "PS512",
	}
}

// CustomProvider implements Provider for an operator-configured OIDC
// provider: the issuer comes from configuration and endpoints/JWKS come from
// the (lazily fetched) discovery document.
type CustomProvider struct {
	issuer string
	disco  *Discoverer
	client *http.Client

	// appCtx bounds the lifetime of the background JWKS-refresh goroutine
	// started by buildKeyFunc. Building the keyfunc on a request context
	// would stop the refresh as soon as that request finished.
	appCtx context.Context //nolint:containedctx

	// keys memoizes the keyfunc, so the two validators built over one
	// provider (browser callback and native /signin/idtoken) share a single
	// JWKS cache, refresh goroutine and unknown-kid limiter, and a retry
	// after the negative-cache window reuses a healthy keyfunc instead of
	// constructing another one.
	keys *lazyMemo[jwt.Keyfunc]
}

// NewCustomProvider builds a CustomProvider. client must be an SSRF-hardened
// client (safehttp.New) because the JWKS URI is attacker-influenceable via
// the discovery document.
//
// The one exemption is a disco from NewStaticDiscoverer, which makes the JWKS
// URI a compile-time constant and so leaves no attacker-influenceable address
// to decide about; the built-in presets use it to keep proxy support (see
// providers.presetHTTPClient). Any fetching disco requires the hardened client.
func NewCustomProvider(
	appCtx context.Context, issuer string, disco *Discoverer, client *http.Client,
) *CustomProvider {
	p := &CustomProvider{
		issuer: issuer,
		disco:  disco,
		client: client,
		appCtx: appCtx,
		keys:   nil,
	}
	p.keys = newLazyMemo(p.buildKeyFunc)

	return p
}

func (p *CustomProvider) GetIssuer() string {
	return p.issuer
}

func (p *CustomProvider) GetValidMethods() []string {
	return asymmetricAlgs()
}

// GetJWTKeyFunc returns the provider's JWKS-backed keyfunc, built on first
// use and memoized for the process lifetime (failures negative-cached with
// backoff).
func (p *CustomProvider) GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error) {
	return p.keys.get(ctx)
}

// buildKeyFunc resolves the JWKS URI via discovery and builds a keyfunc
// backed by it.
//
// keyfunc starts its background refresh goroutine before its first fetch and
// exposes no Close, so cancelling the context it was built on is the only way
// to stop it — and an abandoned refresher keeps polling a third-party URL
// hourly for the life of the process. Hence the cancellable child of
// p.appCtx: every failure path cancels it, and only a keyfunc that is
// actually returned keeps its refresher, bounded by p.appCtx.
func (p *CustomProvider) buildKeyFunc(ctx context.Context) (jwt.Keyfunc, error) {
	doc, err := p.disco.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("discovering JWKS URI: %w", err)
	}

	// p.appCtx, not ctx: the refresh goroutine must outlive this request.
	keysCtx, cancel := context.WithCancel(p.appCtx)

	handedOver := false

	defer func() {
		if !handedOver {
			cancel()
		}
	}()

	k, err := keyfunc.NewDefaultOverrideCtx( //nolint:contextcheck
		keysCtx,
		[]string{doc.JWKSURI},
		keyfunc.Override{Client: p.client}, //nolint:exhaustruct
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create a jwkSet from the server's URL: %w", err)
	}

	// keyfunc sets NoErrorReturnFirstHTTPReq, so an unreachable, failing or
	// malformed JWKS still yields a nil error and an empty key set. Without
	// this check the caller memoizes a keyless validator as a success and
	// the negative-cache backoff never applies to the JWKS half of the
	// build; an id_token with no kid would then fail for up to a full
	// refresh interval.
	keys, err := k.VerificationKeySet(ctx)
	if err != nil || len(keys.Keys) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrJWKSEmpty, doc.JWKSURI)
	}

	handedOver = true

	return k.Keyfunc, nil
}

// GetProfile requires the email claim: this is the native id_token path,
// where the caller supplies only a token, so there is no access token to fall
// back to the userinfo endpoint with. The browser flow tolerates a missing
// email (oidc.WithOptionalEmail) precisely because it can.
func (p *CustomProvider) GetProfile(token *jwt.Token) (Profile, error) {
	return ProfileFromToken(token)
}
