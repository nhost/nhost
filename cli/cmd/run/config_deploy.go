package run

import (
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
)

func CommandConfigDeploy() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-deploy",
		Aliases: []string{},
		Usage:   "Deploy service configuration",
		Action:  commandConfigDeploy,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagConfig,
				Aliases:  []string{},
				Usage:    "Service configuration file",
				Value:    "nhost-run-service.toml",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_CONFIG"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagServiceID,
				Usage:    "Service ID to update. Applies overlay of the same name",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_ID"},
			},
		},
	}
}

func transform[T, V any](t *T) (*V, error) {
	b, err := json.Marshal(t)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal: %w", err)
	}

	var v V
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, fmt.Errorf("failed to unmarshal: %w", err)
	}

	return &v, nil
}

func commandConfigDeploy(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	secrets, appID, err := getRemoteSecrets(cCtx.Context, cl, cCtx.String(flagServiceID))
	if err != nil {
		return err
	}

	cfg, err := Validate(
		ce,
		cCtx.String(flagConfig),
		cCtx.String(flagServiceID),
		secrets,
		true,
	)
	if err != nil {
		return err
	}

	replaceConfig, err := transform[model.ConfigRunServiceConfig, graphql.ConfigRunServiceConfigInsertInput](
		cfg,
	)
	if err != nil {
		return fmt.Errorf("failed to transform configuration into replace input: %w", err)
	}

	if _, err := cl.ReplaceRunServiceConfig(
		cCtx.Context,
		appID,
		cCtx.String(flagServiceID),
		*replaceConfig,
	); err != nil {
		return fmt.Errorf("failed to replace service config: %w", err)
	}

	ce.Infoln("Service configuration replaced")

	return nil
}
