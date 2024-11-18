package cmd

import (
	"fmt"
	"net/url"
	"slices"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/urfave/cli/v2"
)

func getConfig(cCtx *cli.Context) (controller.Config, error) { //nolint:funlen
	serverURL, err := url.Parse(cCtx.String(flagServerURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing server url: %w", err)
	}

	clientURL, err := url.Parse(cCtx.String(flagClientURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing client url: %w", err)
	}

	allowedRedirectURLs := make([]string, 0, len(cCtx.StringSlice(flagAllowRedirectURLs)))
	for _, u := range cCtx.StringSlice(flagAllowRedirectURLs) {
		if u == "" {
			continue
		}

		allowedRedirectURLs = append(allowedRedirectURLs, u)
	}

	defaultRole := cCtx.String(flagDefaultRole)
	allowedRoles := cCtx.StringSlice(flagDefaultAllowedRoles)
	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })
	if !slices.Contains(allowedRoles, defaultRole) {
		allowedRoles = append(allowedRoles, defaultRole)
	}
	allowedRoles = slices.DeleteFunc(allowedRoles, func(s string) bool { return s == "" })

	defaultLocale := cCtx.String(flagDefaultLocale)
	allowedLocales := cCtx.StringSlice(flagAllowedLocales)
	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })
	if !slices.Contains(allowedLocales, defaultLocale) {
		allowedLocales = append(allowedLocales, defaultLocale)
	}
	allowedLocales = slices.DeleteFunc(allowedLocales, func(s string) bool { return s == "" })

	allowedDomains := cCtx.StringSlice(flagAllowedEmailDomains)
	allowedDomains = slices.DeleteFunc(allowedDomains, func(s string) bool { return s == "" })
	blockedDomains := cCtx.StringSlice(flagBlockedEmailDomains)
	blockedDomains = slices.DeleteFunc(blockedDomains, func(s string) bool { return s == "" })
	allowedEmails := cCtx.StringSlice(flagAllowedEmails)
	allowedEmails = slices.DeleteFunc(allowedEmails, func(s string) bool { return s == "" })
	blockedEmails := cCtx.StringSlice(flagBlockedEmails)
	blockedEmails = slices.DeleteFunc(blockedEmails, func(s string) bool { return s == "" })

	webauhtnRPID := cCtx.String(flagWebauthnRPID)
	if webauhtnRPID == "" {
		webauhtnRPID = clientURL.Hostname()
	}

	webauhtnRPName := cCtx.String(flagWebauhtnRPName)
	if webauhtnRPName == "" {
		webauhtnRPName = webauhtnRPID
	}

	webauhtnRPOrigins := cCtx.StringSlice(flagWebauthnRPOrigins)
	webauhtnRPOrigins = slices.DeleteFunc(webauhtnRPOrigins, func(s string) bool { return s == "" })
	if !slices.Contains(webauhtnRPOrigins, cCtx.String(flagClientURL)) {
		webauhtnRPOrigins = append(webauhtnRPOrigins, cCtx.String(flagClientURL))
	}

	return controller.Config{
		HasuraGraphqlURL:           cCtx.String(flagGraphqlURL),
		HasuraAdminSecret:          cCtx.String(flagHasuraAdminSecret),
		AllowedEmailDomains:        allowedDomains,
		AllowedEmails:              allowedEmails,
		AllowedRedirectURLs:        allowedRedirectURLs,
		BlockedEmailDomains:        blockedDomains,
		BlockedEmails:              blockedEmails,
		ClientURL:                  clientURL,
		CustomClaims:               cCtx.String(flagCustomClaims),
		ConcealErrors:              cCtx.Bool(flagConcealErrors),
		DisableSignup:              cCtx.Bool(flagDisableSignup),
		DisableNewUsers:            cCtx.Bool(flagDisableNewUsers),
		DefaultAllowedRoles:        allowedRoles,
		DefaultRole:                defaultRole,
		DefaultLocale:              defaultLocale,
		AllowedLocales:             allowedLocales,
		GravatarEnabled:            cCtx.Bool(flagGravatarEnabled),
		GravatarDefault:            GetEnumValue(cCtx, flagGravatarDefault),
		GravatarRating:             cCtx.String(flagGravatarRating),
		PasswordMinLength:          cCtx.Int(flagPasswordMinLength),
		PasswordHIBPEnabled:        cCtx.Bool(flagPasswordHIBPEnabled),
		RefreshTokenExpiresIn:      cCtx.Int(flagRefreshTokenExpiresIn),
		AccessTokenExpiresIn:       cCtx.Int(flagAccessTokensExpiresIn),
		JWTSecret:                  cCtx.String(flagHasuraGraphqlJWTSecret),
		RequireEmailVerification:   cCtx.Bool(flagEmailSigninEmailVerifiedRequired),
		ServerURL:                  serverURL,
		EmailPasswordlessEnabled:   cCtx.Bool(flagEmailPasswordlessEnabled),
		WebauthnEnabled:            cCtx.Bool(flagWebauthnEnabled),
		WebauthnRPID:               webauhtnRPID,
		WebauthnRPName:             webauhtnRPName,
		WebauthnRPOrigins:          webauhtnRPOrigins,
		WebauhtnAttestationTimeout: cCtx.Duration(flagWebauthnAttestationTimeout),
		OTPEmailEnabled:            cCtx.Bool(flagOTPEmailEnabled),
	}, nil
}
