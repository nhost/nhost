package config

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
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

func commandExample(_ context.Context, cmd *cli.Command) error { //nolint:funlen,maintidx
	ce := clienv.FromCLI(cmd)

	//nolint:mnd
	cfg := model.ConfigConfig{
		Global: &model.ConfigGlobal{
			Environment: []*model.ConfigGlobalEnvironmentVariable{
				{
					Name:  "NAME",
					Value: "value",
				},
			},
		},
		Ai: &model.ConfigAI{
			Version: new("0.3.0"),
			Resources: &model.ConfigAIResources{
				Compute: &model.ConfigComputeResources{
					Cpu:    256,
					Memory: 512,
				},
			},
			Openai: &model.ConfigAIOpenai{
				Organization: new("org-id"),
				ApiKey:       "opeanai-api-key",
			},
			AutoEmbeddings: &model.ConfigAIAutoEmbeddings{
				SynchPeriodMinutes: new(uint32(10)),
			},
			WebhookSecret: "this-is-a-webhook-secret",
		},
		Graphql: &model.ConfigGraphql{
			Security: &model.ConfigGraphqlSecurity{
				ForbidAminSecret: new(true),
				MaxDepthQueries:  new(uint(4)),
			},
		},
		Hasura: &model.ConfigHasura{
			Version: new(string),
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: new("RS256"),
					Key:  new("pubKey"),
				},
			},
			AdminSecret:   "adminsecret",
			WebhookSecret: "webhooksecret",
			Settings: &model.ConfigHasuraSettings{
				CorsDomain:                    []string{"*"},
				DevMode:                       new(false),
				EnableAllowList:               new(true),
				EnableConsole:                 new(true),
				EnableRemoteSchemaPermissions: new(true),
				EnabledAPIs: []string{
					"metadata",
				},
				InferFunctionPermissions:              new(true),
				LiveQueriesMultiplexedRefetchInterval: new(uint32(1000)),
				StringifyNumericTypes:                 new(false),
			},
			AuthHook: &model.ConfigHasuraAuthHook{
				Url:             "https://customauth.example.com/hook",
				Mode:            new("POST"),
				SendRequestBody: new(true),
			},
			Logs: &model.ConfigHasuraLogs{
				Level: new("warn"),
			},
			Events: &model.ConfigHasuraEvents{
				HttpPoolSize: new(uint32(10)),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 1024,
				},
				Replicas: new(uint8(1)),
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"hasura.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: new(
									"---BEGIN CERTIFICATE---\n...\n---END CERTIFICATE---",
								),
							},
						},
					},
				},
				Autoscaler: nil,
			},
			RateLimit: &model.ConfigRateLimit{
				Limit:    100,
				Interval: "15m",
			},
		},
		Functions: &model.ConfigFunctions{
			Node: &model.ConfigFunctionsNode{
				Version: new(int(22)),
			},
			Resources: &model.ConfigFunctionsResources{
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"hasura.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: new(
									"---BEGIN CERTIFICATE---\n...\n---END CERTIFICATE---",
								),
							},
						},
					},
				},
			},
			RateLimit: &model.ConfigRateLimit{
				Limit:    100,
				Interval: "15m",
			},
		},
		Auth: &model.ConfigAuth{
			Version: new("0.25.0"),
			Misc: &model.ConfigAuthMisc{
				ConcealErrors: new(false),
			},
			ElevatedPrivileges: &model.ConfigAuthElevatedPrivileges{
				Mode: new("required"),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    250,
					Memory: 512,
				},
				Replicas: new(uint8(1)),
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"auth.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: new(
									"---BEGIN CERTIFICATE---\n...\n---END CERTIFICATE---",
								),
							},
						},
					},
				},
				Autoscaler: nil,
			},
			Redirections: &model.ConfigAuthRedirections{
				ClientUrl: new("https://example.com"),
				AllowedUrls: []string{
					"https://example.com",
				},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled:         new(true),
				DisableNewUsers: new(false),
				Turnstile: &model.ConfigAuthSignUpTurnstile{
					SecretKey: "turnstileSecretKey",
				},
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
					Default: new("identicon"),
					Rating:  new("g"),
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
					ExpiresIn: new(uint32(3600)),
					CustomClaims: []*model.ConfigAuthsessionaccessTokenCustomClaims{
						{
							Key:     "key",
							Value:   "value",
							Default: new("default-value"),
						},
					},
				},
				RefreshToken: &model.ConfigAuthSessionRefreshToken{
					ExpiresIn: new(uint32(3600)),
				},
			},
			Method: &model.ConfigAuthMethod{
				Anonymous: &model.ConfigAuthMethodAnonymous{
					Enabled: new(false),
				},
				Otp: &model.ConfigAuthMethodOtp{
					Email: &model.ConfigAuthMethodOtpEmail{
						Enabled: new(true),
					},
				},
				EmailPasswordless: &model.ConfigAuthMethodEmailPasswordless{
					Enabled: new(true),
				},
				EmailPassword: &model.ConfigAuthMethodEmailPassword{
					HibpEnabled:               new(true),
					EmailVerificationRequired: new(true),
					PasswordMinLength:         new(uint8(12)),
				},
				SmsPasswordless: &model.ConfigAuthMethodSmsPasswordless{
					Enabled: new(true),
				},
				Oauth: &model.ConfigAuthMethodOauth{
					Apple: &model.ConfigAuthMethodOauthApple{
						Enabled:    new(true),
						ClientId:   new("clientid"),
						KeyId:      new("keyid"),
						TeamId:     new("teamid"),
						Scope:      []string{"scope"},
						PrivateKey: new("privatekey"),
						Audience:   new("audience"),
					},
					Azuread: &model.ConfigAuthMethodOauthAzuread{
						Tenant:       new("tenant"),
						Enabled:      new(true),
						ClientId:     new("clientid"),
						ClientSecret: new("clientsecret"),
					},
					Bitbucket: &model.ConfigStandardOauthProvider{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						ClientSecret: new("clientsecret"),
					},
					Discord: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Entraid: &model.ConfigAuthMethodOauthEntraid{
						ClientId:     new("entraidClientId"),
						ClientSecret: new("entraidClientSecret"),
						Enabled:      new(true),
						Tenant:       new("entraidTenant"),
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Twitter: &model.ConfigAuthMethodOauthTwitter{
						Enabled:        new(true),
						ConsumerKey:    new("consumerkey"),
						ConsumerSecret: new("consumersecret"),
					},
					Windowslive: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: new("clientsecret"),
						Audience:     new("audience"),
					},
					Workos: &model.ConfigAuthMethodOauthWorkos{
						Connection:   new("connection"),
						Enabled:      new(true),
						ClientId:     new("clientid"),
						Organization: new("organization"),
						ClientSecret: new("clientsecret"),
					},
				},
				Webauthn: &model.ConfigAuthMethodWebauthn{
					Enabled: new(true),
					RelyingParty: &model.ConfigAuthMethodWebauthnRelyingParty{
						Id:   new("example.com"),
						Name: new("name"),
						Origins: []string{
							"https://example.com",
						},
					},
					Attestation: &model.ConfigAuthMethodWebauthnAttestation{
						Timeout: new(uint32(60000)),
					},
				},
			},
			Totp: &model.ConfigAuthTotp{
				Enabled: new(true),
				Issuer:  new("issuer"),
			},
			RateLimit: &model.ConfigAuthRateLimit{
				Emails: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "5m",
				},
				Sms: &model.ConfigRateLimit{
					Limit:    10,
					Interval: "5m",
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
					Interval: "15m",
				},
				Oauth2Server: &model.ConfigRateLimit{
					Limit:    100,
					Interval: "5m",
				},
			},
			Oauth2Provider: &model.ConfigAuthOauth2Provider{
				Enabled: new(true),
				AccessToken: &model.ConfigAuthOauth2ProviderAccessToken{
					ExpiresIn: new(uint32(900)),
				},
				RefreshToken: &model.ConfigAuthOauth2ProviderRefreshToken{
					ExpiresIn: new(uint32(2592000)),
				},
				LoginURL: new("https://example.com/oauth2/login"),
				ClientIdMetadataDocument: &model.ConfigAuthOauth2ProviderClientIdMetadataDocument{
					Enabled: new(true),
				},
			},
		},
		Postgres: &model.ConfigPostgres{
			Version: new("14-20230312-1"),
			Resources: &model.ConfigPostgresResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    2000,
					Memory: 4096,
				},
				EnablePublicAccess: new(true),
				Storage: &model.ConfigPostgresResourcesStorage{
					Capacity: 20,
				},
				Replicas: nil,
			},
			Settings: &model.ConfigPostgresSettings{
				Jit:                           new("off"),
				MaxConnections:                new(int32(100)),
				SharedBuffers:                 new("128MB"),
				EffectiveCacheSize:            new("4GB"),
				MaintenanceWorkMem:            new("64MB"),
				CheckpointCompletionTarget:    new(float64(0.9)),
				WalBuffers:                    new("-1"),
				DefaultStatisticsTarget:       new(int32(100)),
				RandomPageCost:                new(float64(4)),
				EffectiveIOConcurrency:        new(int32(1)),
				WorkMem:                       new("4MB"),
				HugePages:                     new("try"),
				MinWalSize:                    new("80MB"),
				MaxWalSize:                    new("1GB"),
				MaxWorkerProcesses:            new(int32(8)),
				MaxParallelWorkersPerGather:   new(int32(2)),
				MaxParallelWorkers:            new(int32(8)),
				MaxParallelMaintenanceWorkers: new(int32(2)),
				WalLevel:                      new("replica"),
				MaxWalSenders:                 new(int32(10)),
				MaxReplicationSlots:           new(int32(10)),
				ArchiveTimeout:                new(int32(300)),
				TrackIoTiming:                 new("off"),
			},
			Pitr: &model.ConfigPostgresPitr{
				Retention: new(uint8(7)),
			},
		},
		Provider: &model.ConfigProvider{
			Smtp: &model.ConfigSmtp{
				User:     "smtpUser",
				Password: "smtpPassword",
				Sender:   "smtpSender",
				Host:     "smtpHost",
				Port:     587, //nolint:mnd
				Secure:   true,
				Method:   "LOGIN",
			},
			Sms: &model.ConfigSms{
				Provider:           new("twilio"),
				AccountSid:         "twilioAccountSid",
				AuthToken:          "twilioAuthToken",
				MessagingServiceId: "twilioMessagingServiceId",
			},
		},
		Storage: &model.ConfigStorage{
			Version: new("0.3.5"),
			Antivirus: &model.ConfigStorageAntivirus{
				Server: new("tcp://run-clamav:3310"),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 1024,
				},
				Networking: nil,
				Replicas:   new(uint8(1)),
				Autoscaler: nil,
			},
			RateLimit: &model.ConfigRateLimit{
				Limit:    100,
				Interval: "15m",
			},
		},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "grafanaAdminPassword",
				Smtp: &model.ConfigGrafanaSmtp{
					Host:     "localhost",
					Port:     25,
					Sender:   "admin@localhost",
					User:     "smtpUser",
					Password: "smtpPassword",
				},
				Alerting: &model.ConfigGrafanaAlerting{
					Enabled: new(true),
				},
				Contacts: &model.ConfigGrafanaContacts{
					Emails: []string{
						"engineering@acme.com",
					},
					Pagerduty: []*model.ConfigGrafanacontactsPagerduty{
						{
							IntegrationKey: "integration-key",
							Severity:       "critical",
							Class:          "infra",
							Component:      "backend",
							Group:          "group",
						},
					},
					Discord: []*model.ConfigGrafanacontactsDiscord{
						{
							Url:       "https://discord.com/api/webhooks/...",
							AvatarUrl: "https://discord.com/api/avatar/...",
						},
					},
					Slack: []*model.ConfigGrafanacontactsSlack{
						{
							Recipient: "recipient",
							Token:     "token",
							Username:  "username",
							IconEmoji: "danger",
							IconURL:   "https://...",
							MentionUsers: []string{
								"user1", "user2",
							},
							MentionGroups: []string{
								"group1", "group2",
							},
							MentionChannel: "channel",
							Url:            "https://slack.com/api/webhooks/...",
							EndpointURL:    "https://slack.com/api/endpoint/...",
						},
					},
					Webhook: []*model.ConfigGrafanacontactsWebhook{
						{
							Url:                      "https://webhook.example.com",
							HttpMethod:               "POST",
							Username:                 "user",
							Password:                 "password",
							AuthorizationScheme:      "Bearer",
							AuthorizationCredentials: "token",
							MaxAlerts:                10,
						},
					},
				},
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

	ce.Println("%s", b)

	return nil
}
