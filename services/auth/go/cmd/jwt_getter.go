package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/auth/go/controller"
)

func getJWTGetter(opts Options, db controller.DBClient) (*controller.JWTGetter, error) {
	var (
		rawClaims map[string]string
		defaults  map[string]any
	)

	if opts.JWT.CustomClaims != "" {
		if err := json.Unmarshal([]byte(opts.JWT.CustomClaims), &rawClaims); err != nil {
			return nil, fmt.Errorf("failed to unmarshal custom claims: %w", err)
		}
	}

	if opts.JWT.CustomClaimsDefaults != "" {
		if err := json.Unmarshal(
			[]byte(opts.JWT.CustomClaimsDefaults),
			&defaults,
		); err != nil {
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
			opts.HasuraGraphqlURL,
			defaults,
			controller.CustomClaimerAddAdminSecret(opts.HasuraAdminSecret),
		)
		if err != nil {
			return nil, fmt.Errorf("error creating custom claimer: %w", err)
		}
	}

	jwtGetter, err := controller.NewJWTGetter(
		[]byte(opts.JWT.Secret),
		time.Duration(opts.JWT.AccessTokenExpiresIn)*time.Second,
		customClaimer,
		opts.JWT.RequireElevatedClaim,
		db,
		opts.ServerURL,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating jwt getter: %w", err)
	}

	return jwtGetter, nil
}
