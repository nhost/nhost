package controller

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

type Config struct {
	HasuraGraphqlURL         string     `json:"HASURA_GRAPHQL_GRAPHQL_URL"`
	HasuraAdminSecret        string     `json:"HASURA_GRAPHQL_ADMIN_SECRET"`
	AllowedRedirectURLs      []*url.URL `json:"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS"`
	ClientURL                *url.URL   `json:"AUTH_CLIENT_URL"`
	CustomClaims             string     `json:"AUTH_JWT_CUSTOM_CLAIMS"`
	ConcealErrors            bool       `json:"AUTH_CONCEAL_ERRORS"`
	DisableSignup            bool       `json:"AUTH_DISABLE_SIGNUP"`
	DisableNewUsers          bool       `json:"AUTH_DISABLE_NEW_USERS"`
	DefaultAllowedRoles      []string   `json:"AUTH_DEFAULT_ALLOWED_ROLES"`
	DefaultRole              string     `json:"AUTH_DEFAULT_ROLE"`
	DefaultLocale            string     `json:"AUTH_DEFAULT_LOCALE"`
	AllowedLocales           []string   `json:"AUTH_LOCALE_ALLOWED_LOCALES"`
	GravatarEnabled          bool       `json:"AUTH_GRAVATAR_ENABLED"`
	GravatarDefault          string     `json:"AUTH_GRAVATAR_DEFAULT"`
	GravatarRating           string     `json:"AUTH_GRAVATAR_RATING"`
	PasswordMinLength        int        `json:"AUTH_PASSWORD_MIN_LENGTH"`
	PasswordHIBPEnabled      bool       `json:"AUTH_PASSWORD_HIBP_ENABLED"`
	RefreshTokenExpiresIn    int        `json:"AUTH_REFRESH_TOKEN_EXPIRES_IN"`
	AccessTokenExpiresIn     int        `json:"AUTH_ACCESS_TOKEN_EXPIRES_IN"`
	JWTSecret                string     `json:"HASURA_GRAPHQL_JWT_SECRET"`
	RequireEmailVerification bool       `json:"AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED"`
	ServerURL                *url.URL   `json:"AUTH_SERVER_URL"`
}

func (c *Config) UnmarshalJSON(b []byte) error {
	type Alias Config
	aux := &struct { //nolint:exhaustruct
		ClientURL           string `json:"AUTH_CLIENT_URL"`
		ServerURL           string `json:"AUTH_SERVER_URL"`
		AllowedRedirectURLs string `json:"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS"`
		*Alias
	}{
		Alias: (*Alias)(c),
	}
	if err := json.Unmarshal(b, &aux); err != nil {
		return fmt.Errorf("error unmarshalling config: %w", err)
	}
	var err error

	if aux.ClientURL != "" {
		c.ClientURL, err = url.Parse(aux.ClientURL)
		if err != nil {
			return fmt.Errorf("error parsing client url: %w", err)
		}
	}

	if aux.ServerURL != "" {
		c.ServerURL, err = url.Parse(aux.ServerURL)
		if err != nil {
			return fmt.Errorf("error parsing server url: %w", err)
		}
	}

	allowedRedirectURLs := make([]*url.URL, 0, 10) //nolint:gomnd
	for _, u := range strings.Split(aux.AllowedRedirectURLs, ",") {
		url, err := url.Parse(u)
		if err != nil {
			return fmt.Errorf("error parsing allowed redirect url %s: %w", u, err)
		}
		allowedRedirectURLs = append(allowedRedirectURLs, url)
	}
	c.AllowedRedirectURLs = allowedRedirectURLs

	return nil
}
