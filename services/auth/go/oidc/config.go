package oidc

import (
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
	providerSlug     = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$`)
)

// CustomProviderConfig contains the settings for one configured OIDC issuer.
type CustomProviderConfig struct {
	Issuer       string   `json:"issuer"`
	DiscoveryURL string   `json:"discoveryUrl"`
	ClientID     string   `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	Scopes       []string `json:"scopes"`
	Audiences    []string `json:"audiences"`
	DisableNonce bool     `json:"disableNonce"`
}

// NewCustomProvider validates the issuer settings and prepares lazy discovery.
func NewCustomProvider(
	slug string, config CustomProviderConfig, serverURL *url.URL, client *http.Client,
) (*CustomProvider, error) {
	if !providerSlug.MatchString(slug) {
		return nil, fmt.Errorf("%w: invalid slug", errInvalidConfig)
	}

	if client == nil || !validCallbackBase(serverURL) {
		return nil, fmt.Errorf(
			"%w: providers require an HTTPS AUTH_SERVER_URL and an HTTP client",
			errInvalidConfig,
		)
	}

	if err := config.validate(); err != nil {
		return nil, err
	}

	return &CustomProvider{
		slug:     slug,
		config:   config,
		callback: serverURL.JoinPath("signin", "oidc", slug, "callback"),
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
	}, nil
}

func validCallbackBase(base *url.URL) bool {
	return base != nil && base.Scheme == "https" && base.Hostname() != "" &&
		base.User == nil && base.RawQuery == "" && !base.ForceQuery && base.Fragment == ""
}

func (c *CustomProviderConfig) validate() error {
	issuer, err := httpsURL(c.Issuer)
	if err != nil || issuer.RawQuery != "" || issuer.ForceQuery {
		return fmt.Errorf(
			"%w: issuer must be an HTTPS URL without a query or fragment",
			errInvalidConfig,
		)
	}

	if c.DiscoveryURL != "" {
		if _, err := httpsURL(c.DiscoveryURL); err != nil {
			return fmt.Errorf("%w: discoveryUrl must be an HTTPS URL", errInvalidConfig)
		}
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

	for _, values := range [][]string{c.Scopes, c.Audiences} {
		for _, value := range values {
			if !validOAuthValue(value) {
				return fmt.Errorf("%w: invalid scope or audience", errInvalidConfig)
			}
		}
	}

	if !slices.Contains(c.Audiences, c.ClientID) {
		c.Audiences = append(slices.Clone(c.Audiences), c.ClientID)
	}

	return nil
}

func validOAuthValue(value string) bool {
	return value != "" && !strings.ContainsFunc(value, func(r rune) bool {
		return r < '!' || r > '~' || r == '"' || r == '\\'
	})
}

func (p *CustomProvider) ID() string {
	return ProviderIDPrefix + p.slug
}

func (p *CustomProvider) Issuer() string {
	return p.config.Issuer
}

func (p *CustomProvider) ClientID() string {
	return p.config.ClientID
}
