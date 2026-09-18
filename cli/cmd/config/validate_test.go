package config_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/project/env"
)

func expectedConfig() *model.ConfigConfig {
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
					Type:       new("RS256"),
					Key:        new("test-public-key"),
					SigningKey: new("test-private-key"),
					Kid:        new("test-kid"),
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
				Enabled:           new(true),
				DisableNewUsers:   new(false),
				DisableAutoSignup: new(false),
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
			Oauth2Provider: &model.ConfigAuthOauth2Provider{
				Enabled: new(false),
				AccessToken: &model.ConfigAuthOauth2ProviderAccessToken{
					ExpiresIn: new(uint32(900)),
				},
				RefreshToken: &model.ConfigAuthOauth2ProviderRefreshToken{
					ExpiresIn: new(uint32(2592000)),
				},
				ClientIdMetadataDocument: &model.ConfigAuthOauth2ProviderClientIdMetadataDocument{
					Enabled: new(false),
				},
			},
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
				Oauth2Server: &model.ConfigRateLimit{
					Limit:    100,
					Interval: "5m",
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

func TestValidateEnginePerServiceOverrides(t *testing.T) {
	t.Parallel()

	const engineOverrideError = "config is not valid: experimental.nhost is enabled: non-default " +
		"auth.version and auth.resources.replicas, auth.resources.compute, auth.resources.autoscaler, " +
		"non-default storage.version, and storage.resources are not supported; configure the engine " +
		"version and sizing with experimental.nhost.version and experimental.nhost.resources; " +
		"unsupported values: "

	fixtureRoot := filepath.Join("testdata", "validate", "success")

	rawConfig, err := os.ReadFile(filepath.Join(fixtureRoot, "nhost", "nhost.toml"))
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		// authVersion and storageVersion replace the fixture's version keys. An empty
		// value removes the key altogether, which is how a project leaves the version to
		// the schema default.
		authVersion    string
		storageVersion string
		extraSecrets   model.Secrets
		expectedError  string
	}{
		{
			name:           "rejects non-default versions",
			authVersion:    "custom-auth",
			storageVersion: "custom-storage",
			expectedError: engineOverrideError +
				"auth.version=\"custom-auth\", storage.version=\"custom-storage\"",
		},
		{
			name:           "accepts schema-default versions",
			authVersion:    "0.49.1",
			storageVersion: "0.14.0",
		},
		{
			name:           "accepts versions left to the schema default",
			authVersion:    "",
			storageVersion: "",
		},
		{
			name:           "validates pre-fill input",
			authVersion:    "{{ secrets.AUTH_VERSION }}",
			storageVersion: "0.14.0",
			extraSecrets: model.Secrets{
				{Name: "AUTH_VERSION", Value: "0.49.1"},
			},
			expectedError: engineOverrideError + "auth.version=\"{{ secrets.AUTH_VERSION }}\"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			nhostDir := t.TempDir()
			configText := setServiceVersion(string(rawConfig), "0.20.0", test.authVersion)
			configText = setServiceVersion(configText, "0.3.4", test.storageVersion)

			configText += "\n[experimental.nhost]\n"
			if err := os.WriteFile(
				filepath.Join(nhostDir, "nhost.toml"),
				[]byte(configText),
				0o600,
			); err != nil {
				t.Fatal(err)
			}

			ce := clienv.New(
				os.Stdout,
				os.Stderr,
				clienv.NewPathStructure(
					".",
					fixtureRoot,
					filepath.Join(fixtureRoot, ".nhost"),
					nhostDir,
				),
				"fakeauthurl",
				"fakegraphqlurl",
				"",
				"",
				"fakebranch",
				"",
				"local",
			)

			var secrets model.Secrets
			if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
				t.Fatal(err)
			}

			_, err := config.Validate(ce, "local", append(secrets, test.extraSecrets...))
			if test.expectedError == "" {
				if err != nil {
					t.Fatalf("expected config to be accepted: %v", err)
				}

				return
			}

			if err == nil {
				t.Fatal("expected engine per-service overrides to be rejected")
			}

			if !strings.Contains(err.Error(), test.expectedError) {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// setServiceVersion rewrites the version key currently holding current, or removes the key
// entirely when want is empty so that the schema default fills it.
func setServiceVersion(configText, current, want string) string {
	key := "version = '" + current + "'"
	if want == "" {
		return strings.ReplaceAll(configText, key+"\n", "")
	}

	return strings.ReplaceAll(configText, key, "version = '"+want+"'")
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
				"",
				"",
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
