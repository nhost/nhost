package dockercompose //nolint:testpackage

import (
	"github.com/nhost/be/services/mimir/model"
)

func getConfig() *model.ConfigConfig { //nolint:maintidx
	return &model.ConfigConfig{
		Graphql: nil,
		Ai: &model.ConfigAI{
			Version: new("0.2.5"),
			Resources: &model.ConfigAIResources{
				Compute: &model.ConfigComputeResources{
					Cpu:    128,
					Memory: 256,
				},
			},
			Openai: &model.ConfigAIOpenai{
				Organization: new("my-org"),
				ApiKey:       "openaiApiKey",
			},
			AutoEmbeddings: &model.ConfigAIAutoEmbeddings{
				SynchPeriodMinutes: new(uint32(10)),
			},
			WebhookSecret: "webhookSecret",
		},
		Auth: &model.ConfigAuth{
			Misc: &model.ConfigAuthMisc{
				ConcealErrors: new(true),
			},
			ElevatedPrivileges: &model.ConfigAuthElevatedPrivileges{
				Mode: new("required"),
			},
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    1000,
					Memory: 300,
				},
				Replicas:   new(uint8(3)),
				Networking: nil,
				Autoscaler: nil,
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
			Method: &model.ConfigAuthMethod{
				Anonymous: &model.ConfigAuthMethodAnonymous{
					Enabled: new(true),
				},
				Otp: &model.ConfigAuthMethodOtp{
					Email: &model.ConfigAuthMethodOtpEmail{
						Enabled: new(true),
					},
				},
				EmailPassword: &model.ConfigAuthMethodEmailPassword{
					EmailVerificationRequired: new(true),
					HibpEnabled:               new(true),
					PasswordMinLength:         new(uint8(12)),
				},
				EmailPasswordless: &model.ConfigAuthMethodEmailPasswordless{
					Enabled: new(true),
				},
				Oauth: &model.ConfigAuthMethodOauth{
					Apple: &model.ConfigAuthMethodOauthApple{
						Enabled:    new(true),
						ClientId:   new("appleClientId"),
						KeyId:      new("appleKeyId"),
						TeamId:     new("appleTeamId"),
						Scope:      []string{},
						PrivateKey: new("applePrivateKey"),
						Audience:   new("audience"),
					},
					Azuread: &model.ConfigAuthMethodOauthAzuread{
						ClientId:     new("azureadClientId"),
						ClientSecret: new("azureadClientSecret"),
						Enabled:      new(true),
						Tenant:       new("azureadTenant"),
					},
					Bitbucket: &model.ConfigStandardOauthProvider{
						ClientId:     new("bitbucketClientId"),
						ClientSecret: new("bitbucketClientSecret"),
						Enabled:      new(true),
					},
					Discord: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("discordClientId"),
						ClientSecret: new("discordClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"identify", "email"},
						Audience:     new("audience"),
					},
					Entraid: &model.ConfigAuthMethodOauthEntraid{
						ClientId:     new("entraidClientId"),
						ClientSecret: new("entraidClientSecret"),
						Enabled:      new(true),
						Tenant:       new("entraidTenant"),
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("facebookClientId"),
						ClientSecret: new("facebookClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"email"},
						Audience:     new("audience"),
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("githubClientId"),
						ClientSecret: new("githubClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"user:email"},
						Audience:     new("audience"),
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("gitlabClientId"),
						ClientSecret: new("gitlabClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"read_user"},
						Audience:     new("audience"),
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("googleClientId"),
						ClientSecret: new("googleClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"openid", "profile", "email"},
						Audience:     new("audience"),
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("linkedinClientId"),
						ClientSecret: new("linkedinClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"r_liteprofile", "r_emailaddress"},
						Audience:     new("audience"),
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("spotifyClientId"),
						ClientSecret: new("spotifyClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"user-read-email"},
						Audience:     new("audience"),
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("stravaClientId"),
						ClientSecret: new("stravaClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"read_all"},
						Audience:     new("audience"),
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("twitchClientId"),
						ClientSecret: new("twitchClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"user:email"},
						Audience:     new("audience"),
					},
					Twitter: &model.ConfigAuthMethodOauthTwitter{
						ConsumerKey:    new("twitterConsumerKey"),
						ConsumerSecret: new("twitterConsumerSecret"),
						Enabled:        new(true),
					},
					Windowslive: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     new("windowsliveClientId"),
						ClientSecret: new("windowsliveClientSecret"),
						Enabled:      new(true),
						Scope:        []string{"wl.emails"},
						Audience:     new("audience"),
					},
					Workos: &model.ConfigAuthMethodOauthWorkos{
						ClientId:     new("workosClientId"),
						ClientSecret: new("workosClientSecret"),
						Connection:   new("workosConnection"),
						Enabled:      new(true),
						Organization: new("workosOrganization"),
					},
				},
				SmsPasswordless: &model.ConfigAuthMethodSmsPasswordless{
					Enabled: new(true),
				},
				Webauthn: &model.ConfigAuthMethodWebauthn{
					Enabled: new(true),
					Attestation: &model.ConfigAuthMethodWebauthnAttestation{
						Timeout: new(uint32(60000)),
					},
					RelyingParty: &model.ConfigAuthMethodWebauthnRelyingParty{
						Id:      new("webauthnRelyingPartyId"),
						Name:    new("webauthnRelyingPartyName"),
						Origins: []string{"http://localhost:3000"},
					},
				},
			},
			Redirections: &model.ConfigAuthRedirections{
				AllowedUrls: []string{"http://localhost:3000"},
				ClientUrl:   new("http://localhost:3000"),
			},
			Session: &model.ConfigAuthSession{
				AccessToken: &model.ConfigAuthSessionAccessToken{
					CustomClaims: []*model.ConfigAuthsessionaccessTokenCustomClaims{
						{
							Key:   "customClaimKey",
							Value: "customClaimValue",
						},
					},
					ExpiresIn: new(uint32(900)),
				},
				RefreshToken: &model.ConfigAuthSessionRefreshToken{
					ExpiresIn: new(uint32(99)),
				},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled:         new(true),
				DisableNewUsers: new(false),
				Turnstile: &model.ConfigAuthSignUpTurnstile{
					SecretKey: "turnstileSecretKey",
				},
			},
			Totp: &model.ConfigAuthTotp{
				Enabled: new(true),
				Issuer:  new("totpIssuer"),
			},
			User: &model.ConfigAuthUser{
				Email: &model.ConfigAuthUserEmail{
					Allowed: []string{"asd@asd.com"},
					Blocked: []string{"qwe@wqe.com"},
				},
				EmailDomains: &model.ConfigAuthUserEmailDomains{
					Allowed: []string{"asd.com"},
					Blocked: []string{"qwe.com"},
				},
				Gravatar: &model.ConfigAuthUserGravatar{
					Enabled: new(true),
					Default: new("gravatarDefault"),
					Rating:  new("gravatarRating"),
				},
				Locale: &model.ConfigAuthUserLocale{
					Allowed: []string{"en", "se", "ca", "es"},
					Default: new("en"),
				},
				Roles: &model.ConfigAuthUserRoles{
					Default: new("user"),
					Allowed: []string{"user", "admin"},
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
			Version: new("0.31.0"),
		},
		Global: &model.ConfigGlobal{
			Environment: []*model.ConfigGlobalEnvironmentVariable{
				{
					Name:  "ENV1",
					Value: "VALUE1",
				},
				{
					Name:  "ENV2",
					Value: "VALUE2",
				},
			},
		},
		Functions: &model.ConfigFunctions{
			Node: &model.ConfigFunctionsNode{
				Version: new(22),
			},
			RateLimit: nil,
			Resources: &model.ConfigFunctionsResources{
				Networking: &model.ConfigNetworking{
					Ingresses: []*model.ConfigIngress{
						{
							Fqdn: []string{"hasura.example.com"},
						},
					},
				},
			},
		},
		Hasura: &model.ConfigHasura{
			RateLimit: nil,
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    1000,
					Memory: 700,
				},
				Replicas:   new(uint8(3)),
				Networking: nil,
				Autoscaler: nil,
			},
			AdminSecret: "adminSecret",
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: new("HS256"),
					Key:  new("jwtSecretKey"),
					ClaimsMap: []*model.ConfigClaimMap{
						{Claim: "x-hasura-allowed-roles", Path: new("$.roles")},
						{Claim: "x-hasura-default-role", Value: new("viewer")},
						{Claim: "x-hasura-user-id", Path: new("$.sub")},
						{Claim: "x-hasura-org-id", Path: new("$.org"), Default: new("public")},
					},
				},
			},
			Settings: &model.ConfigHasuraSettings{
				CorsDomain:                    []string{"http://*.localhost"},
				DevMode:                       new(false),
				EnableAllowList:               new(true),
				EnableConsole:                 new(false),
				EnableRemoteSchemaPermissions: new(true),
				EnabledAPIs: []string{
					"metadata",
					"graphql",
					"config",
					"pgdump",
				},
				InferFunctionPermissions:              new(true),
				LiveQueriesMultiplexedRefetchInterval: new(uint32(1000)),
				StringifyNumericTypes:                 new(false),
			},
			AuthHook: nil,
			Logs: &model.ConfigHasuraLogs{
				Level: new("info"),
			},
			Events: &model.ConfigHasuraEvents{
				HttpPoolSize: new(uint32(100)),
			},
			Version:       new("2.12.0"),
			WebhookSecret: "webhookSecret",
		},
		Postgres: &model.ConfigPostgres{
			Version: new("14.5-20220831-1"),
			Resources: &model.ConfigPostgresResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    2000,
					Memory: 500,
				},
				EnablePublicAccess: new(false),
				Storage:            nil,
				Replicas:           nil,
			},
			Pitr:     nil,
			Settings: nil,
		},
		Provider: &model.ConfigProvider{
			Sms: &model.ConfigSms{
				AccountSid:         "smsAccountSid",
				AuthToken:          "smsAuthToken",
				MessagingServiceId: "smsMessagingServiceId",
				Provider:           new("twilio"),
			},
			Smtp: &model.ConfigSmtp{
				Host:     "smtpHost",
				Method:   "smtpMethod",
				Password: "smtpPassword",
				Port:     125,
				Secure:   true,
				Sender:   "smtpSender",
				User:     "smtpUser",
			},
		},
		Storage: &model.ConfigStorage{
			RateLimit: nil,
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 50,
				},
				Replicas:   new(uint8(1)),
				Networking: nil,
				Autoscaler: nil,
			},
			Antivirus: &model.ConfigStorageAntivirus{
				Server: new("tcp://run-clamav:3310"),
			},
			Version: new("0.2.5"),
		},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "grafanaAdminPassword",
				Smtp:          nil,
				Alerting:      &model.ConfigGrafanaAlerting{}, //nolint:exhaustruct
				Contacts:      &model.ConfigGrafanaContacts{}, //nolint:exhaustruct
			},
		},
	}
}
