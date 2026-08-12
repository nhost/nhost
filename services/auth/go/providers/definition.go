package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"sync/atomic"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

// CustomProviderPrefix namespaces custom provider IDs ("c:<slug>") so they
// can never collide with built-in provider names.
const CustomProviderPrefix = "c:"

var (
	// ErrInvalidSlug is returned when a custom provider slug does not match
	// the allowed pattern.
	ErrInvalidSlug = errors.New("invalid custom provider slug")
	// ErrUnknownProviderType is returned when a custom provider entry has a
	// type other than "oidc" or "oauth2".
	ErrUnknownProviderType = errors.New("unknown custom provider type")
	// ErrMissingField is returned when a required custom provider field is
	// empty.
	ErrMissingField = errors.New("missing required field")
	// ErrInvalidURL is returned when a custom provider URL field does not
	// parse as an absolute http(s) URL.
	ErrInvalidURL = errors.New("invalid URL")
)

// slugRE constrains slugs to DNS-label-like names: lowercase alphanumerics
// and hyphens, no leading/trailing hyphen, 2–40 characters.
var slugRE = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$`)

const (
	providerTypeOIDC   = "oidc"
	providerTypeOAuth2 = "oauth2"

	schemeHTTPS = "https"
	schemeHTTP  = "http"
)

// defaultOIDCScopes returns the scopes requested from an OIDC-type custom
// provider when the configuration does not specify any.
func defaultOIDCScopes() []string {
	return []string{"openid", "email", "profile"}
}

// Definition is a decoded, validated custom provider configuration entry.
// Build is network-free: all remote interaction (discovery, JWKS) is
// deferred to first use.
type Definition interface {
	// ID returns the provider ID: CustomProviderPrefix + slug.
	ID() string
	// Build constructs the runtime provider. appCtx must be the application
	// context — it bounds background JWKS-refresh goroutines. hc must be an
	// SSRF-hardened client (safehttp.New). The returned validator is non-nil
	// only for OIDC-type providers, which support the native id_token flow.
	//
	// The error is reserved for definitions whose construction can fail:
	// both implementations here validate everything at decode time and
	// always succeed, but the built-in presets planned on top of this seam
	// resolve a template at build time. Callers must keep skipping the
	// provider on error.
	Build(appCtx context.Context, hc *http.Client) (*Provider, *oidc.LazyIDTokenValidator, error)
	// Issuer returns the configured issuer for OIDC-type providers and ""
	// for OAuth2-type ones.
	Issuer() string
	// NonceDisabled reports whether the provider opts out of the OIDC nonce
	// entirely: none on the authorization request, none checked on the id_token.
	// Always false for OAuth2-type providers, which have no id_token.
	NonceDisabled() bool
}

// OIDCDefinition configures a generic OIDC provider: endpoints and JWKS come
// from the issuer's discovery document, identity from the id_token.
type OIDCDefinition struct {
	Slug        string `json:"-"`
	RedirectURL string `json:"-"`
	// AllowInsecureURLs mirrors the operator's private-IP flag: it permits a
	// plain-http authorization_endpoint in the discovery document so a local
	// IdP stays usable in development.
	AllowInsecureURLs bool   `json:"-"`
	Type              string `json:"type"`
	ClientID          string `json:"clientId"`
	ClientSecret      string `json:"clientSecret"`
	IssuerURL         string `json:"issuer"`
	DiscoveryURL      string `json:"discoveryUrl"`
	// DisableNonce is for IdPs that do not round-trip the nonce: LinkedIn returns
	// no claim, AWS Cognito mints its own. The zero value is the strict posture.
	// See customProvidersUsage for what it costs.
	DisableNonce bool     `json:"disableNonce"`
	Scopes       []string `json:"scopes"`
	Audiences    []string `json:"audiences"`
}

func (d *OIDCDefinition) ID() string {
	return CustomProviderPrefix + d.Slug
}

func (d *OIDCDefinition) Issuer() string {
	return d.IssuerURL
}

func (d *OIDCDefinition) NonceDisabled() bool {
	return d.DisableNonce
}

func (d *OIDCDefinition) Build(
	appCtx context.Context, hc *http.Client,
) (*Provider, *oidc.LazyIDTokenValidator, error) {
	discoveryURL := d.DiscoveryURL
	if discoveryURL == "" {
		discoveryURL = oidc.DiscoveryURL(d.IssuerURL)
	}

	disco := oidc.NewDiscoverer(discoveryURL, d.IssuerURL, hc, d.AllowInsecureURLs)
	oidcProvider := oidc.NewCustomProvider(appCtx, d.IssuerURL, disco, hc)

	// Two validators over one provider (so they share the discoverer and the
	// JWKS keyfunc), differing only in the audiences they accept.
	//
	// The browser callback accepts the client ID alone. It must not accept
	// the configured audiences: those name a tenant's *public* native
	// clients, whose id_tokens an attacker can have minted for a victim with
	// a nonce of their choosing — and the raw nonce is readable from the
	// signed-but-not-encrypted state JWT. callbackIDToken keeps such a token
	// out of the callback, but that is one check away from the audience
	// restriction being the only thing standing between a public native
	// client and an account takeover, so both stay.
	browserValidator := oidc.NewLazyIDTokenValidator(
		func(ctx context.Context) (*oidc.IDTokenValidator, error) {
			return oidc.NewIDTokenValidatorForProvider(
				ctx, oidcProvider, []string{d.ClientID},
			)
		},
	)

	// The native POST /signin/idtoken flow is where a native app presents its
	// own id_token, so the configured audiences are accepted alongside the
	// client ID.
	nativeAudiences := append([]string{d.ClientID}, d.Audiences...)
	nativeValidator := oidc.NewLazyIDTokenValidator(
		func(ctx context.Context) (*oidc.IDTokenValidator, error) {
			return oidc.NewIDTokenValidatorForProvider(ctx, oidcProvider, nativeAudiences)
		},
	)

	custom := &customProvider{
		id: d.ID(),
		cfg: &oauth2.Config{ //nolint:exhaustruct
			ClientID:     d.ClientID,
			ClientSecret: d.ClientSecret,
			RedirectURL:  d.RedirectURL,
			Scopes:       d.Scopes,
			// Endpoint is resolved on first use from the discovery document.
		},
		hc:            hc,
		disco:         disco,
		validator:     browserValidator,
		resolvedCfg:   atomic.Pointer[oauth2.Config]{},
		claims:        ClaimMapping{ID: "", Email: "", EmailVerified: "", Name: "", Picture: ""},
		userinfoURL:   "",
		oidcMode:      true,
		nonceDisabled: d.DisableNonce,
	}

	return NewOauth2Provider(custom), nativeValidator, nil
}

// OAuth2Definition configures a generic OAuth2 provider: static endpoints
// and a userinfo fetch with a flat claim rename.
type OAuth2Definition struct {
	Slug string `json:"-"`
	// AllowInsecureURLs mirrors the operator's private-IP flag: it permits a
	// plain-http authorizationUrl so a local IdP stays usable in development.
	AllowInsecureURLs bool         `json:"-"`
	RedirectURL       string       `json:"-"`
	Type              string       `json:"type"`
	ClientID          string       `json:"clientId"`
	ClientSecret      string       `json:"clientSecret"`
	AuthorizationURL  string       `json:"authorizationUrl"`
	TokenURL          string       `json:"tokenUrl"`
	UserinfoURL       string       `json:"userinfoUrl"`
	Scopes            []string     `json:"scopes"`
	Claims            ClaimMapping `json:"claims"`
}

func (d *OAuth2Definition) ID() string {
	return CustomProviderPrefix + d.Slug
}

func (d *OAuth2Definition) Issuer() string {
	return ""
}

func (d *OAuth2Definition) NonceDisabled() bool {
	return false
}

func (d *OAuth2Definition) Build(
	_ context.Context, hc *http.Client,
) (*Provider, *oidc.LazyIDTokenValidator, error) {
	custom := &customProvider{
		id: d.ID(),
		cfg: &oauth2.Config{
			ClientID:     d.ClientID,
			ClientSecret: d.ClientSecret,
			RedirectURL:  d.RedirectURL,
			Scopes:       d.Scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  d.AuthorizationURL,
				TokenURL: d.TokenURL,
			},
		},
		hc:            hc,
		disco:         nil,
		validator:     nil,
		resolvedCfg:   atomic.Pointer[oauth2.Config]{},
		claims:        d.Claims,
		userinfoURL:   d.UserinfoURL,
		oidcMode:      false,
		nonceDisabled: false,
	}

	return NewOauth2Provider(custom), nil, nil
}

// DecodeDefinitions parses the AUTH_PROVIDER_CUSTOM JSON envelope: an object
// keyed by slug. A malformed envelope returns a non-nil error (the whole
// variable is broken and the caller should fail startup). Individually
// invalid entries are returned in the second map, keyed by slug, so the
// caller can log-and-skip them; the returned errors carry the slug and error
// class but never secret values.
// allowInsecureURLs relaxes the https-only rule on operator-supplied URLs; it
// must be wired from the same flag that relaxes the hardened client, so a
// local IdP stays reachable in development.
func DecodeDefinitions(
	raw []byte, serverURL string, allowInsecureURLs bool,
) (map[string]Definition, map[string]error, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, nil, fmt.Errorf("parsing custom providers JSON: %w", err)
	}

	definitions := make(map[string]Definition, len(envelope))
	invalid := make(map[string]error)

	for slug, entry := range envelope {
		def, err := decodeDefinition(slug, entry, serverURL, allowInsecureURLs)
		if err != nil {
			invalid[slug] = err
			continue
		}

		definitions[slug] = def
	}

	return definitions, invalid, nil
}

//nolint:ireturn,nolintlint // the caller dispatches on the "type"-selected concrete type
func decodeDefinition(
	slug string, raw json.RawMessage, serverURL string, allowInsecureURLs bool,
) (Definition, error) {
	if !slugRE.MatchString(slug) {
		return nil, ErrInvalidSlug
	}

	var head struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &head); err != nil {
		return nil, fmt.Errorf("reading provider type: %w", err)
	}

	// The colon is spelled literally: kin-openapi validates path parameters
	// against EscapedPath() without percent-decoding, so "c%3Aslug" would be
	// rejected by the request validator even though the handler resolves it.
	redirectURL := serverURL + "/signin/provider/" + CustomProviderPrefix + slug + "/callback"

	switch head.Type {
	case providerTypeOIDC:
		return decodeOIDCDefinition(slug, raw, redirectURL, allowInsecureURLs)
	case providerTypeOAuth2:
		return decodeOAuth2Definition(slug, raw, redirectURL, allowInsecureURLs)
	default:
		return nil, fmt.Errorf("%w: %q", ErrUnknownProviderType, head.Type)
	}
}

func decodeOIDCDefinition(
	slug string, raw json.RawMessage, redirectURL string, allowInsecureURLs bool,
) (*OIDCDefinition, error) {
	var def OIDCDefinition
	if err := strictUnmarshal(raw, &def); err != nil {
		return nil, fmt.Errorf("parsing oidc provider: %w", err)
	}

	def.Slug = slug
	def.RedirectURL = redirectURL
	def.AllowInsecureURLs = allowInsecureURLs

	if def.ClientID == "" {
		return nil, fmt.Errorf("%w: clientId", ErrMissingField)
	}

	if def.ClientSecret == "" {
		return nil, fmt.Errorf("%w: clientSecret", ErrMissingField)
	}

	if def.IssuerURL == "" {
		return nil, fmt.Errorf("%w: issuer", ErrMissingField)
	}

	if err := validateFetchedURL("issuer", def.IssuerURL); err != nil {
		return nil, err
	}

	if def.DiscoveryURL != "" {
		if err := validateFetchedURL("discoveryUrl", def.DiscoveryURL); err != nil {
			return nil, err
		}
	}

	if len(def.Scopes) == 0 {
		def.Scopes = defaultOIDCScopes()
	} else if !slices.Contains(def.Scopes, "openid") {
		// The openid scope is what makes the IdP return an id_token; the
		// whole OIDC flow depends on it.
		def.Scopes = append(def.Scopes, "openid")
	}

	return &def, nil
}

func decodeOAuth2Definition(
	slug string, raw json.RawMessage, redirectURL string, allowInsecureURLs bool,
) (*OAuth2Definition, error) {
	var def OAuth2Definition
	if err := strictUnmarshal(raw, &def); err != nil {
		return nil, fmt.Errorf("parsing oauth2 provider: %w", err)
	}

	def.Slug = slug
	def.RedirectURL = redirectURL
	def.AllowInsecureURLs = allowInsecureURLs

	if def.ClientID == "" {
		return nil, fmt.Errorf("%w: clientId", ErrMissingField)
	}

	if def.ClientSecret == "" {
		return nil, fmt.Errorf("%w: clientSecret", ErrMissingField)
	}

	// An ordered slice, not a map: this error is logged once at startup as the
	// sole diagnostic for a skipped provider, so an entry that is wrong in
	// both fields must not name a different one on every boot.
	for _, f := range []struct{ name, value string }{
		{"tokenUrl", def.TokenURL},
		{"userinfoUrl", def.UserinfoURL},
	} {
		if f.value == "" {
			return nil, fmt.Errorf("%w: %s", ErrMissingField, f.name)
		}

		if err := validateFetchedURL(f.name, f.value); err != nil {
			return nil, err
		}
	}

	if def.AuthorizationURL == "" {
		return nil, fmt.Errorf("%w: authorizationUrl", ErrMissingField)
	}

	// def.AllowInsecureURLs, not the parameter: the stored value is the one
	// that decides, so the field cannot drift into being write-only state
	// that a later Build would pick up unasserted.
	if err := validateBrowserURL(
		"authorizationUrl", def.AuthorizationURL, def.AllowInsecureURLs,
	); err != nil {
		return nil, err
	}

	return &def, nil
}

func strictUnmarshal(raw []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	if err := dec.Decode(v); err != nil {
		return err //nolint:wrapcheck // callers add the field/type context
	}

	return nil
}

// validateFetchedURL ensures value is an absolute http(s) URL that the
// service itself fetches (issuer, discoveryUrl, tokenUrl, userinfoUrl). The
// https-only rule is left to request time, where the hardened client applies
// it — and applies it equally to URLs that only arrive later via a discovery
// document.
func validateFetchedURL(field, value string) error {
	return parseAbsoluteURL(field, value, true)
}

// validateBrowserURL ensures value is an absolute https URL. It exists for
// authorizationUrl, the one operator-supplied URL the service never fetches:
// it is rendered into a Location header for the end user's browser, carrying
// the signed state JWT — which embeds the raw OIDC nonce and, on the connect
// flow, the caller's own access token. Nothing downstream can catch a
// plaintext scheme there, so a mistyped "http://" has to fail here.
func validateBrowserURL(field, value string, allowInsecure bool) error {
	return parseAbsoluteURL(field, value, allowInsecure)
}

func parseAbsoluteURL(field, value string, allowHTTP bool) error {
	u, err := url.Parse(value)
	if err != nil || u.Host == "" {
		return fmt.Errorf("%w: %s", ErrInvalidURL, field)
	}

	if u.Scheme != schemeHTTPS && (!allowHTTP || u.Scheme != schemeHTTP) {
		return fmt.Errorf("%w: %s", ErrInvalidURL, field)
	}

	return nil
}
