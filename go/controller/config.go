package controller

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

type stringlice []string

func (s *stringlice) UnmarshalJSON(b []byte) error {
	var aux string
	if err := json.Unmarshal(b, &aux); err != nil {
		return fmt.Errorf("error unmarshalling stringlice: %w", err)
	}

	if aux == "" {
		*s = []string{}
		return nil
	}

	*s = strings.Split(aux, ",")
	return nil
}

type Config struct {
	HasuraGraphqlURL            string        `json:"HASURA_GRAPHQL_GRAPHQL_URL"`
	HasuraAdminSecret           string        `json:"HASURA_GRAPHQL_ADMIN_SECRET"`
	AnonymousUsersEnabled       bool          `json:"AUTH_ANONYMOUS_USERS_ENABLED"`
	MfaEnabled                  bool          `json:"AUTH_MFA_ENABLED"`
	AllowedEmailDomains         stringlice    `json:"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS"`
	AllowedEmails               stringlice    `json:"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS"`
	AllowedRedirectURLs         []string      `json:"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS"`
	BlockedEmailDomains         stringlice    `json:"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS"`
	BlockedEmails               stringlice    `json:"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS"`
	ClientURL                   *url.URL      `json:"AUTH_CLIENT_URL"`
	CustomClaims                string        `json:"AUTH_JWT_CUSTOM_CLAIMS"`
	ConcealErrors               bool          `json:"AUTH_CONCEAL_ERRORS"`
	DisableSignup               bool          `json:"AUTH_DISABLE_SIGNUP"`
	DisableNewUsers             bool          `json:"AUTH_DISABLE_NEW_USERS"`
	DefaultAllowedRoles         []string      `json:"AUTH_DEFAULT_ALLOWED_ROLES"`
	DefaultRole                 string        `json:"AUTH_DEFAULT_ROLE"`
	DefaultLocale               string        `json:"AUTH_DEFAULT_LOCALE"`
	AllowedLocales              stringlice    `json:"AUTH_LOCALE_ALLOWED_LOCALES"`
	GravatarEnabled             bool          `json:"AUTH_GRAVATAR_ENABLED"`
	GravatarDefault             string        `json:"AUTH_GRAVATAR_DEFAULT"`
	GravatarRating              string        `json:"AUTH_GRAVATAR_RATING"`
	PasswordMinLength           int           `json:"AUTH_PASSWORD_MIN_LENGTH"`
	PasswordHIBPEnabled         bool          `json:"AUTH_PASSWORD_HIBP_ENABLED"`
	RefreshTokenExpiresIn       int           `json:"AUTH_REFRESH_TOKEN_EXPIRES_IN"`
	AccessTokenExpiresIn        int           `json:"AUTH_ACCESS_TOKEN_EXPIRES_IN"`
	JWTSecret                   string        `json:"HASURA_GRAPHQL_JWT_SECRET"`
	RequireEmailVerification    bool          `json:"AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED"`
	ServerURL                   *url.URL      `json:"AUTH_SERVER_URL"`
	EmailPasswordlessEnabled    bool          `json:"AUTH_EMAIL_PASSWORDLESS_ENABLED"`
	WebauthnEnabled             bool          `json:"AUTH_WEBAUTHN_ENABLED"`
	WebauthnRPID                string        `json:"AUTH_WEBAUTHN_RPID"`
	WebauthnRPName              string        `json:"AUTH_WEBAUTHN_RPNAME"`
	WebauthnRPOrigins           []string      `json:"AUTH_WEBAUTHN_RP_ORIGINS"`
	WebauhtnAttestationTimeout  time.Duration `json:"AUTH_WEBAUTHN_ATTESTATION_TIMEOUT"`
	OTPEmailEnabled             bool          `json:"AUTH_OTP_EMAIL_ENABLED"`
	SMSPasswordlessEnabled      bool          `json:"AUTH_SMS_PASSWORDLESS_ENABLED"`
	SMSTwilioAccountSid         string        `json:"AUTH_SMS_TWILIO_ACCOUNT_SID"`
	SMSTwilioAuthToken          string        `json:"AUTH_SMS_TWILIO_AUTH_TOKEN"`
	SMSTwilioMessagingServiceID string        `json:"AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID"`
	ServerPrefix                string        `json:"AUTH_SERVER_PREFIX"`
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

	c.AllowedRedirectURLs = strings.Split(aux.AllowedRedirectURLs, ",")

	return nil
}

func (c *Config) UseSecureCookies() bool {
	return c.ServerURL.Scheme == "https"
}
