package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/urfave/cli/v2"
)

func getJWTGetter(cCtx *cli.Context, db controller.DBClient) (*controller.JWTGetter, error) {
	var rawClaims map[string]string
	var defaults map[string]any

	if cCtx.String(flagCustomClaims) != "" {
		if err := json.Unmarshal([]byte(cCtx.String(flagCustomClaims)), &rawClaims); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custom claims: %w", err)
		}
	}

	if cCtx.String(flagCustomClaimsDefaults) != "" {
		if err := json.Unmarshal([]byte(cCtx.String(flagCustomClaimsDefaults)), &defaults); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custom claims defaults: %w", err)
		}
	}

	var customClaimer controller.CustomClaimer
	var err error
	if len(rawClaims) > 0 {
		customClaimer, err = controller.NewCustomClaims(
			rawClaims,
			&http.Client{}, //nolint:exhaustruct
			cCtx.String(flagGraphqlURL),
			defaults,
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
		cCtx.String(flagRequireElevatedClaim),
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating jwt getter: %w", err)
	}

	return jwtGetter, nil
}
