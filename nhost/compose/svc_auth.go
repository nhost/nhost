package compose

import (
	"encoding/json"
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/envvars"
	"path/filepath"
	"strings"
	"time"
)

func (c Config) authJwtCustomClaims() string {
	customClaims := c.nhostConfig.GetAuth().GetSession().GetAccessToken().GetCustomClaims()
	m := map[string]string{}
	for _, v := range customClaims {
		m[v.GetKey()] = v.GetValue()
	}
	jwtCustomClaims, _ := json.Marshal(m)
	return string(jwtCustomClaims)
}

func (c Config) authServiceEnvs() envvars.Env {
	authConf := c.nhostConfig.GetAuth()
	hasuraConf := c.nhostConfig.GetHasura()
	smtpSettings := c.smtpSettings()

	twilioAccountSid, twilioAuthToken, twilioMessagingServiceId := c.twilioSettings()

	envs := envvars.Env{
		"AUTH_HOST":                                 "0.0.0.0",
		"HASURA_GRAPHQL_DATABASE_URL":               c.postgresConnectionStringForUser("nhost_auth_admin"),
		"HASURA_GRAPHQL_GRAPHQL_URL":                "http://graphql:8080/v1/graphql",
		"AUTH_SERVER_URL":                           c.PublicAuthConnectionString(),
		"HASURA_GRAPHQL_JWT_SECRET":                 escapeDollarSignForDockerCompose(c.graphqlJwtSecret()),
		"HASURA_GRAPHQL_ADMIN_SECRET":               escapeDollarSignForDockerCompose(hasuraConf.GetAdminSecret()),
		"AUTH_SMTP_PASS":                            escapeDollarSignForDockerCompose(smtpSettings.GetPassword()),
		"AUTH_SMTP_HOST":                            smtpSettings.GetHost(),
		"AUTH_SMTP_USER":                            escapeDollarSignForDockerCompose(smtpSettings.GetUser()),
		"AUTH_SMTP_SENDER":                          escapeDollarSignForDockerCompose(smtpSettings.GetSender()),
		"AUTH_SMTP_AUTH_METHOD":                     smtpSettings.GetMethod(),
		"AUTH_SMTP_PORT":                            fmt.Sprint(smtpSettings.GetPort()),
		"AUTH_SMTP_SECURE":                          fmt.Sprint(smtpSettings.GetSecure()),
		"AUTH_SMS_PROVIDER":                         generichelper.DerefPtr(c.nhostConfig.GetProvider().GetSms().GetProvider()),
		"AUTH_SMS_TWILIO_ACCOUNT_SID":               twilioAccountSid,
		"AUTH_SMS_TWILIO_AUTH_TOKEN":                escapeDollarSignForDockerCompose(twilioAuthToken),
		"AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID":      twilioMessagingServiceId,
		"AUTH_WEBAUTHN_ENABLED":                     fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetWebauthn().GetEnabled())),
		"AUTH_WEBAUTHN_RP_NAME":                     generichelper.DerefPtr(authConf.GetMethod().GetWebauthn().GetRelyingParty().GetName()),
		"AUTH_WEBAUTHN_RP_ORIGINS":                  strings.Join(authConf.GetMethod().GetWebauthn().GetRelyingParty().GetOrigins(), ","),
		"AUTH_ANONYMOUS_USERS_ENABLED":              fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetAnonymous().GetEnabled())),
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS":        strings.Join(authConf.GetUser().GetEmail().GetAllowed(), ","),
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS": strings.Join(authConf.GetUser().GetEmailDomains().GetAllowed(), ","),
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS":        strings.Join(authConf.GetUser().GetEmail().GetBlocked(), ","),
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS": strings.Join(authConf.GetUser().GetEmailDomains().GetBlocked(), ","),
		"AUTH_PASSWORD_HIBP_ENABLED":                fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetEmailPassword().GetHibpEnabled())),
		"AUTH_EMAIL_PASSWORDLESS_ENABLED":           fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetEmailPasswordless().GetEnabled())),
		"AUTH_SMS_PASSWORDLESS_ENABLED":             fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetSmsPasswordless().GetEnabled())),
		"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS": strings.Join(authConf.GetRedirections().GetAllowedUrls(), ","),
		"AUTH_MFA_ENABLED":                          fmt.Sprint(generichelper.DerefPtr(authConf.GetTotp().GetEnabled())),
		"AUTH_MFA_TOTP_ISSUER":                      generichelper.DerefPtr(authConf.GetTotp().GetIssuer()),
		"AUTH_JWT_CUSTOM_CLAIMS":                    c.authJwtCustomClaims(),
	}

	if gravatar := authConf.GetUser().GetGravatar(); gravatar != nil {
		if gravatar.Enabled != nil {
			envs["AUTH_GRAVATAR_ENABLED"] = fmt.Sprint(generichelper.DerefPtr(gravatar.GetEnabled()))
		}

		if gravatar.Default != nil {
			envs["AUTH_GRAVATAR_DEFAULT"] = generichelper.DerefPtr(gravatar.GetDefault())
		}

		if gravatar.Rating != nil {
			envs["AUTH_GRAVATAR_RATING"] = generichelper.DerefPtr(gravatar.GetRating())
		}
	}

	if authConf.GetRedirections() != nil && authConf.GetRedirections().ClientUrl != nil {
		envs["AUTH_CLIENT_URL"] = generichelper.DerefPtr(authConf.GetRedirections().GetClientUrl())
	}

	if authConf.GetMethod().GetWebauthn().GetAttestation() != nil && authConf.GetMethod().GetWebauthn().GetAttestation().Timeout != nil {
		envs["AUTH_WEBAUTHN_ATTESTATION_TIMEOUT"] = fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetWebauthn().GetAttestation().GetTimeout()))
	}

	if authConf.GetSignUp() != nil && authConf.GetSignUp().Enabled != nil {
		envs["AUTH_DISABLE_NEW_USERS"] = fmt.Sprint(!generichelper.DerefPtr(authConf.GetSignUp().GetEnabled()))
	}

	if authConf.GetMethod().GetEmailPassword() != nil && authConf.GetMethod().GetEmailPassword().PasswordMinLength != nil {
		envs["AUTH_PASSWORD_MIN_LENGTH"] = fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetEmailPassword().GetPasswordMinLength()))
	}

	if user := authConf.GetUser(); user != nil {
		if user.GetRoles() != nil && user.GetRoles().Default != nil {
			envs["AUTH_USER_DEFAULT_ROLE"] = generichelper.DerefPtr(user.GetRoles().GetDefault())
		}

		if user.GetRoles() != nil && user.GetRoles().Allowed != nil {
			envs["AUTH_USER_DEFAULT_ALLOWED_ROLES"] = strings.Join(user.GetRoles().GetAllowed(), ",")
		}

		if user.GetLocale() != nil && user.GetLocale().Default != nil {
			envs["AUTH_LOCALE_DEFAULT"] = generichelper.DerefPtr(user.GetLocale().GetDefault())
		}

		if user.GetLocale() != nil && user.GetLocale().Allowed != nil {
			envs["AUTH_LOCALE_ALLOWED_LOCALES"] = strings.Join(user.GetLocale().GetAllowed(), ",")
		}
	}

	if authConf.GetMethod().GetEmailPassword() != nil && authConf.GetMethod().GetEmailPassword().EmailVerificationRequired != nil {
		envs["AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED"] = fmt.Sprint(generichelper.DerefPtr(authConf.GetMethod().GetEmailPassword().GetEmailVerificationRequired()))
	}

	if authConf.GetSession().GetAccessToken() != nil && authConf.GetSession().GetAccessToken().ExpiresIn != nil {
		envs["AUTH_ACCESS_TOKEN_EXPIRES_IN"] = fmt.Sprint(generichelper.DerefPtr(authConf.GetSession().GetAccessToken().GetExpiresIn()))
	}

	if authConf.GetSession().GetRefreshToken() != nil && authConf.GetSession().GetRefreshToken().ExpiresIn != nil {
		envs["AUTH_REFRESH_TOKEN_EXPIRES_IN"] = fmt.Sprint(generichelper.DerefPtr(authConf.GetSession().GetRefreshToken().GetExpiresIn()))
	}

	return envs.Merge(c.nhostSystemEnvs(), c.globalEnvs)
}

