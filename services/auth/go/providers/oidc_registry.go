package providers

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/auth/go/oidc"
)

var (
	errOIDCConfig = errors.New("AUTH_PROVIDER_OIDC must be an object keyed by provider slug")
	errOIDCSlug   = errors.New("AUTH_PROVIDER_OIDC contains an invalid slug")
	errOIDCDecode = errors.New(
		"AUTH_PROVIDER_OIDC is not valid JSON or contains an unknown or mistyped field " +
			"(expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)",
	)
	errOIDCProviderField = errors.New(
		"AUTH_PROVIDER_OIDC contains an unknown, misnamed, or mistyped field " +
			"(expected issuer, discoveryUrl, clientId, clientSecret, scopes, audiences, disableNonce)",
	)
)

// OIDCRegistry holds custom providers separately from the built-in Map.
type OIDCRegistry struct {
	providers map[string]*oidc.CustomProvider
}

// NewOIDCRegistry builds the startup registry from AUTH_PROVIDER_OIDC.
func NewOIDCRegistry(raw string, serverURL *url.URL, client *http.Client, logger *slog.Logger) (*OIDCRegistry, error) {
	registry := &OIDCRegistry{providers: make(map[string]*oidc.CustomProvider)}
	if strings.TrimSpace(raw) == "" {
		return registry, nil
	}

	if !strings.HasPrefix(strings.TrimSpace(raw), "{") {
		return nil, errOIDCConfig
	}

	// JSON decoding errors can contain credentials from the configuration.
	var configs map[string]jsontext.Value
	if json.Unmarshal([]byte(raw), &configs) != nil {
		return nil, errOIDCDecode
	}

	for _, slug := range slices.Sorted(maps.Keys(configs)) {
		// Validate before echoing a slug: malformed keys can contain credentials.
		if !oidc.ValidProviderSlug(slug) {
			return nil, errOIDCSlug
		}

		var config oidc.CustomProviderConfig
		if json.Unmarshal(configs[slug], &config, json.RejectUnknownMembers(true)) != nil {
			return nil, fmt.Errorf("provider %q: %w", slug, errOIDCProviderField)
		}

		provider, err := oidc.NewCustomProvider(slug, config, serverURL, client)
		if err != nil {
			return nil, fmt.Errorf("configuring custom OIDC provider: %w", err)
		}

		if len(config.Scopes) != 0 && !slices.Contains(config.Scopes, "email") {
			logger.Warn("custom OIDC provider scopes omit email; "+
				"new identities require an email claim from the ID token or UserInfo",
				slog.String("provider", slug))
		}

		registry.providers[slug] = provider
	}

	return registry, nil
}

// Get finds a custom provider by its URL slug.
func (r *OIDCRegistry) Get(slug string) *oidc.CustomProvider {
	if r == nil {
		return nil
	}

	return r.providers[slug]
}

// All returns the configured providers in slug order.
func (r *OIDCRegistry) All() []*oidc.CustomProvider {
	providers := make([]*oidc.CustomProvider, 0, len(r.providers))
	for _, provider := range r.providers {
		providers = append(providers, provider)
	}

	slices.SortFunc(providers, func(a, b *oidc.CustomProvider) int {
		return strings.Compare(a.ID(), b.ID())
	})

	return providers
}
