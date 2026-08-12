package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

var (
	// ErrMissingIDToken is returned when an OIDC-type custom provider's token
	// response carries no id_token.
	ErrMissingIDToken = errors.New("missing id_token")
	// ErrMissingNonce is returned when the browser flow reaches an OIDC-type
	// custom provider that has not disabled the nonce and the state carries
	// none.
	ErrMissingNonce = errors.New("missing nonce")
	// ErrProfileMissingID is returned when the userinfo response of an
	// OAuth2-type custom provider lacks the configured id field.
	ErrProfileMissingID = errors.New("userinfo response is missing the id field")
	// ErrUserinfoSubjectMismatch is returned when an OIDC-type custom
	// provider's userinfo response describes a different subject than the
	// validated id_token.
	ErrUserinfoSubjectMismatch = errors.New(
		"userinfo subject does not match id_token subject",
	)
)

// ClaimMapping renames the flat, top-level userinfo fields of an OAuth2-type
// custom provider to the profile fields the auth service needs. Empty fields
// fall back to the OIDC-standard claim names.
type ClaimMapping struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	EmailVerified string `json:"emailVerified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (m ClaimMapping) withDefaults() ClaimMapping {
	orElse := func(v, fallback string) string {
		if v == "" {
			return fallback
		}

		return v
	}

	return ClaimMapping{
		ID:            orElse(m.ID, "sub"),
		Email:         orElse(m.Email, "email"),
		EmailVerified: orElse(m.EmailVerified, "email_verified"),
		Name:          orElse(m.Name, "name"),
		Picture:       orElse(m.Picture, "picture"),
	}
}

// NonceProvider is implemented by Oauth2Provider adapters that round-trip an
// OIDC nonce through the browser flow: the authorization request carries
// HashNonce(raw) and GetProfile requires the id_token to echo it. It is a
// named optional interface rather than a method on Oauth2Provider so the
// built-in adapters, none of which use a nonce, stay untouched.
type NonceProvider interface {
	UsesNonce() bool
}

// The engine's runtime type is the one implementation; the assertion keeps
// the contract compile-checked despite the interface being optional.
var _ NonceProvider = (*customProvider)(nil)

// customProvider is the runtime for both custom provider types. In OIDC mode
// endpoints are resolved lazily from discovery and identity comes from the
// validated id_token; in OAuth2 mode endpoints are static and identity comes
// from the userinfo response via ClaimMapping.
type customProvider struct {
	id        string
	cfg       *oauth2.Config
	hc        *http.Client
	disco     *oidc.Discoverer           // OIDC mode only
	validator *oidc.LazyIDTokenValidator // OIDC mode only
	// resolvedCfg holds the OIDC-mode config once discovery has filled in its
	// endpoints. See endpointConfig for why it is stored rather than copied.
	resolvedCfg   atomic.Pointer[oauth2.Config]
	claims        ClaimMapping // OAuth2 mode only
	userinfoURL   string       // OAuth2 mode only; OIDC discovers it
	oidcMode      bool
	nonceDisabled bool // OIDC mode only; the operator's disableNonce opt-out
}

// endpointConfig returns the provider's oauth2.Config with endpoints
// resolved: the static config in OAuth2 mode, and in OIDC mode one config
// built from the discovery document on first use and shared thereafter.
//
// Sharing it matters beyond allocation: oauth2.Config carries an unexported
// authStyleCache recording which client-authentication style the token
// endpoint accepts. Handing out a fresh copy per request throws that cache
// away every time, so an IdP that wants client_secret_post would see a
// failed Basic-auth attempt — and a second presentation of the single-use
// authorization code — on every single sign-in. The discovery document is
// memoized for the process lifetime, so the resolved endpoints are constant
// and the stored config is never mutated after publication.
func (p *customProvider) endpointConfig(ctx context.Context) (*oauth2.Config, error) {
	if !p.oidcMode {
		return p.cfg, nil
	}

	if cfg := p.resolvedCfg.Load(); cfg != nil {
		return cfg, nil
	}

	doc, err := p.disco.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("resolving OIDC endpoints for %s: %w", p.id, err)
	}

	cfg := *p.cfg
	cfg.Endpoint = oauth2.Endpoint{ //nolint:exhaustruct
		AuthURL:  doc.AuthorizationEndpoint,
		TokenURL: doc.TokenEndpoint,
	}

	// A racing caller may have stored an equivalent config already; either
	// one is correct, so keep whichever landed first and let every later
	// request share it.
	if !p.resolvedCfg.CompareAndSwap(nil, &cfg) {
		return p.resolvedCfg.Load(), nil
	}

	return &cfg, nil
}

func (p *customProvider) AuthCodeURL(
	ctx context.Context,
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) (string, error) {
	cfg, err := p.endpointConfig(ctx)
	if err != nil {
		return "", err
	}

	return cfg.AuthCodeURL(state, opts...), nil
}

func (p *customProvider) Exchange(
	ctx context.Context, code string, opts ...oauth2.AuthCodeOption,
) (*oauth2.Token, error) {
	cfg, err := p.endpointConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Route the exchange through the hardened client: the token URL is
	// owner-supplied (or discovered).
	ctx = context.WithValue(ctx, oauth2.HTTPClient, p.hc)

	token, err := cfg.Exchange(ctx, code, opts...)
	if err != nil {
		return nil, fmt.Errorf("exchanging authorization code for %s: %w", p.id, err)
	}

	return token, nil
}

// UsesNonce reports whether the provider round-trips an OIDC nonce through
// the browser flow. Deliberately not part of the Oauth2Provider interface —
// the controller feature-detects NonceProvider so built-in providers stay
// untouched.
//
// Not an "is this an OIDC custom?" predicate: disableNonce makes it false for
// providers that are.
func (p *customProvider) UsesNonce() bool {
	return p.oidcMode && !p.nonceDisabled
}

func (p *customProvider) GetProfile(
	ctx context.Context,
	accessToken string,
	idToken *string,
	extra map[string]any,
) (oidc.Profile, error) {
	if p.oidcMode {
		return p.oidcProfile(ctx, accessToken, idToken, extra)
	}

	return p.oauth2Profile(ctx, accessToken)
}

func (p *customProvider) oidcProfile(
	ctx context.Context,
	accessToken string,
	idToken *string,
	extra map[string]any,
) (oidc.Profile, error) {
	// OIDC customs always request the openid scope, so a compliant IdP
	// always returns an id_token; treating its absence as an error keeps
	// identity anchored to a validated token, never to an unauthenticated
	// userinfo response.
	if idToken == nil || *idToken == "" {
		return oidc.Profile{}, fmt.Errorf("%w: %s", ErrMissingIDToken, p.id)
	}

	validator, err := p.validator.Get(ctx)
	if err != nil {
		return oidc.Profile{}, fmt.Errorf(
			"building id_token validator for %s: %w", p.id, err,
		)
	}

	var token *jwt.Token

	if p.nonceDisabled {
		// extra["nonce"] is deliberately not read. States carry no provider
		// identifier, so one minted at a strict provider still has a nonce —
		// and enforcing it would fail, since the IdP omits the claim or minted
		// its own. No request-binding survives this arm: no PKCE is sent either.
		token, err = validator.ValidateIgnoringNonce(*idToken)
	} else {
		// Keep this guard: states are interchangeable across providers, so a
		// nonce-less state accepted here would be a universal downgrade token.
		nonce, _ := extra["nonce"].(string)
		if nonce == "" {
			return oidc.Profile{}, fmt.Errorf("%w: %s", ErrMissingNonce, p.id)
		}

		token, err = validator.ValidateWithRequiredNonce(*idToken, nonce)
	}

	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to validate id token: %w", err)
	}

	// A missing email claim is tolerated here: some IdPs expose the email
	// only from the userinfo endpoint, which the browser flow can reach with
	// the access token it just obtained.
	profile, err := oidc.ProfileFromToken(token, oidc.WithOptionalEmail())
	if err != nil {
		return oidc.Profile{}, fmt.Errorf(
			"extracting profile from id token for %s: %w", p.id, err,
		)
	}

	if profile.Email == "" {
		if err := p.fillProfileFromUserinfo(ctx, accessToken, &profile); err != nil {
			return oidc.Profile{}, fmt.Errorf("fetching userinfo for %s: %w", p.id, err)
		}
	}

	return profile, nil
}

// fillProfileFromUserinfo fills profile fields the id_token did not carry
// from the discovered userinfo endpoint. Returns nil when the provider
// advertises no userinfo endpoint.
func (p *customProvider) fillProfileFromUserinfo(
	ctx context.Context, accessToken string, profile *oidc.Profile,
) error {
	doc, err := p.disco.Get(ctx)
	if err != nil {
		return fmt.Errorf("resolving userinfo endpoint: %w", err)
	}

	if doc.UserinfoEndpoint == "" {
		return nil
	}

	var userinfo struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified *bool  `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}

	if err := fetchOAuthProfileWithClient(
		ctx, p.hc, doc.UserinfoEndpoint, accessToken, &userinfo,
	); err != nil {
		return err
	}

	// OIDC Core §5.3.2: the userinfo sub MUST match the id_token sub, and the
	// response MUST NOT be used otherwise. The id_token fixes the identity
	// while the access token decides whose claims userinfo returns, and the
	// two only describe one user if they came from the same token response —
	// which callbackIDToken now guarantees for every provider but Apple, so this
	// is defence in depth. Keep it: a mismatched email would hand an attacker's
	// identity a verified claim on the victim's address, which is what
	// ensureProviderLinkAllowed trusts. An absent sub is no evidence at all.
	//
	// It compensates for nothing disableNonce gives up — an injected code is
	// redeemed here, so both tokens describe the same victim.
	if userinfo.Sub == "" || userinfo.Sub != profile.ProviderUserID {
		return fmt.Errorf("%w: %s", ErrUserinfoSubjectMismatch, p.id)
	}

	if profile.Email == "" {
		profile.Email = userinfo.Email
	}

	if profile.EmailVerified == oidc.EmailVerificationStatusUnknown &&
		userinfo.EmailVerified != nil {
		profile.EmailVerified = oidc.EmailVerificationFromBool(*userinfo.EmailVerified)
	}

	if profile.Name == "" {
		profile.Name = userinfo.Name
	}

	if profile.Picture == "" {
		profile.Picture = userinfo.Picture
	}

	return nil
}

