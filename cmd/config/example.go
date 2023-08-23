package config

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

func CommandExample() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "example",
		Aliases: []string{},
		Usage:   "Shows an example config file",
		Action:  commandExample,
		Flags:   []cli.Flag{},
	}
}

func ptr[T any](v T) *T { return &v }

func commandExample(cCtx *cli.Context) error { //nolint:funlen,maintidx
	ce := clienv.FromCLI(cCtx)

	//nolint:gomnd
	cfg := model.ConfigConfig{
		Global: &model.ConfigGlobal{
			Environment: []*model.ConfigEnvironmentVariable{
				{
					Name:  "NAME",
					Value: "value",
				},
			},
		},
		Hasura: &model.ConfigHasura{
			Version: new(string),
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: ptr("HS256"),
					Key:  ptr("secret"),
				},
			},
			AdminSecret:   "adminsecret",
			WebhookSecret: "webhooksecret",
			Settings: &model.ConfigHasuraSettings{
				CorsDomain:                    []string{"*"},
				DevMode:                       ptr(false),
				EnableAllowList:               ptr(true),
				EnableConsole:                 ptr(true),
				EnableRemoteSchemaPermissions: ptr(true),
				EnabledAPIs: []string{
					"metadata",
				},
			},
			Logs: &model.ConfigHasuraLogs{
				Level: ptr("warn"),
			},
			Events: &model.ConfigHasuraEvents{
				HttpPoolSize: ptr(uint32(10)),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 1024,
				},
				Replicas: 1,
			},
		},
		Functions: &model.ConfigFunctions{
			Node: &model.ConfigFunctionsNode{
				Version: ptr(int(16)),
			},
		},
		Auth: &model.ConfigAuth{
			Version: new(string),
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    250,
					Memory: 512,
				},
				Replicas: 1,
			},
			Redirections: &model.ConfigAuthRedirections{
				ClientUrl: ptr("https://example.com"),
				AllowedUrls: []string{
					"https://example.com",
				},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled: ptr(true),
			},
			User: &model.ConfigAuthUser{
				Roles: &model.ConfigAuthUserRoles{
					Default: ptr("user"),
					Allowed: []string{"user", "me"},
				},
				Locale: &model.ConfigAuthUserLocale{
					Default: ptr("en"),
					Allowed: []string{"en"},
				},
				Gravatar: &model.ConfigAuthUserGravatar{
					Enabled: ptr(true),
					Default: ptr("identicon"),
					Rating:  ptr("g"),
				},
				Email: &model.ConfigAuthUserEmail{
					Allowed: []string{"asd@example.org"},
					Blocked: []string{"asd@example.com"},
				},
				EmailDomains: &model.ConfigAuthUserEmailDomains{
					Allowed: []string{"example.com"},
					Blocked: []string{"example.org"},
				},
			},
			Session: &model.ConfigAuthSession{
				AccessToken: &model.ConfigAuthSessionAccessToken{
					ExpiresIn: ptr(uint32(3600)),
					CustomClaims: []*model.ConfigAuthsessionaccessTokenCustomClaims{
						{
							Key:   "key",
							Value: "value",
						},
					},
				},
				RefreshToken: &model.ConfigAuthSessionRefreshToken{
					ExpiresIn: ptr(uint32(3600)),
				},
			},
			Method: &model.ConfigAuthMethod{
				Anonymous: &model.ConfigAuthMethodAnonymous{
					Enabled: ptr(false),
				},
				EmailPasswordless: &model.ConfigAuthMethodEmailPasswordless{
					Enabled: ptr(true),
				},
				EmailPassword: &model.ConfigAuthMethodEmailPassword{
					HibpEnabled:               ptr(true),
					EmailVerificationRequired: ptr(true),
					PasswordMinLength:         ptr(uint8(12)),
				},
				SmsPasswordless: &model.ConfigAuthMethodSmsPasswordless{
					Enabled: ptr(true),
				},
				Oauth: &model.ConfigAuthMethodOauth{
					Apple: &model.ConfigAuthMethodOauthApple{
						Enabled:    ptr(true),
						ClientId:   ptr("clientid"),
						KeyId:      ptr("keyid"),
						TeamId:     ptr("teamid"),
						Scope:      []string{"scope"},
						PrivateKey: ptr("privatekey"),
					},
					Azuread: &model.ConfigAuthMethodOauthAzuread{
						Tenant:       ptr("tenant"),
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						ClientSecret: ptr("clientsecret"),
					},
					Bitbucket: &model.ConfigStandardOauthProvider{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						ClientSecret: ptr("clientsecret"),
					},
					Discord: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Twitter: &model.ConfigAuthMethodOauthTwitter{
						Enabled:        ptr(true),
						ConsumerKey:    ptr("consumerkey"),
						ConsumerSecret: ptr("consumersecret"),
					},
					Windowslive: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
					},
					Workos: &model.ConfigAuthMethodOauthWorkos{
						Connection:   ptr("connection"),
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Organization: ptr("organization"),
						ClientSecret: ptr("clientsecret"),
					},
				},
				Webauthn: &model.ConfigAuthMethodWebauthn{
					Enabled: ptr(true),
					RelyingParty: &model.ConfigAuthMethodWebauthnRelyingParty{
						Name: ptr("name"),
						Origins: []string{
							"https://example.com",
						},
					},
					Attestation: &model.ConfigAuthMethodWebauthnAttestation{
						Timeout: ptr(uint32(60000)),
					},
				},
			},
			Totp: &model.ConfigAuthTotp{
				Enabled: ptr(true),
				Issuer:  ptr("issuer"),
			},
		},
		Postgres: &model.ConfigPostgres{
			Version: ptr("14-20230312-1"),
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    2000,
					Memory: 4096,
				},
				Replicas: 1,
			},
		},
		Provider: &model.ConfigProvider{
			Smtp: &model.ConfigSmtp{
				User:     "smtpUser",
				Password: "smtpPassword",
				Sender:   "smtpSender",
				Host:     "smtpHost",
				Port:     587, //nolint:gomnd
				Secure:   true,
				Method:   "LOGIN",
			},
			Sms: &model.ConfigSms{
				Provider:           ptr("twilio"),
				AccountSid:         "twilioAccountSid",
				AuthToken:          "twilioAuthToken",
				MessagingServiceId: "twilioMessagingServiceId",
			},
		},
		Storage: &model.ConfigStorage{
			Version: ptr("0.3.5"),
			Antivirus: &model.ConfigStorageAntivirus{
				Server: ptr("tcp://run-clamav:3310"),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 1024,
				},
				Replicas: 1,
			},
		},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "grafanaAdminPassword",
			},
		},
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	sch, err := schema.New()
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	if err := sch.ValidateConfig(cfg); err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Println(string(b))

	return nil
}
