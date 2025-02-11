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
			Version: ptr("0.3.0"),
			Resources: &model.ConfigAIResources{
				Compute: &model.ConfigComputeResources{
					Cpu:    256,
					Memory: 512,
				},
			},
			Openai: &model.ConfigAIOpenai{
				Organization: ptr("org-id"),
				ApiKey:       "opeanai-api-key",
			},
			AutoEmbeddings: &model.ConfigAIAutoEmbeddings{
				SynchPeriodMinutes: ptr(uint32(10)),
			},
			WebhookSecret: "this-is-a-webhook-secret",
		},
		Graphql: &model.ConfigGraphql{
			Security: &model.ConfigGraphqlSecurity{
				ForbidAminSecret: ptr(true),
				MaxDepthQueries:  ptr(uint(4)),
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
				InferFunctionPermissions:              ptr(true),
				LiveQueriesMultiplexedRefetchInterval: ptr(uint32(1000)),
				StringifyNumericTypes:                 ptr(false),
			},
			AuthHook: &model.ConfigHasuraAuthHook{
				Url:             "https://customauth.example.com/hook",
				Mode:            ptr("POST"),
				SendRequestBody: ptr(true),
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
				Replicas: ptr(uint8(1)),
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"hasura.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: ptr(
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
				Version: ptr(int(18)),
			},
			Resources: &model.ConfigFunctionsResources{
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"hasura.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: ptr(
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
			Version: ptr("0.25.0"),
			Misc: &model.ConfigAuthMisc{
				ConcealErrors: ptr(false),
			},
			ElevatedPrivileges: &model.ConfigAuthElevatedPrivileges{
				Mode: ptr("required"),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    250,
					Memory: 512,
				},
				Replicas: ptr(uint8(1)),
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"auth.example.com"},
							Tls: &model.ConfigIngressTls{
								ClientCA: ptr(
									"---BEGIN CERTIFICATE---\n...\n---END CERTIFICATE---",
								),
							},
						},
					},
				},
				Autoscaler: nil,
			},
			Redirections: &model.ConfigAuthRedirections{
				ClientUrl: ptr("https://example.com"),
				AllowedUrls: []string{
					"https://example.com",
				},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled:         ptr(true),
				DisableNewUsers: ptr(false),
				Turnstile: &model.ConfigAuthSignUpTurnstile{
					SecretKey: "turnstileSecretKey",
				},
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
				Otp: &model.ConfigAuthMethodOtp{
					Email: &model.ConfigAuthMethodOtpEmail{
						Enabled: ptr(true),
					},
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
						Audience:   ptr("audience"),
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
						Audience:     ptr("audience"),
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						Enabled:      ptr(true),
						ClientId:     ptr("clientid"),
						Scope:        []string{"scope"},
						ClientSecret: ptr("clientsecret"),
						Audience:     ptr("audience"),
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
						Audience:     ptr("audience"),
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
						Id:   ptr("example.com"),
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
			},
		},
		Postgres: &model.ConfigPostgres{
			Version: ptr("14-20230312-1"),
			Resources: &model.ConfigPostgresResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    2000,
					Memory: 4096,
				},
				EnablePublicAccess: ptr(true),
				Storage: &model.ConfigPostgresResourcesStorage{
					Capacity: 20,
				},
				Replicas: nil,
			},
			Settings: &model.ConfigPostgresSettings{
				Jit:                           ptr("off"),
				MaxConnections:                ptr(int32(100)),
				SharedBuffers:                 ptr("128MB"),
				EffectiveCacheSize:            ptr("4GB"),
				MaintenanceWorkMem:            ptr("64MB"),
				CheckpointCompletionTarget:    ptr(float64(0.9)),
				WalBuffers:                    ptr("-1"),
				DefaultStatisticsTarget:       ptr(int32(100)),
				RandomPageCost:                ptr(float64(4)),
				EffectiveIOConcurrency:        ptr(int32(1)),
				WorkMem:                       ptr("4MB"),
				HugePages:                     ptr("try"),
				MinWalSize:                    ptr("80MB"),
				MaxWalSize:                    ptr("1GB"),
				MaxWorkerProcesses:            ptr(int32(8)),
				MaxParallelWorkersPerGather:   ptr(int32(2)),
				MaxParallelWorkers:            ptr(int32(8)),
				MaxParallelMaintenanceWorkers: ptr(int32(2)),
				WalLevel:                      ptr("replica"),
				MaxWalSenders:                 ptr(int32(10)),
				MaxReplicationSlots:           ptr(int32(10)),
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
				Networking: nil,
				Replicas:   ptr(uint8(1)),
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
					Enabled: ptr(true),
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
