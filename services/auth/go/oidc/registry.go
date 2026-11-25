package oidc

import (
	"encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"golang.org/x/sync/semaphore"
)

// ProviderIDPrefix distinguishes stored custom identities from built-in providers.
const ProviderIDPrefix = "oidc:"

var (
	errInvalidConfig = errors.New("invalid OIDC provider configuration")
	providerSlug     = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)
)

type providerConfig struct {
	Slug         string   `json:"slug"`
	Issuer       string   `json:"issuer"`
	ClientID     string   `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	Scopes       []string `json:"scopes"`
	Audiences    []string `json:"audiences"`
}

// OIDCRegistry holds the custom providers configured at service startup.
type OIDCRegistry struct { //nolint:revive // A registry separate from built-in providers.
	providers map[string]*CustomProvider
}

// NewOIDCRegistry parses AUTH_PROVIDER_OIDC. The Auth service supplies a
// public HTTPS client with redirects disabled for all upstream requests.
func NewOIDCRegistry(raw string, serverURL *url.URL, client *http.Client) (*OIDCRegistry, error) {
	registry := &OIDCRegistry{providers: make(map[string]*CustomProvider)}
	if strings.TrimSpace(raw) == "" {
		return registry, nil
	}

	// Do not return JSON decoding errors, which can contain configuration values.
	var configs []providerConfig
	if err := json.Unmarshal([]byte(raw), &configs, json.RejectUnknownMembers(true)); err != nil ||
		!strings.HasPrefix(strings.TrimSpace(raw), "[") {
		return nil, fmt.Errorf("%w: expected an array of provider objects", errInvalidConfig)
	}

	if len(configs) != 0 && (client == nil || !validCallbackBase(serverURL)) {
		return nil, fmt.Errorf(
			"%w: providers require an HTTPS AUTH_SERVER_URL and an HTTP client",
			errInvalidConfig,
		)
	}

	for i, config := range configs {
		if err := config.validate(); err != nil {
			return nil, fmt.Errorf("OIDC provider %d: %w", i+1, err)
		}

		if registry.Get(config.Slug) != nil {
			return nil, fmt.Errorf(
				"%w: duplicate provider slug at position %d",
				errInvalidConfig,
				i+1,
			)
		}

		callback := serverURL.JoinPath("signin", "oidc", config.Slug, "callback")

		registry.providers[config.Slug] = &CustomProvider{
			config:   config,
			callback: callback,
			client:   client,
			discovery: discoveryCache{
				gate:       semaphore.NewWeighted(1),
				document:   nil,
				retryAfter: time.Time{},
				lastError:  nil,
			},
			keys: jwksCache{
				gate:       semaphore.NewWeighted(1),
				keys:       nil,
				expiresAt:  time.Time{},
				retryAfter: time.Time{},
			},
		}
	}

	return registry, nil
}

func validCallbackBase(base *url.URL) bool {
	return base != nil && base.Scheme == "https" && base.Hostname() != "" &&
		base.User == nil && base.RawQuery == "" && !base.ForceQuery && base.Fragment == ""
}

func (c *providerConfig) validate() error {
	if !providerSlug.MatchString(c.Slug) {
		return fmt.Errorf("%w: invalid slug", errInvalidConfig)
	}

	issuer, err := httpsURL(c.Issuer)
	if err != nil || issuer.RawQuery != "" || issuer.ForceQuery {
		return fmt.Errorf(
			"%w: issuer must be an HTTPS URL without a query or fragment",
			errInvalidConfig,
		)
	}

	if c.ClientID == "" || strings.TrimSpace(c.ClientSecret) == "" ||
		!validOAuthValue(c.ClientID) {
		return fmt.Errorf("%w: clientId and clientSecret are required", errInvalidConfig)
	}

	if len(c.Scopes) == 0 {
		c.Scopes = []string{"openid", "email", "profile"}
	}

	if !slices.Contains(c.Scopes, "openid") {
		return fmt.Errorf("%w: scopes must include openid", errInvalidConfig)
	}

	if len(c.Audiences) == 0 {
		c.Audiences = []string{c.ClientID}
	}

	for _, values := range [][]string{c.Scopes, c.Audiences} {
		for _, value := range values {
			if !validOAuthValue(value) {
				return fmt.Errorf("%w: invalid scope or audience", errInvalidConfig)
			}
		}
	}

	return nil
}

func validOAuthValue(value string) bool {
	return value != "" && !strings.ContainsFunc(value, func(r rune) bool {
		return r < '!' || r > '~' || r == '"' || r == '\\'
	})
}

// Get finds a custom provider by its URL slug.
func (r *OIDCRegistry) Get(slug string) *CustomProvider {
	if r == nil {
		return nil
	}

	return r.providers[slug]
}

// All returns the configured providers in slug order.
func (r *OIDCRegistry) All() []*CustomProvider {
	providers := make([]*CustomProvider, 0, len(r.providers))
	for _, provider := range r.providers {
		providers = append(providers, provider)
	}

	slices.SortFunc(providers, func(a, b *CustomProvider) int {
		return strings.Compare(a.config.Slug, b.config.Slug)
	})

	return providers
}

func (p *CustomProvider) ID() string {
	return ProviderIDPrefix + p.config.Slug
}

func (p *CustomProvider) Issuer() string {
	return p.config.Issuer
}

func (p *CustomProvider) ClientID() string {
	return p.config.ClientID
}
