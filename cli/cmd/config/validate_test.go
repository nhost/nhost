package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/project/env"
)

func expectedConfig() *model.ConfigConfig {
	//nolint:exhaustruct
	return &model.ConfigConfig{
		Global: &model.ConfigGlobal{
			Environment: []*model.ConfigGlobalEnvironmentVariable{
				{Name: "ENVIRONMENT", Value: "development"},
				{Name: "FUNCTION_LOG_LEVEL", Value: "debug"},
			},
		},
		Hasura: &model.ConfigHasura{
			Version: new("v2.25.0-ce"),
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: new("HS256"),
					Key:  new("0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db"),
				},
			},
			AdminSecret:   "nhost-admin-secret",
			WebhookSecret: "nhost-webhook-secret",
			Settings: &model.ConfigHasuraSettings{
				CorsDomain:                    []string{"*"},
				DevMode:                       new(true),
				EnableAllowList:               new(false),
				EnableConsole:                 new(true),
				EnableRemoteSchemaPermissions: new(bool),
				EnabledAPIs: []string{
					"metadata",
					"graphql",
					"pgdump",
					"config",
				},
				InferFunctionPermissions:              new(true),
				LiveQueriesMultiplexedRefetchInterval: new(uint32(1000)),
				StringifyNumericTypes:                 new(false),
			},
			Logs:   &model.ConfigHasuraLogs{Level: new("warn")},
			Events: &model.ConfigHasuraEvents{HttpPoolSize: new(uint32(100))},
		},
		Functions: &model.ConfigFunctions{Node: &model.ConfigFunctionsNode{Version: new(22)}},
		Auth: &model.ConfigAuth{
			Version: new("0.20.0"),
			Misc: &model.ConfigAuthMisc{
				ConcealErrors: new(false),
			},
			ElevatedPrivileges: &model.ConfigAuthElevatedPrivileges{
				Mode: new("disabled"),
			},
			Redirections: &model.ConfigAuthRedirections{
				ClientUrl:   new("http://localhost:3000"),
				AllowedUrls: []string{},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled:         new(true),
				DisableNewUsers: new(false),
			},
			User: &model.ConfigAuthUser{
				Roles: &model.ConfigAuthUserRoles{
					Default: new("user"),
					Allowed: []string{"user", "me"},
				},
				Locale: &model.ConfigAuthUserLocale{
					Default: new("en"),
					Allowed: []string{"en"},
				},
				Gravatar: &model.ConfigAuthUserGravatar{
					Enabled: new(true),
					Default: new("blank"),
					Rating:  new("g"),
				},
				Email: &model.ConfigAuthUserEmail{
					Allowed: []string{},
					Blocked: []string{},
				},
				EmailDomains: &model.ConfigAuthUserEmailDomains{
					Allowed: []string{},
					Blocked: []string{},
				},
			},
			Session: &model.ConfigAuthSession{
				AccessToken: &model.ConfigAuthSessionAccessToken{
					ExpiresIn:    new(uint32(900)),
					CustomClaims: []*model.ConfigAuthsessionaccessTokenCustomClaims{},
				},
				RefreshToken: &model.ConfigAuthSessionRefreshToken{
					ExpiresIn: new(uint32(2592000)),
				},
			},
			Method: &model.ConfigAuthMethod{
				Anonymous: &model.ConfigAuthMethodAnonymous{
					Enabled: new(false),
				},
				Otp: &model.ConfigAuthMethodOtp{
					Email: &model.ConfigAuthMethodOtpEmail{
						Enabled: new(false),
					},
				},
				EmailPasswordless: &model.ConfigAuthMethodEmailPasswordless{
					Enabled: new(false),
				},
				EmailPassword: &model.ConfigAuthMethodEmailPassword{
					HibpEnabled:               new(false),
					EmailVerificationRequired: new(true),
					PasswordMinLength:         new(uint8(9)),
				},
				SmsPasswordless: &model.ConfigAuthMethodSmsPasswordless{
					Enabled: new(false),
				},
				Oauth: &model.ConfigAuthMethodOauth{
					Apple: &model.ConfigAuthMethodOauthApple{
						Enabled: new(false),
					},
					Azuread: &model.ConfigAuthMethodOauthAzuread{
						Enabled: new(false),
						Tenant:  new("common"),
					},
					Bitbucket: &model.ConfigStandardOauthProvider{
						Enabled: new(false),
					},
					Discord: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Entraid: &model.ConfigAuthMethodOauthEntraid{
						Enabled: new(false),
						Tenant:  new("common"),
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Twitter: &model.ConfigAuthMethodOauthTwitter{
						Enabled: new(false),
					},
					Windowslive: &model.ConfigStandardOauthProviderWithScope{
						Enabled: new(false),
					},
					Workos: &model.ConfigAuthMethodOauthWorkos{
						Enabled: new(false),
					},
				},
				Webauthn: &model.ConfigAuthMethodWebauthn{
					Enabled:      new(false),
					RelyingParty: nil,
					Attestation: &model.ConfigAuthMethodWebauthnAttestation{
						Timeout: new(uint32(60000)),
					},
				},
			},
			Totp: &model.ConfigAuthTotp{Enabled: new(false)},
			RateLimit: &model.ConfigAuthRateLimit{
				Emails: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "1h",
				},
				Sms: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "1h",
				},
				BruteForce: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "5m",
				},
				Signups: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "5m",
				},
				Global: &model.ConfigRateLimit{
					Limit:    100,
					Interval: "1m",
				},
			},
		},
		Postgres: &model.ConfigPostgres{
			Version: new("14.6-20230406-2"),
			Resources: &model.ConfigPostgresResources{
				Storage: &model.ConfigPostgresResourcesStorage{
					Capacity: 1,
				},
			},
		},
		Provider: &model.ConfigProvider{},
		Storage:  &model.ConfigStorage{Version: new("0.3.4")},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "grafana-admin-password",
				Smtp:          nil,
				Alerting: &model.ConfigGrafanaAlerting{
					Enabled: new(false),
				},
				Contacts: &model.ConfigGrafanaContacts{},
			},
		},
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		path         string
		expected     func() *model.ConfigConfig
		applyPatches bool
	}{
		{
			name:         "applypatches",
			path:         "success",
			expected:     expectedConfig,
			applyPatches: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ce := clienv.New(
				os.Stdout,
				os.Stderr,
				clienv.NewPathStructure(
					".",
					filepath.Join("testdata", "validate", tc.path),
					filepath.Join("testdata", "validate", tc.path, ".nhost"),
					filepath.Join("testdata", "validate", tc.path, "nhost"),
				),
				"fakeauthurl",
				"fakegraphqlurl",
				"fakebranch",
				"",
				"local",
			)

			var secrets model.Secrets
			if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
				t.Fatalf(
					"failed to parse secrets, make sure secret values are between quotes: %s",
					err,
				)
			}

			cfg, err := config.Validate(ce, "local", secrets)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(tc.expected(), cfg); diff != "" {
				t.Errorf("%s", diff)
			}
		})
	}
}