func (p *customProvider) oauth2Profile(
	ctx context.Context, accessToken string,
) (oidc.Profile, error) {
	var body json.RawMessage
	if err := fetchOAuthProfileWithClient(
		ctx, p.hc, p.userinfoURL, accessToken, &body,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("fetching userinfo for %s: %w", p.id, err)
	}

	// Decode with UseNumber so integer user IDs above 2^53 stay exact: the
	// default float64 decoding silently rounds them, which can collapse two
	// distinct upstream users into one ProviderUserID.
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()

	var raw map[string]any
	if err := dec.Decode(&raw); err != nil {
		return oidc.Profile{}, fmt.Errorf("parsing userinfo for %s: %w", p.id, err)
	}

	mapping := p.claims.withDefaults()

	id := stringClaim(raw, mapping.ID)
	if id == "" {
		return oidc.Profile{}, fmt.Errorf(
			"%w: %s (field %q)", ErrProfileMissingID, p.id, mapping.ID,
		)
	}

	// Only an explicit boolean counts as a verification signal — the
	// presence of an email must never be inferred as verified.
	emailVerifiedStatus := oidc.EmailVerificationStatusUnknown
	if v, ok := raw[mapping.EmailVerified].(bool); ok {
		emailVerifiedStatus = oidc.EmailVerificationFromBool(v)
	}

	return oidc.Profile{
		ProviderUserID: id,
		Email:          stringClaim(raw, mapping.Email),
		EmailVerified:  emailVerifiedStatus,
		Name:           stringClaim(raw, mapping.Name),
		Picture:        stringClaim(raw, mapping.Picture),
	}, nil
}

// stringClaim renders raw[field] as a string. Numbers are rendered because
// numeric user IDs are common; any other type yields "".
func stringClaim(raw map[string]any, field string) string {
	switch v := raw[field].(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	default:
		return ""
	}
}
