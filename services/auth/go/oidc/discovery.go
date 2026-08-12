package oidc

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/nhost/services/auth/go/safehttp"
)

const (
	schemeHTTPS = "https"
	schemeHTTP  = "http"
)

// DiscoveryDocument holds the subset of the OIDC discovery document
// (OpenID Connect Discovery 1.0 §3) the auth service uses.
type DiscoveryDocument struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
}

// DiscoveryURL derives the standard discovery-document location for an
// issuer (OpenID Connect Discovery 1.0 §4.1).
func DiscoveryURL(issuer string) string {
	return strings.TrimSuffix(issuer, "/") + "/.well-known/openid-configuration"
}

// Discoverer resolves and memoizes one provider's discovery document, either by
// fetching it from the issuer (NewDiscoverer) or from a document pinned in code
// (NewStaticDiscoverer). A resolved document is cached for the process lifetime;
// failures are negative-cached with exponential backoff — including a pinned
// document that fails validation, which therefore stays failed.
type Discoverer struct {
	memo *lazyMemo[*DiscoveryDocument]
}

// NewDiscoverer returns a Discoverer that fetches url through client and
// rejects any document whose issuer is not exactly wantIssuer. allowInsecure
// permits plain-http endpoints in the document; it must be wired from the
// same operator flag that relaxes the hardened client, so a local IdP stays
// reachable in development.
func NewDiscoverer(url, wantIssuer string, client *http.Client, allowInsecure bool) *Discoverer {
	return &Discoverer{
		memo: newLazyMemo(func(ctx context.Context) (*DiscoveryDocument, error) {
			return fetchDiscoveryDocument(ctx, client, url, wantIssuer, allowInsecure)
		}),
	}
}

// NewStaticDiscoverer returns a Discoverer over a document pinned in code,
// for the built-in providers running on the OIDC engine. Their endpoints are
// compile-time constants, so there is no operator-supplied URL to resolve and
// no network round trip gating the first sign-in.
//
// The document goes through the same validation a fetched one does, minus the
// issuer-match check, which is meaningless for a pinned document — there is no
// independent value to compare against. A typo or a missing required field
// therefore fails before reaching the browser or the JWKS fetch. Validation
// happens on first Get, which keeps the constructor total;
// providers.TestPresetDocuments asserts every shipped document passes.
func NewStaticDiscoverer(doc DiscoveryDocument) *Discoverer {
	return &Discoverer{
		memo: newLazyMemo(func(context.Context) (*DiscoveryDocument, error) {
			// allowInsecure is false: a pinned document is not
			// operator-supplied, so there is no local-IdP case to relax for.
			if err := validateDocument(&doc, false); err != nil {
				return nil, err
			}

			return &doc, nil
		}),
	}
}

// Get returns the memoized discovery document, resolving it on first use.
func (d *Discoverer) Get(ctx context.Context) (*DiscoveryDocument, error) {
	return d.memo.get(ctx)
}

func fetchDiscoveryDocument(
	ctx context.Context, client *http.Client, url, wantIssuer string, allowInsecure bool,
) (*DiscoveryDocument, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating discovery request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching discovery document: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: %d", ErrDiscoveryStatus, resp.StatusCode)
	}

	body, err := safehttp.ReadAllLimited(resp.Body, safehttp.DefaultMaxResponseSize)
	if err != nil {
		return nil, fmt.Errorf("reading discovery document: %w", err)
	}

	var doc DiscoveryDocument
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("parsing discovery document: %w", err)
	}

	// OpenID Connect Discovery 1.0 §4.3: the issuer in the document MUST
	// exactly match the issuer the document was resolved for.
	if doc.Issuer != wantIssuer {
		return nil, fmt.Errorf(
			"%w: got %q, want %q", ErrDiscoveryIssuerMismatch, doc.Issuer, wantIssuer,
		)
	}

	if err := validateDocument(&doc, allowInsecure); err != nil {
		return nil, err
	}

	return &doc, nil
}

// validateDocument applies every check the two discovery sources share, so a
// pinned document cannot get a weaker one than a fetched document. The fetch
// path adds the issuer-match check on top; that has no static equivalent, which
// is why the required-field check below covers the issuer.
func validateDocument(doc *DiscoveryDocument, allowInsecure bool) error {
	if err := validateRequiredFields(doc); err != nil {
		return err
	}

	return validateEndpoints(doc, allowInsecure)
}

// validateRequiredFields asserts the document carries the fields the service has
// no fallback for. validateEndpoints skips empty values — it polices what a
// document *advertises*, and userinfo_endpoint is optional — so a missing
// required field has to be caught here. The issuer fails most quietly of the
// four: it becomes the provider's issuer anchor, and jwt.WithIssuer("") disables
// `iss` verification outright rather than rejecting every token.
func validateRequiredFields(doc *DiscoveryDocument) error {
	// An ordered slice, not a map: see validateEndpoints.
	for _, f := range []struct{ field, value string }{
		{"issuer", doc.Issuer},
		{"authorization_endpoint", doc.AuthorizationEndpoint},
		{"token_endpoint", doc.TokenEndpoint},
		{"jwks_uri", doc.JWKSURI},
	} {
		if f.value == "" {
			return fmt.Errorf("%w: %s is required", ErrDiscoveryIncomplete, f.field)
		}
	}

	return nil
}

// validateEndpoints asserts every URL the document carries — its issuer and
// the endpoints it advertises — is an absolute https URL, as OpenID Connect
// Discovery 1.0 §3 requires.
//
// The hardened client already enforces the scheme on the endpoints it
// fetches (token, jwks, userinfo), but authorization_endpoint is never
// fetched: it is handed to the browser as a Location header carrying the
// signed state JWT — which embeds the raw OIDC nonce and, on the connect
// flow, the caller's own access token. Plaintext there is a credential leak
// no request-time check can catch, so the assertion has to happen here. The
// issuer is checked for the same reason: nothing fetches it either, and it is
// what the id_token `iss` claim is verified against.
func validateEndpoints(doc *DiscoveryDocument, allowInsecure bool) error {
	// An ordered slice, not a map: this error is the operator's only
	// diagnostic, and map iteration order would make a document that is wrong
	// in two endpoints name a different one on every start.
	endpoints := []struct{ field, value string }{
		{"issuer", doc.Issuer},
		{"authorization_endpoint", doc.AuthorizationEndpoint},
		{"token_endpoint", doc.TokenEndpoint},
		{"jwks_uri", doc.JWKSURI},
		// Optional: validated only when advertised.
		{"userinfo_endpoint", doc.UserinfoEndpoint},
	}

	for _, e := range endpoints {
		field, value := e.field, e.value

		if value == "" {
			continue
		}

		parsed, err := url.Parse(value)
		if err != nil || parsed.Host == "" {
			return fmt.Errorf("%w: %s is not an absolute URL", ErrDiscoveryInvalidEndpoint, field)
		}

		if parsed.Scheme != schemeHTTPS && (!allowInsecure || parsed.Scheme != schemeHTTP) {
			return fmt.Errorf("%w: %s must use https", ErrDiscoveryInvalidEndpoint, field)
		}
	}

	return nil
}
