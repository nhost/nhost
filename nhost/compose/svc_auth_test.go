package compose

import (
	"fmt"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/nhost/envvars"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_authServiceEnvs(t *testing.T) {
	t.Parallel()

	assert := assert.New(t)

	c := &Config{
		ports:       testPorts(t),
		nhostConfig: resolvedDefaultNhostConfig(t),
	}

	assert.Equal(envvars.Env{
		"AUTH_HOST":                                 "0.0.0.0",
		"HASURA_GRAPHQL_DATABASE_URL":               "postgres://nhost_auth_admin@local.db.nhost.run:5432/postgres",
		"HASURA_GRAPHQL_GRAPHQL_URL":                "http://graphql:8080/v1/graphql",
		"AUTH_SERVER_URL":                           "https://local.auth.nhost.run/v1",
		"HASURA_GRAPHQL_JWT_SECRET":                 fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
		"HASURA_GRAPHQL_ADMIN_SECRET":               "nhost-admin-secret",
		"AUTH_ACCESS_TOKEN_EXPIRES_IN":              "900",
		"AUTH_CLIENT_URL":                           "http://localhost:3000",
		"AUTH_DISABLE_NEW_USERS":                    "false",
		"AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED": "true",
		"AUTH_GRAVATAR_DEFAULT":                     "blank",
		"AUTH_GRAVATAR_ENABLED":                     "true",
		"AUTH_GRAVATAR_RATING":                      "g",
		"AUTH_LOCALE_ALLOWED_LOCALES":               "en",
		"AUTH_LOCALE_DEFAULT":                       "en",
		"AUTH_PASSWORD_MIN_LENGTH":                  "9",
		"AUTH_REFRESH_TOKEN_EXPIRES_IN":             "43200",
		"AUTH_USER_DEFAULT_ALLOWED_ROLES":           "user,me",
		"AUTH_USER_DEFAULT_ROLE":                    "user",
		"AUTH_WEBAUTHN_ATTESTATION_TIMEOUT":         "60000",
		"AUTH_SMTP_PASS":                            "password",
		"AUTH_SMTP_HOST":                            "mailhog",
		"AUTH_SMTP_USER":                            "user",
		"AUTH_SMTP_SENDER":                          "hasura-auth@example.com",
		"AUTH_SMTP_AUTH_METHOD":                     "PLAIN",
		"AUTH_SMTP_PORT":                            "1025",
		"AUTH_SMTP_SECURE":                          "false",
		"AUTH_SMS_PROVIDER":                         "",
		"AUTH_SMS_TWILIO_ACCOUNT_SID":               "",
		"AUTH_SMS_TWILIO_AUTH_TOKEN":                "",
		"AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID":      "",
		"AUTH_WEBAUTHN_ENABLED":                     "false",
		"AUTH_WEBAUTHN_RP_NAME":                     "",
		"AUTH_WEBAUTHN_RP_ORIGINS":                  "",
		"AUTH_ANONYMOUS_USERS_ENABLED":              "false",
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS":        "",
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS": "",
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS":        "",
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS": "",
		"AUTH_PASSWORD_HIBP_ENABLED":                "false",
		"AUTH_EMAIL_PASSWORDLESS_ENABLED":           "false",
		"AUTH_SMS_PASSWORDLESS_ENABLED":             "false",
		"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS": "",
		"AUTH_MFA_ENABLED":                          "false",
		"AUTH_MFA_TOTP_ISSUER":                      "",
		"AUTH_JWT_CUSTOM_CLAIMS":                    "{}",
		"NHOST_BACKEND_URL":                         "http://traefik:1337",
		"NHOST_SUBDOMAIN":                           "local",
		"NHOST_REGION":                              "",
		"NHOST_HASURA_URL":                          "https://local.hasura.nhost.run/console",
		"NHOST_GRAPHQL_URL":                         "https://local.graphql.nhost.run/v1",
		"NHOST_AUTH_URL":                            "https://local.auth.nhost.run/v1",
		"NHOST_STORAGE_URL":                         "https://local.storage.nhost.run/v1",
		"NHOST_FUNCTIONS_URL":                       "https://local.functions.nhost.run/v1",
		"NHOST_ADMIN_SECRET":                        "nhost-admin-secret",
		"NHOST_WEBHOOK_SECRET":                      "nhost-webhook-secret",
		"NHOST_JWT_SECRET":                          fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
	}, c.authServiceEnvs())
}

func TestConfig_authJwtCustomClaims(t *testing.T) {
	tests := []struct {
		name        string
		nhostConfig func() *model.ConfigConfig
		want        string
	}{
		{
			name:        "default",
			nhostConfig: func() *model.ConfigConfig { return resolvedDefaultNhostConfig(t) },
			want:        "{}",
		},
		{
			name: "with custom claims",
			nhostConfig: func() *model.ConfigConfig {
				conf := resolvedDefaultNhostConfig(t)
				conf.Auth = &model.ConfigAuth{Session: &model.ConfigAuthSession{AccessToken: &model.ConfigAuthSessionAccessToken{}}}
				accessToken := conf.GetAuth().GetSession().GetAccessToken()
				accessToken.CustomClaims = []*model.ConfigAuthsessionaccessTokenCustomClaims{
					{
						Key:   "foo",
						Value: "bar",
					},
					{
						Key:   "baz",
						Value: "qux",
					},
				}
				return conf
			},
			want: `{"baz":"qux","foo":"bar"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := Config{
				nhostConfig: tt.nhostConfig(),
			}
			assert.Equalf(t, tt.want, c.authJwtCustomClaims(), "authJwtCustomClaims()")
		})
	}
}
