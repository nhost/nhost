package oidc

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/sync/semaphore"
)

const (
	upstreamRetryDelay = 10 * time.Second
	metadataTimeout    = 5 * time.Second
)

var errDiscovery = errors.New("invalid OIDC discovery document")

type discoveryDocument struct {
	Issuer                        string   `json:"issuer"`
	AuthorizationEndpoint         string   `json:"authorization_endpoint"`
	TokenEndpoint                 string   `json:"token_endpoint"`
	JWKSURI                       string   `json:"jwks_uri"`
	UserInfoEndpoint              string   `json:"userinfo_endpoint"`
	SigningAlgorithms             []string `json:"id_token_signing_alg_values_supported"`
	TokenEndpointAuthMethods      []string `json:"token_endpoint_auth_methods_supported"`
	IssuerInAuthorizationResponse bool     `json:"authorization_response_iss_parameter_supported"`
}

type discoveryCache struct {
	gate       *semaphore.Weighted
	document   *discoveryDocument
	retryAfter time.Time
	lastError  error
}

func (p *CustomProvider) discover(ctx context.Context) (*discoveryDocument, error) {
	cache := &p.discovery
	if err := cache.gate.Acquire(ctx, 1); err != nil {
		return nil, fmt.Errorf("waiting for OIDC discovery: %w", err)
	}
	defer cache.gate.Release(1)

	if cache.document != nil {
		return cache.document, nil
	}

	if time.Now().Before(cache.retryAfter) {
		return nil, cache.lastError
	}

	doc, err := p.fetchDiscovery(ctx)
	if err != nil {
		cache.lastError = err
		cache.retryAfter = time.Now().Add(upstreamRetryDelay)

		return nil, err
	}

	cache.document = doc

	return doc, nil
}

func (p *CustomProvider) fetchDiscovery(ctx context.Context) (*discoveryDocument, error) {
	location := p.config.DiscoveryURL
	if location == "" {
		location = strings.TrimSuffix(p.config.Issuer, "/") + "/.well-known/openid-configuration"
	}

	var doc discoveryDocument
	if err := p.getMetadata(ctx, location, &doc); err != nil {
		return nil, fmt.Errorf("loading OIDC discovery document: %w", err)
	}

	if doc.Issuer != p.config.Issuer {
		return nil, fmt.Errorf("%w: issuer mismatch", errDiscovery)
	}

	for _, endpoint := range []string{doc.AuthorizationEndpoint, doc.TokenEndpoint, doc.JWKSURI} {
		if _, err := httpsURL(endpoint); err != nil {
			return nil, err
		}
	}

	if doc.UserInfoEndpoint != "" {
		if _, err := httpsURL(doc.UserInfoEndpoint); err != nil {
			return nil, err
		}
	}

	authURL, _ := url.Parse(doc.AuthorizationEndpoint)

	query, err := url.ParseQuery(authURL.RawQuery)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid authorization endpoint query", errDiscovery)
	}

	for _, param := range []string{
		"client_id", "response_type", "response_mode", "redirect_uri", "scope",
		"state", "nonce", "code_challenge", "code_challenge_method", "request", "request_uri",
	} {
		if query.Has(param) {
			return nil, fmt.Errorf("%w: authorization endpoint sets %s", errDiscovery, param)
		}
	}

	if _, err := doc.authStyle(); err != nil {
		return nil, err
	}

	if !slices.ContainsFunc(doc.SigningAlgorithms, func(alg string) bool {
		return slices.Contains(supportedSigningAlgorithms, alg)
	}) {
		return nil, fmt.Errorf("%w: no supported ID token signing algorithm", errDiscovery)
	}

	return &doc, nil
}

func (d *discoveryDocument) authStyle() (oauth2.AuthStyle, error) {
	switch {
	case len(d.TokenEndpointAuthMethods) == 0,
		slices.Contains(d.TokenEndpointAuthMethods, "client_secret_basic"):
		return oauth2.AuthStyleInHeader, nil
	case slices.Contains(d.TokenEndpointAuthMethods, "client_secret_post"):
		return oauth2.AuthStyleInParams, nil
	default:
		return 0, fmt.Errorf("%w: no supported token endpoint authentication method", errDiscovery)
	}
}

func httpsURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" ||
		parsed.User != nil || strings.Contains(raw, "#") {
		return nil, fmt.Errorf("%w: expected an absolute HTTPS URL", errDiscovery)
	}

	return parsed, nil
}

func (p *CustomProvider) getMetadata(ctx context.Context, location string, destination any) error {
	// A refresh is shared by the provider's requests. The initiating
	// request may disconnect while other requests are waiting for it.
	refreshCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), metadataTimeout)
	defer cancel()

	return p.getJSON(refreshCtx, location, nil, destination)
}

func (p *CustomProvider) getJSON(
	ctx context.Context, location string, token *oauth2.Token, destination any,
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, location, nil)
	if err != nil {
		return fmt.Errorf("creating OIDC request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	if token != nil {
		token.SetAuthHeader(req)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("sending OIDC request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: unexpected HTTP status %d", errDiscovery, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading OIDC response: %w", err)
	}

	if err := json.Unmarshal(body, destination); err != nil {
		return fmt.Errorf("decoding OIDC response: %w", err)
	}

	return nil
}
