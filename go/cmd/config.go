package cmd

import (
	"fmt"
	"net/url"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/urfave/cli/v2"
)

func getConfig(cCtx *cli.Context) (controller.Config, error) {
	serverURL, err := url.Parse(cCtx.String(flagServerURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing server url: %w", err)
	}

	clientURL, err := url.Parse(cCtx.String(flagClientURL))
	if err != nil {
		return controller.Config{}, fmt.Errorf("problem parsing client url: %w", err)
	}

	allowedRedirectURLs := make([]*url.URL, len(cCtx.StringSlice(flagAllowRedirectURLs)))
	for i, u := range cCtx.StringSlice(flagAllowRedirectURLs) {
		url, err := url.Parse(u)
		if err != nil {
			return controller.Config{}, fmt.Errorf("problem parsing allowed redirect url: %w", err)
		}

		allowedRedirectURLs[i] = url
	}

	return controller.Config{
		HasuraGraphqlURL:         cCtx.String(flagGraphqlURL),
		HasuraAdminSecret:        cCtx.String(flagHasuraAdminSecret),
		AllowedRedirectURLs:      allowedRedirectURLs,
		ClientURL:                clientURL,
		CustomClaims:             cCtx.String(flagCustomClaims),
		ConcealErrors:            cCtx.Bool(flagConcealErrors),
		DisableSignup:            cCtx.Bool(flagDisableSignup),
		DisableNewUsers:          cCtx.Bool(flagDisableNewUsers),
		DefaultAllowedRoles:      cCtx.StringSlice(flagDefaultAllowedRoles),
		DefaultRole:              cCtx.String(flagDefaultRole),
		DefaultLocale:            cCtx.String(flagDefaultLocale),
		AllowedLocales:           cCtx.StringSlice(flagAllowedLocales),
		GravatarEnabled:          cCtx.Bool(flagGravatarEnabled),
		GravatarDefault:          GetEnumValue(cCtx, flagGravatarDefault),
		GravatarRating:           cCtx.String(flagGravatarRating),
		PasswordMinLength:        cCtx.Int(flagPasswordMinLength),
		PasswordHIBPEnabled:      cCtx.Bool(flagPasswordHIBPEnabled),
		RefreshTokenExpiresIn:    cCtx.Int(flagRefreshTokenExpiresIn),
		AccessTokenExpiresIn:     cCtx.Int(flagAccessTokensExpiresIn),
		JWTSecret:                cCtx.String(flagHasuraGraphqlJWTSecret),
		RequireEmailVerification: cCtx.Bool(flagEmailSigninEmailVerifiedRequired),
		ServerURL:                serverURL,
	}, nil
}
