package providers

import (
	"encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/auth/go/oidc"
)

var errOIDCConfig = errors.New("AUTH_PROVIDER_OIDC must be an object keyed by provider slug")

// OIDCRegistry holds custom providers separately from the built-in Map.
type OIDCRegistry struct {
	providers map[string]*oidc.CustomProvider
}

// NewOIDCRegistry builds the startup registry from AUTH_PROVIDER_OIDC.
func NewOIDCRegistry(raw string, serverURL *url.URL, client *http.Client) (*OIDCRegistry, error) {
	registry := &OIDCRegistry{providers: make(map[string]*oidc.CustomProvider)}
	if strings.TrimSpace(raw) == "" {
		return registry, nil
	}

	// JSON decoding errors can contain credentials from the configuration.
	var configs map[string]oidc.CustomProviderConfig
	if !strings.HasPrefix(strings.TrimSpace(raw), "{") ||
		json.Unmarshal([]byte(raw), &configs, json.RejectUnknownMembers(true)) != nil {
		return nil, errOIDCConfig
	}

	for slug, config := range configs {
		provider, err := oidc.NewCustomProvider(slug, config, serverURL, client)
		if err != nil {
			return nil, fmt.Errorf("configuring custom OIDC provider: %w", err)
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
