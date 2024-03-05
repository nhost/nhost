package cmd

import (
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/urfave/cli/v2"
)

func getJWTGetter(cCtx *cli.Context) (*controller.JWTGetter, error) {
	var customClaimer controller.CustomClaimer
	var err error
	if cCtx.String(flagCustomClaims) != "" {
		customClaimer, err = controller.NewCustomClaims(
			cCtx.String(flagCustomClaims),
			&http.Client{}, //nolint:exhaustruct
			cCtx.String(flagGraphqlURL),
			controller.CustomClaimerAddAdminSecret(cCtx.String(flagHasuraAdminSecret)),
		)
		if err != nil {
			return nil, fmt.Errorf("error creating custom claimer: %w", err)
		}
	}

	jwtGetter, err := controller.NewJWTGetter(
		[]byte(cCtx.String(flagHasuraGraphqlJWTSecret)),
		time.Duration(cCtx.Int(flagAccessTokensExpiresIn))*time.Second,
		customClaimer,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating jwt getter: %w", err)
	}

	return jwtGetter, nil
}
