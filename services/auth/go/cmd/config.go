package cmd

import (
	"fmt"
	"net/url"
	"slices"

	"github.com/nhost/nhost/services/auth/go/controller"
)

func getConfig(opts Options) (controller.Config, error) { //nolint:funlen
	serverURL, err := url.Parse(opts.ServerURL)
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing server url: %w", err)
	}

	clientURL, err := url.Parse(opts.ClientURL)
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing client url: %w", err)
	}

	allowedRedirectURLs := make([]string, 0, len(opts.AllowedRedirectURLs))
	for _, u := range opts.AllowedRedirectURLs {
		if u == "" {
			continue
		}

		allowedRedirectURLs = append(allowedRedirectURLs, u)
	}

	defaultRole := opts.DefaultRole
	allowedRoles := slices.Clone(opts.DefaultAllowedRoles)

	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })
	if !slices.Contains(allowedRoles, defaultRole) {
		allowedRoles = append(allowedRoles, defaultRole)
	}

	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })

	defaultLocale := opts.DefaultLocale
	allowedLocales := slices.Clone(opts.AllowedLocales)

	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })
	if !slices.Contains(allowedLocales, defaultLocale) {
		allowedLocales = append(allowedLocales, defaultLocale)
	}

	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })

	allowedDomains := slices.Clone(opts.AllowedEmailDomains)
	allowedDomains = slices.DeleteFunc(allowedDomains, func(s string) bool { return s == "" })
	blockedDomains := slices.Clone(opts.BlockedEmailDomains)
	blockedDomains = slices.DeleteFunc(blockedDomains, func(s string) bool { return s == "" })
	allowedEmails := slices.Clone(opts.AllowedEmails)
	allowedEmails = slices.DeleteFunc(allowedEmails, func(s string) bool { return s == "" })
	blockedEmails := slices.Clone(opts.BlockedEmails)
	blockedEmails = slices.DeleteFunc(blockedEmails, func(s string) bool { return s == "" })

	webauhtnRPID := opts.Webauthn.RPID
	if webauhtnRPID == "" {
		webauhtnRPID = clientURL.Hostname()
	}

	webauhtnRPName := opts.Webauthn.RPName
	if webauhtnRPName == "" {
		webauhtnRPName = webauhtnRPID
	}

	webauhtnRPOrigins := slices.Clone(opts.Webauthn.RPOrigins)

	webauhtnRPOrigins = slices.DeleteFunc(webauhtnRPOrigins, func(s string) bool { return s == "" })
	if !slices.Contains(webauhtnRPOrigins, opts.ClientURL) {
		webauhtnRPOrigins = append(webauhtnRPOrigins, opts.ClientURL)
	}

	return controller.Config{
		AnonymousUsersEnabled:                    opts.AnonymousUsersEnabled,
		HasuraGraphqlURL:                         opts.HasuraGraphqlURL,
		HasuraAdminSecret:                        opts.HasuraAdminSecret,
		AllowedEmailDomains:                      allowedDomains,
		AllowedEmails:                            allowedEmails,
		AllowedRedirectURLs:                      allowedRedirectURLs,
		BlockedEmailDomains:                      blockedDomains,
		BlockedEmails:                            blockedEmails,
		ClientURL:                                clientURL,
		CustomClaims:                             opts.JWT.CustomClaims,
		CustomClaimsDefaults:                     opts.JWT.CustomClaimsDefaults,
		ConcealErrors:                            opts.ConcealErrors,
		DisableSignup:                            opts.DisableSignup,
		DisableNewUsers:                          opts.DisableNewUsers,
		DefaultAllowedRoles:                      allowedRoles,
		DefaultRole:                              defaultRole,
		DefaultLocale:                            defaultLocale,
		AllowedLocales:                           allowedLocales,
		GravatarEnabled:                          opts.Gravatar.Enabled,
		GravatarDefault:                          opts.Gravatar.Default,
		GravatarRating:                           opts.Gravatar.Rating,
		PasswordMinLength:                        opts.PasswordMinLength,
		PasswordHIBPEnabled:                      opts.PasswordHIBPEnabled,
		RefreshTokenExpiresIn:                    opts.JWT.RefreshTokenExpiresIn,
		AccessTokenExpiresIn:                     opts.JWT.AccessTokenExpiresIn,
		JWTSecret:                                opts.JWT.Secret,
		RequireEmailVerification:                 opts.RequireEmailVerification,
		ServerURL:                                serverURL,
		EmailPasswordlessEnabled:                 opts.EmailPasswordlessEnabled,
		WebauthnEnabled:                          opts.Webauthn.Enabled,
		WebauthnRPID:                             webauhtnRPID,
		WebauthnRPName:                           webauhtnRPName,
		WebauthnRPOrigins:                        webauhtnRPOrigins,
		WebauhtnAttestationTimeout:               opts.Webauthn.AttestationTimeout,
		OTPEmailEnabled:                          opts.OTPEmailEnabled,
		SMSPasswordlessEnabled:                   opts.SMS.PasswordlessEnabled,
		SMSProvider:                              opts.SMS.Provider,
		SMSTwilioAccountSid:                      opts.SMS.Twilio.AccountSID,
		SMSTwilioAuthToken:                       opts.SMS.Twilio.AuthToken,
		SMSTwilioMessagingServiceID:              opts.SMS.Twilio.MessagingServiceID,
		SMSModicaUsername:                        opts.SMS.Modica.Username,
		SMSModicaPassword:                        opts.SMS.Modica.Password,
		SMSGenericURL:                            opts.SMS.Generic.URL,
		SMSGenericContentType:                    opts.SMS.Generic.ContentType,
		SMSGenericHeaders:                        opts.SMS.Generic.Headers,
		SMSGenericTimeout:                        opts.SMS.Generic.Timeout,
		SMSGenericBodyTemplate:                   opts.SMS.Generic.BodyTemplate,
		MfaEnabled:                               opts.MFA.Enabled,
		ServerPrefix:                             opts.APIPrefix,
		DisableAutoSignup:                        opts.DisableAutoSignup,
		OAuth2ProviderEnabled:                    opts.OAuth2Provider.Enabled,
		OAuth2ProviderLoginURL:                   opts.OAuth2Provider.LoginURL,
		OAuth2ProviderAccessTokenTTL:             opts.OAuth2Provider.AccessTokenTTL,
		OAuth2ProviderRefreshTokenTTL:            opts.OAuth2Provider.RefreshTokenTTL,
		OAuth2ProviderCIMDEnabled:                opts.OAuth2Provider.CIMDEnabled,
		OAuth2ProviderCIMDAllowInsecureTransport: opts.OAuth2Provider.CIMDAllowInsecureTransport,
	}, nil
}
