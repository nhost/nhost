package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/urfave/cli/v3"
)

func getJWTGetter(cmd *cli.Command, db controller.DBClient) (*controller.JWTGetter, error) {
	var (
		rawClaims map[string]string
		defaults  map[string]any
	)

	if cmd.String(flagCustomClaims) != "" {
		if err := json.Unmarshal([]byte(cmd.String(flagCustomClaims)), &rawClaims); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custom claims: %w", err)
		}
	}

	if cmd.String(flagCustomClaimsDefaults) != "" {
		if err := json.Unmarshal([]byte(cmd.String(flagCustomClaimsDefaults)), &defaults); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custom claims defaults: %w", err)
		}
	}

	var (
		customClaimer controller.CustomClaimer
		err           error
	)

	if len(rawClaims) > 0 {
		customClaimer, err = controller.NewCustomClaims(
			rawClaims,
			&http.Client{}, //nolint:exhaustruct
			cmd.String(flagGraphqlURL),
			defaults,
			controller.CustomClaimerAddAdminSecret(cmd.String(flagHasuraAdminSecret)),
		)
		if err != nil {
			return nil, fmt.Errorf("error creating custom claimer: %w", err)
		}
	}

	jwtGetter, err := controller.NewJWTGetter(
		[]byte(cmd.String(flagHasuraGraphqlJWTSecret)),
		time.Duration(cmd.Int(flagAccessTokensExpiresIn))*time.Second,
		customClaimer,
		cmd.String(flagRequireElevatedClaim),
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating jwt getter: %w", err)
	}

	return jwtGetter, nil
}
