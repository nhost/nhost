package appconfig

import (
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

const (
	secretHasuraAuthGraphqlDatabaseURL      = "databaseUrl"
	secretHasuraAuthHasuraAdminSecret       = "adminSecret"
	secretHasuraAuthJWTSecret               = "jwtSecret"
	secretHasuraAuthGithubClientSecret      = "githubClientSecret" //nolint: gosec
	secretHasuraAuthGoogleClientSecret      = "googleClientSecret"
	secretHasuraAuthFacebookClientSecret    = "facebookClientSecret"
	secretHasuraAuthSpotifyClientSecret     = "spotifyClientSecret"
	secretHasuraAuthLinkedinClientSecret    = "linkedinClientSecret"
	secretHasuraAuthDiscordClientSecret     = "discordClientSecret"
	secretHasuraAuthTwitchClientSecret      = "twitchClientSecret"
	secretHasuraAuthWindowsLiveClientSecret = "windowsLiveClientSecret"
	secretHasuraAuthWorkOsClientSecret      = "workOsClientSecret"
	secretHasuraAuthTwitterConsumerSecret   = "twitterConsumerSecret"
	secretHasuraAuthAppleKeyID              = "appleKeyID"
	secretHasuraAuthApplePrivateKey         = "applePrivateKey"
	secretHasuraAuthAzureADClientSecret     = "azureADClientSecret"
	secretHasuraAuthGitlabClientSecret      = "gitlabClientSecret" //nolint: gosec
	secretHasuraAuthStravaClientSecret      = "stravaClientSecret" //nolint: gosec
	secretHasuraAuthBitbucketClientSecret   = "bitbucketClientSecret"
	secretHasuraAuthSMTPPassword            = "smtpPassword"
)

func HasuraAuthEnv( //nolint:funlen,cyclop,maintidx
	config *model.ConfigConfig,
	hasuraGraphqlURL,
	authServerURL,
	databaseURL string,
	smtpSettings *model.ConfigSmtp,
) ([]EnvVar, error) {
	customClaims := make(
		map[string]string,
		len(config.GetAuth().Session.AccessToken.CustomClaims),
	)
	for _, c := range config.GetAuth().Session.AccessToken.CustomClaims {
		customClaims[c.Key] = c.Value
	}

	authJwtCustomClaims, err := json.Marshal(customClaims)
	if err != nil {
		return nil, fmt.Errorf("problem marshalling auth jwt custom claims: %w", err)
	}

	jwtSecret, err := marshalJWT(config.GetHasura().GetJwtSecrets()[0])
	if err != nil {
		return nil, fmt.Errorf("could not marshal JWT secret: %w", err)
	}

	env := []EnvVar{
		{
			Name:       "HASURA_GRAPHQL_DATABASE_URL",
			SecretName: secretHasuraAuthGraphqlDatabaseURL,
			Value:      databaseURL,
			IsSecret:   true,
		},
		{
			Name:       "HASURA_GRAPHQL_ADMIN_SECRET",
			SecretName: secretHasuraAuthHasuraAdminSecret,
			Value:      config.GetHasura().GetAdminSecret(),
			IsSecret:   true,
		},
		{
			Name:       "HASURA_GRAPHQL_JWT_SECRET",
			SecretName: secretHasuraAuthJWTSecret,
			Value:      string(jwtSecret),
			IsSecret:   true,
		},
		{
			Name:  "HASURA_GRAPHQL_GRAPHQL_URL",
			Value: hasuraGraphqlURL,
		},
		{
			Name: "AUTH_ACCESS_TOKEN_EXPIRES_IN",
			Value: Stringify(
				unptr(
					config.GetAuth().
						GetSession().
						GetAccessToken().
						GetExpiresIn(),
				),
			),
		},
		{
			Name: "AUTH_REFRESH_TOKEN_EXPIRES_IN",
			Value: Stringify(
				unptr(
					config.
						GetAuth().
						GetSession().
						GetRefreshToken().
						GetExpiresIn(),
				),
			),
		},
		{
			Name:  "AUTH_SERVER_URL",
			Value: authServerURL,
		},
		{
			Name: "AUTH_CLIENT_URL",
			Value: unptr(
				config.GetAuth().GetRedirections().GetClientUrl(),
			),
		},
		{
			Name:  "AUTH_PORT",
			Value: "4000",
		},
		{
			Name:  "AUTH_HOST",
			Value: "0.0.0.0",
		},
		{
			Name:  "AUTH_API_PREFIX",
			Value: "/v1",
		},
		{
			Name: "AUTH_ANONYMOUS_USERS_ENABLED",
			Value: Stringify(
				unptr(
					config.
						GetAuth().
						GetMethod().
						GetAnonymous().
						GetEnabled(),
				),
			),
		},
		{
			Name:  "AUTH_USER_DEFAULT_ROLE",
			Value: *config.GetAuth().GetUser().GetRoles().GetDefault(),
		},
		{
			Name: "AUTH_PASSWORD_HIBP_ENABLED",
			Value: Stringify(
				*config.GetAuth().GetMethod().GetEmailPassword().GetHibpEnabled(),
			),
		},
		{
			Name: "AUTH_PASSWORD_MIN_LENGTH",
			Value: Stringify(
				*config.GetAuth().GetMethod().GetEmailPassword().GetPasswordMinLength(),
			),
		},
		{
			Name: "AUTH_USER_DEFAULT_ALLOWED_ROLES",
			Value: Stringify(
				config.GetAuth().GetUser().GetRoles().GetAllowed(),
			),
		},
		{
			Name:  "AUTH_MFA_ENABLED",
			Value: Stringify(*config.GetAuth().GetTotp().GetEnabled()),
		},
		{
			Name:  "AUTH_MFA_TOTP_ISSUER",
			Value: unptr(config.GetAuth().GetTotp().GetIssuer()),
		},
		{
			Name: "AUTH_LOCALE_DEFAULT",
			Value: unptr(
				config.GetAuth().GetUser().GetLocale().GetDefault(),
			),
		},
		{
			Name: "AUTH_LOCALE_ALLOWED_LOCALES",
			Value: Stringify(
				config.GetAuth().GetUser().GetLocale().GetAllowed(),
			),
		},
		{
			Name: "AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS",
			Value: Stringify(
				config.GetAuth().GetRedirections().GetAllowedUrls(),
			),
		},
		{
			Name: "AUTH_ACCESS_CONTROL_ALLOWED_EMAILS",
			Value: Stringify(
				config.GetAuth().GetUser().GetEmail().GetAllowed(),
			),
		},
		{
			Name: "AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS",
			Value: Stringify(
				config.GetAuth().GetUser().GetEmailDomains().GetAllowed(),
			),
		},
		{
			Name: "AUTH_ACCESS_CONTROL_BLOCKED_EMAILS",
			Value: Stringify(
				config.GetAuth().GetUser().GetEmail().GetBlocked(),
			),
		},
		{
			Name: "AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS",
			Value: Stringify(
				config.GetAuth().GetUser().GetEmailDomains().GetBlocked(),
			),
		},
		{
			Name:  "AUTH_JWT_CUSTOM_CLAIMS",
			Value: string(authJwtCustomClaims),
		},
		{
			Name: "AUTH_EMAIL_PASSWORDLESS_ENABLED",
			Value: Stringify(
				*config.GetAuth().GetMethod().GetEmailPasswordless().GetEnabled(),
			),
		},
		{
			Name: "AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED",
			Value: Stringify(
				*config.GetAuth().GetMethod().GetEmailPassword().GetEmailVerificationRequired(),
			),
		},
		{
			Name:  "AUTH_DISABLE_SIGNUP",
			Value: Stringify(!unptr(config.GetAuth().GetSignUp().GetEnabled())),
		},
		{
			Name: "AUTH_DISABLE_NEW_USERS",
			Value: Stringify(
				!unptr(config.GetAuth().GetSignUp().GetEnabled()) ||
					unptr(config.GetAuth().GetSignUp().GetDisableNewUsers()),
			),
		},
	}

	env = append(env, []EnvVar{
		{
			Name: "AUTH_GRAVATAR_ENABLED",
			Value: Stringify(
				unptr(
					config.GetAuth().GetUser().GetGravatar().GetEnabled(),
				),
			),
		},
	}...)
	if unptr(config.GetAuth().GetUser().GetGravatar().GetEnabled()) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_GRAVATAR_DEFAULT",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetUser().
							GetGravatar().
							GetDefault(),
					),
				),
			},
			{
				Name: "AUTH_GRAVATAR_RATING",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetUser().
							GetGravatar().
							GetRating(),
					),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetWebauthn().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_WEBAUTHN_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetWebauthn().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_WEBAUTHN_RP_NAME",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetWebauthn().
						GetRelyingParty().
						GetName(),
				),
			},
			{
				Name: "AUTH_WEBAUTHN_RP_ORIGINS",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetWebauthn().
						GetRelyingParty().
						GetOrigins(),
				),
			},
			{
				Name: "AUTH_WEBAUTHN_ATTESTATION_TIMEOUT",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetWebauthn().
							GetAttestation().
							GetTimeout(),
					),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetSmsPasswordless().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_SMS_PASSWORDLESS_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetSmsPasswordless().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_SMS_PROVIDER",
				Value: unptr(
					config.GetProvider().GetSms().GetProvider(),
				),
			},
			{
				Name:  "AUTH_SMS_TWILIO_ACCOUNT_SID",
				Value: config.GetProvider().GetSms().GetAccountSid(),
			},
			{
				Name:  "AUTH_SMS_TWILIO_AUTH_TOKEN",
				Value: config.GetProvider().GetSms().GetAuthToken(),
			},
			{
				Name: "AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID",
				Value: config.
					GetProvider().
					GetSms().
					GetMessagingServiceId(),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetGithub().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_GITHUB_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetGithub().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_GITHUB_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetGithub().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_GITHUB_CLIENT_SECRET",
				SecretName: secretHasuraAuthGithubClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetGithub().GetClientSecret(),
				),
				IsSecret: true,
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetGoogle().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_GOOGLE_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetGoogle().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_GOOGLE_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetGoogle().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_GOOGLE_CLIENT_SECRET",
				SecretName: secretHasuraAuthGoogleClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetGoogle().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_GOOGLE_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetGoogle().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetFacebook().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			// FACEBOOK
			{
				Name: "AUTH_PROVIDER_FACEBOOK_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetFacebook().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_FACEBOOK_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetFacebook().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET",
				SecretName: secretHasuraAuthFacebookClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetFacebook().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_FACEBOOK_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetFacebook().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetSpotify().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			// SPOTIFY
			{
				Name: "AUTH_PROVIDER_SPOTIFY_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetSpotify().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_SPOTIFY_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetSpotify().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET",
				SecretName: secretHasuraAuthSpotifyClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetSpotify().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_SPOTIFY_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetSpotify().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetLinkedin().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_LINKEDIN_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetLinkedin().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_LINKEDIN_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetLinkedin().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_LINKEDIN_CLIENT_SECRET",
				SecretName: secretHasuraAuthLinkedinClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetLinkedin().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_LINKEDIN_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetLinkedin().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetDiscord().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_DISCORD_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetDiscord().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_DISCORD_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetDiscord().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_DISCORD_CLIENT_SECRET",
				SecretName: secretHasuraAuthDiscordClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetDiscord().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_DISCORD_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetDiscord().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetTwitch().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_TWITCH_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetTwitch().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_TWITCH_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetTwitch().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_TWITCH_CLIENT_SECRET",
				SecretName: secretHasuraAuthTwitchClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetTwitch().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_TWITCH_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetTwitch().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.
			GetAuth().
			GetMethod().
			GetOauth().
			GetWindowslive().
			GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_WINDOWS_LIVE_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetWindowslive().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetWindowslive().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET",
				SecretName: secretHasuraAuthWindowsLiveClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetWindowslive().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_WINDOWS_LIVE_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetWindowslive().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetWorkos().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_WORKOS_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetWorkos().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_WORKOS_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetWorkos().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_WORKOS_CLIENT_SECRET",
				SecretName: secretHasuraAuthWorkOsClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetWorkos().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_WORKOS_DEFAULT_ORGANIZATION",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetWorkos().
						GetOrganization(),
				),
			},
			{
				Name: "AUTH_PROVIDER_WORKOS_DEFAULT_CONNECTION",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetWorkos().
						GetConnection(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetTwitter().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			// TWITTER
			{
				Name: "AUTH_PROVIDER_TWITTER_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetTwitter().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_TWITTER_CONSUMER_KEY",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetTwitter().
						GetConsumerKey(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_TWITTER_CONSUMER_SECRET",
				SecretName: secretHasuraAuthTwitterConsumerSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetTwitter().GetConsumerSecret(),
				),
				IsSecret: true,
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetApple().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_APPLE_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetApple().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_APPLE_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetApple().
						GetClientId(),
				),
			},
			{
				Name: "AUTH_PROVIDER_APPLE_TEAM_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetApple().
						GetTeamId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_APPLE_KEY_ID",
				SecretName: secretHasuraAuthAppleKeyID,
				Value:      unptr(config.GetAuth().GetMethod().GetOauth().GetApple().GetKeyId()),
				IsSecret:   true,
			},
			{
				Name:       "AUTH_PROVIDER_APPLE_PRIVATE_KEY",
				SecretName: secretHasuraAuthApplePrivateKey,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetApple().GetPrivateKey(),
				),
				IsSecret: true,
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetAzuread().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_AZUREAD_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetAzuread().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_AZUREAD_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetAzuread().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_AZUREAD_CLIENT_SECRET",
				SecretName: secretHasuraAuthAzureADClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetAzuread().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_AZUREAD_TENANT",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetAzuread().
						GetTenant(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetGitlab().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_GITLAB_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetGitlab().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_GITLAB_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetGitlab().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_GITLAB_CLIENT_SECRET",
				SecretName: secretHasuraAuthGitlabClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetGitlab().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_GITLAB_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetGitlab().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetStrava().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_STRAVA_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetStrava().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_STRAVA_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetStrava().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_STRAVA_CLIENT_SECRET",
				SecretName: secretHasuraAuthStravaClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetStrava().GetClientSecret(),
				),
				IsSecret: true,
			},
			{
				Name: "AUTH_PROVIDER_STRAVA_SCOPE",
				Value: Stringify(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetStrava().
						GetScope(),
				),
			},
		}...)
	}

	if unptr(
		config.GetAuth().GetMethod().GetOauth().GetBitbucket().GetEnabled(),
	) {
		env = append(env, []EnvVar{
			{
				Name: "AUTH_PROVIDER_BITBUCKET_ENABLED",
				Value: Stringify(
					unptr(
						config.
							GetAuth().
							GetMethod().
							GetOauth().
							GetBitbucket().
							GetEnabled(),
					),
				),
			},
			{
				Name: "AUTH_PROVIDER_BITBUCKET_CLIENT_ID",
				Value: unptr(
					config.
						GetAuth().
						GetMethod().
						GetOauth().
						GetBitbucket().
						GetClientId(),
				),
			},
			{
				Name:       "AUTH_PROVIDER_BITBUCKET_CLIENT_SECRET",
				SecretName: secretHasuraAuthBitbucketClientSecret,
				Value: unptr(
					config.GetAuth().GetMethod().GetOauth().GetBitbucket().GetClientSecret(),
				),
				IsSecret: true,
			},
		}...)
	}

	env = append(env, []EnvVar{
		{
			Name:  "AUTH_SMTP_HOST",
			Value: smtpSettings.GetHost(),
		},
		{
			Name: "AUTH_SMTP_SECURE",
			Value: Stringify(
				smtpSettings.GetSecure(),
			),
		},
		{
			Name: "AUTH_SMTP_PORT",
			Value: Stringify(
				smtpSettings.GetPort(),
			),
		},
		{
			Name:  "AUTH_SMTP_USER",
			Value: smtpSettings.GetUser(),
		},
		{
			Name:  "AUTH_SMTP_SENDER",
			Value: smtpSettings.GetSender(),
		},
		{
			Name:  "AUTH_SMTP_AUTH_METHOD",
			Value: smtpSettings.GetMethod(),
		},
		{
			Name:       "AUTH_SMTP_PASS",
			SecretName: secretHasuraAuthSMTPPassword,
			Value:      smtpSettings.GetPassword(),
			IsSecret:   true,
		},
	}...)

	for _, e := range config.GetGlobal().GetEnvironment() {
		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  e.Name,
			Value: e.Value,
		})
	}

	return env, nil
}
