package cmd

import (
	"fmt"
	"net/url"
	"slices"

	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/urfave/cli/v3"
)

func getConfig(cmd *cli.Command) (controller.Config, error) { //nolint:funlen
	serverURL, err := url.Parse(cmd.String(flagServerURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing server url: %w", err)
	}

	clientURL, err := url.Parse(cmd.String(flagClientURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing client url: %w", err)
	}

	allowedRedirectURLs := make([]string, 0, len(cmd.StringSlice(flagAllowRedirectURLs)))
	for _, u := range cmd.StringSlice(flagAllowRedirectURLs) {
		if u == "" {
			continue
		}

		allowedRedirectURLs = append(allowedRedirectURLs, u)
	}

	defaultRole := cmd.String(flagDefaultRole)
	allowedRoles := cmd.StringSlice(flagDefaultAllowedRoles)

	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })
	if !slices.Contains(allowedRoles, defaultRole) {
		allowedRoles = append(allowedRoles, defaultRole)
	}

	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })

	defaultLocale := cmd.String(flagDefaultLocale)
	allowedLocales := cmd.StringSlice(flagAllowedLocales)

	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })
	if !slices.Contains(allowedLocales, defaultLocale) {
		allowedLocales = append(allowedLocales, defaultLocale)
	}

	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })

	allowedDomains := cmd.StringSlice(flagAllowedEmailDomains)
	allowedDomains = slices.DeleteFunc(allowedDomains, func(s string) bool { return s == "" })
	blockedDomains := cmd.StringSlice(flagBlockedEmailDomains)
	blockedDomains = slices.DeleteFunc(blockedDomains, func(s string) bool { return s == "" })
	allowedEmails := cmd.StringSlice(flagAllowedEmails)
	allowedEmails = slices.DeleteFunc(allowedEmails, func(s string) bool { return s == "" })
	blockedEmails := cmd.StringSlice(flagBlockedEmails)
	blockedEmails = slices.DeleteFunc(blockedEmails, func(s string) bool { return s == "" })

	webauhtnRPID := cmd.String(flagWebauthnRPID)
	if webauhtnRPID == "" {
		webauhtnRPID = clientURL.Hostname()
	}

	webauhtnRPName := cmd.String(flagWebauhtnRPName)
	if webauhtnRPName == "" {
		webauhtnRPName = webauhtnRPID
	}

	webauhtnRPOrigins := cmd.StringSlice(flagWebauthnRPOrigins)

	webauhtnRPOrigins = slices.DeleteFunc(webauhtnRPOrigins, func(s string) bool { return s == "" })
	if !slices.Contains(webauhtnRPOrigins, cmd.String(flagClientURL)) {
		webauhtnRPOrigins = append(webauhtnRPOrigins, cmd.String(flagClientURL))
	}

	return controller.Config{
		AnonymousUsersEnabled:         cmd.Bool(flagAnonymousUsersEnabled),
		HasuraGraphqlURL:              cmd.String(flagGraphqlURL),
		HasuraAdminSecret:             cmd.String(flagHasuraAdminSecret),
		AllowedEmailDomains:           allowedDomains,
		AllowedEmails:                 allowedEmails,
		AllowedRedirectURLs:           allowedRedirectURLs,
		BlockedEmailDomains:           blockedDomains,
		BlockedEmails:                 blockedEmails,
		ClientURL:                     clientURL,
		CustomClaims:                  cmd.String(flagCustomClaims),
		CustomClaimsDefaults:          cmd.String(flagCustomClaimsDefaults),
		ConcealErrors:                 cmd.Bool(flagConcealErrors),
		DisableSignup:                 cmd.Bool(flagDisableSignup),
		DisableNewUsers:               cmd.Bool(flagDisableNewUsers),
		DefaultAllowedRoles:           allowedRoles,
		DefaultRole:                   defaultRole,
		DefaultLocale:                 defaultLocale,
		AllowedLocales:                allowedLocales,
		GravatarEnabled:               cmd.Bool(flagGravatarEnabled),
		GravatarDefault:               cmd.String(flagGravatarDefault),
		GravatarRating:                cmd.String(flagGravatarRating),
		PasswordMinLength:             cmd.Int(flagPasswordMinLength),
		PasswordHIBPEnabled:           cmd.Bool(flagPasswordHIBPEnabled),
		RefreshTokenExpiresIn:         cmd.Int(flagRefreshTokenExpiresIn),
		AccessTokenExpiresIn:          cmd.Int(flagAccessTokensExpiresIn),
		JWTSecret:                     cmd.String(flagHasuraGraphqlJWTSecret),
		RequireEmailVerification:      cmd.Bool(flagEmailSigninEmailVerifiedRequired),
		ServerURL:                     serverURL,
		EmailPasswordlessEnabled:      cmd.Bool(flagEmailPasswordlessEnabled),
		WebauthnEnabled:               cmd.Bool(flagWebauthnEnabled),
		WebauthnRPID:                  webauhtnRPID,
		WebauthnRPName:                webauhtnRPName,
		WebauthnRPOrigins:             webauhtnRPOrigins,
		WebauhtnAttestationTimeout:    cmd.Duration(flagWebauthnAttestationTimeout),
		OTPEmailEnabled:               cmd.Bool(flagOTPEmailEnabled),
		SMSPasswordlessEnabled:        cmd.Bool(flagSMSPasswordlessEnabled),
		SMSProvider:                   cmd.String(flagSMSProvider),
		SMSTwilioAccountSid:           cmd.String(flagSMSTwilioAccountSid),
		SMSTwilioAuthToken:            cmd.String(flagSMSTwilioAuthToken),
		SMSTwilioMessagingServiceID:   cmd.String(flagSMSTwilioMessagingServiceID),
		SMSModicaUsername:             cmd.String(flagSMSModicaUsername),
		SMSModicaPassword:             cmd.String(flagSMSModicaPassword),
		MfaEnabled:                    cmd.Bool(flagMfaEnabled),
		ServerPrefix:                  cmd.String(flagAPIPrefix),
		OAuth2ProviderEnabled:         cmd.Bool(flagOAuth2ProviderEnabled),
		OAuth2ProviderLoginURL:        cmd.String(flagOAuth2ProviderLoginURL),
		OAuth2ProviderAccessTokenTTL:  cmd.Int(flagOAuth2ProviderAccessTokenTTL),
		OAuth2ProviderRefreshTokenTTL: cmd.Int(flagOAuth2ProviderRefreshTokenTTL),
		OAuth2ProviderCIMDEnabled:     cmd.Bool(flagOAuth2ProviderCIMDEnabled),
		OAuth2ProviderCIMDAllowInsecureTransport: cmd.Bool(
			flagOAuth2ProviderCIMDAllowInsecureTransport,
		),
	}, nil
}
