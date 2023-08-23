package dockercompose //nolint:testpackage

import (
	"github.com/nhost/be/services/mimir/model"
)

func getConfig() *model.ConfigConfig { //nolint:maintidx
	return &model.ConfigConfig{
		Auth: &model.ConfigAuth{
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    1000,
					Memory: 300,
				},
				Replicas: 3,
			},
			Method: &model.ConfigAuthMethod{
				Anonymous: &model.ConfigAuthMethodAnonymous{
					Enabled: ptr(true),
				},
				EmailPassword: &model.ConfigAuthMethodEmailPassword{
					EmailVerificationRequired: ptr(true),
					HibpEnabled:               ptr(true),
					PasswordMinLength:         ptr(uint8(12)),
				},
				EmailPasswordless: &model.ConfigAuthMethodEmailPasswordless{
					Enabled: ptr(true),
				},
				Oauth: &model.ConfigAuthMethodOauth{
					Apple: &model.ConfigAuthMethodOauthApple{
						Enabled:    ptr(true),
						ClientId:   ptr("appleClientId"),
						KeyId:      ptr("appleKeyId"),
						TeamId:     ptr("appleTeamId"),
						Scope:      []string{},
						PrivateKey: ptr("applePrivateKey"),
					},
					Azuread: &model.ConfigAuthMethodOauthAzuread{
						ClientId:     ptr("azureadClientId"),
						ClientSecret: ptr("azureadClientSecret"),
						Enabled:      ptr(true),
						Tenant:       ptr("azureadTenant"),
					},
					Bitbucket: &model.ConfigStandardOauthProvider{
						ClientId:     ptr("bitbucketClientId"),
						ClientSecret: ptr("bitbucketClientSecret"),
						Enabled:      ptr(true),
					},
					Discord: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("discordClientId"),
						ClientSecret: ptr("discordClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"identify", "email"},
					},
					Facebook: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("facebookClientId"),
						ClientSecret: ptr("facebookClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"email"},
					},
					Github: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("githubClientId"),
						ClientSecret: ptr("githubClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"user:email"},
					},
					Gitlab: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("gitlabClientId"),
						ClientSecret: ptr("gitlabClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"read_user"},
					},
					Google: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("googleClientId"),
						ClientSecret: ptr("googleClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"openid", "profile", "email"},
					},
					Linkedin: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("linkedinClientId"),
						ClientSecret: ptr("linkedinClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"r_liteprofile", "r_emailaddress"},
					},
					Spotify: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("spotifyClientId"),
						ClientSecret: ptr("spotifyClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"user-read-email"},
					},
					Strava: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("stravaClientId"),
						ClientSecret: ptr("stravaClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"read_all"},
					},
					Twitch: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("twitchClientId"),
						ClientSecret: ptr("twitchClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"user:email"},
					},
					Twitter: &model.ConfigAuthMethodOauthTwitter{
						ConsumerKey:    ptr("twitterConsumerKey"),
						ConsumerSecret: ptr("twitterConsumerSecret"),
						Enabled:        ptr(true),
					},
					Windowslive: &model.ConfigStandardOauthProviderWithScope{
						ClientId:     ptr("windowsliveClientId"),
						ClientSecret: ptr("windowsliveClientSecret"),
						Enabled:      ptr(true),
						Scope:        []string{"wl.emails"},
					},
					Workos: &model.ConfigAuthMethodOauthWorkos{
						ClientId:     ptr("workosClientId"),
						ClientSecret: ptr("workosClientSecret"),
						Connection:   ptr("workosConnection"),
						Enabled:      ptr(true),
						Organization: ptr("workosOrganization"),
					},
				},
				SmsPasswordless: &model.ConfigAuthMethodSmsPasswordless{
					Enabled: ptr(true),
				},
				Webauthn: &model.ConfigAuthMethodWebauthn{
					Enabled: ptr(true),
					Attestation: &model.ConfigAuthMethodWebauthnAttestation{
						Timeout: ptr(uint32(60000)),
					},
					RelyingParty: &model.ConfigAuthMethodWebauthnRelyingParty{
						Name:    ptr("webauthnRelyingPartyName"),
						Origins: []string{"http://localhost:3000"},
					},
				},
			},
			Redirections: &model.ConfigAuthRedirections{
				AllowedUrls: []string{"http://localhost:3000"},
				ClientUrl:   ptr("http://localhost:3000"),
			},
			Session: &model.ConfigAuthSession{
				AccessToken: &model.ConfigAuthSessionAccessToken{
					CustomClaims: []*model.ConfigAuthsessionaccessTokenCustomClaims{
						{
							Key:   "customClaimKey",
							Value: "customClaimValue",
						},
					},
					ExpiresIn: ptr(uint32(900)),
				},
				RefreshToken: &model.ConfigAuthSessionRefreshToken{
					ExpiresIn: ptr(uint32(99)),
				},
			},
			SignUp: &model.ConfigAuthSignUp{
				Enabled: ptr(true),
			},
			Totp: &model.ConfigAuthTotp{
				Enabled: ptr(true),
				Issuer:  ptr("totpIssuer"),
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
					Enabled: ptr(true),
					Default: ptr("gravatarDefault"),
					Rating:  ptr("gravatarRating"),
				},
				Locale: &model.ConfigAuthUserLocale{
					Allowed: []string{"en", "se", "ca", "es"},
					Default: ptr("en"),
				},
				Roles: &model.ConfigAuthUserRoles{
					Default: ptr("user"),
					Allowed: []string{"user", "admin"},
				},
			},
			Version: ptr("0.13.1"),
		},
		Global: &model.ConfigGlobal{
			Environment: []*model.ConfigEnvironmentVariable{
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
				Version: ptr(16),
			},
		},
		Hasura: &model.ConfigHasura{
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    1000,
					Memory: 700,
				},
				Replicas: 3,
			},
			AdminSecret: "adminSecret",
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: ptr("HS256"),
					Key:  ptr("jwtSecretKey"),
					ClaimsMap: []*model.ConfigClaimMap{
						{Claim: "x-hasura-allowed-roles", Path: ptr("$.roles")},
						{Claim: "x-hasura-default-role", Value: ptr("viewer")},
						{Claim: "x-hasura-user-id", Path: ptr("$.sub")},
						{Claim: "x-hasura-org-id", Path: ptr("$.org"), Default: ptr("public")},
					},
				},
			},
			Settings: &model.ConfigHasuraSettings{
				CorsDomain:                    []string{"http://*.localhost"},
				DevMode:                       ptr(false),
				EnableAllowList:               ptr(true),
				EnableConsole:                 ptr(false),
				EnableRemoteSchemaPermissions: ptr(true),
				EnabledAPIs: []string{
					"metadata",
					"graphql",
					"config",
					"pgdump",
				},
			},
			Logs: &model.ConfigHasuraLogs{
				Level: ptr("info"),
			},
			Events: &model.ConfigHasuraEvents{
				HttpPoolSize: ptr(uint32(100)),
			},
			Version:       ptr("2.12.0"),
			WebhookSecret: "webhookSecret",
		},
		Postgres: &model.ConfigPostgres{
			Version: ptr("14.5-20220831-1"),
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    2000,
					Memory: 500,
				},
				Replicas: 1,
			},
		},
		Provider: &model.ConfigProvider{
			Sms: &model.ConfigSms{
				AccountSid:         "smsAccountSid",
				AuthToken:          "smsAuthToken",
				MessagingServiceId: "smsMessagingServiceId",
				Provider:           ptr("twilio"),
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
			Resources: &model.ConfigResources{
				Compute: &model.ConfigResourcesCompute{
					Cpu:    500,
					Memory: 50,
				},
				Replicas: 1,
			},
			Antivirus: &model.ConfigStorageAntivirus{
				Server: ptr("tcp://run-clamav:3310"),
			},
			Version: ptr("0.2.5"),
		},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "grafanaAdminPassword",
			},
		},
	}
}