func (c Config) authService() *types.ServiceConfig {
	sslLabels := makeTraefikServiceLabels(
		SvcAuth,
		authPort,
		withTLS(),
		withHost(HostLocalAuthNhostRun),
		withPathPrefix("/v1"),
		withStripPrefix("/v1"),
	)

	// deprecated endpoints
	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcAuth,
		authPort,
		withPathPrefix("/v1/auth"),
		withStripPrefix("/v1/auth"),
	)

	return &types.ServiceConfig{
		Name:        SvcAuth,
		Image:       "nhost/hasura-auth:" + generichelper.DerefPtr(c.nhostConfig.GetAuth().GetVersion()),
		Environment: c.authServiceEnvs().ToDockerServiceConfigEnv(),
		Labels:      mergeTraefikServiceLabels(sslLabels, httpLabels).AsMap(),
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
			SvcGraphql: {
				Condition: types.ServiceConditionStarted,
			},
		},
		Restart:     types.RestartPolicyAlways,
		HealthCheck: c.authServiceHealthcheck(time.Second*3, time.Minute*5),
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: filepath.Join(nhost.DOT_NHOST_DIR, "custom"),
				Target: "/app/custom",
			},
			{
				Type:   types.VolumeTypeBind,
				Source: nhost.EMAILS_DIR,
				Target: "/app/email-templates",
			},
		},
	}
}

func (c Config) authServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)
	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", "wget http://localhost:4000/healthz -q -O - > /dev/null 2>&1"},
		Interval:    &i,
		StartPeriod: &s,
	}
}
