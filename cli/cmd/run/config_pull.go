package run

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const flagServiceID = "service-id"

func CommandConfigPull() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-pull",
		Aliases: []string{},
		Usage:   "Download service configuration",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfig,
				Aliases: []string{},
				Usage:   "Service configuration file",
				Value:   "nhost-run-service.toml",
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_CONFIG"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagServiceID,
				Usage:    "Service ID to update",
				Required: true,
				Sources:  cli.EnvVars("NHOST_RUN_SERVICE_ID"),
			},
		},
		Action: commandConfigPull,
	}
}

func commandConfigPull(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	appID, err := getAppIDFromServiceID(ctx, cl, cmd.String(flagServiceID))
	if err != nil {
		return err
	}

	resp, err := cl.GetRunServiceConfigRawJSON(
		ctx,
		appID,
		cmd.String(flagServiceID),
		false,
	)
	if err != nil {
		return fmt.Errorf("failed to get service config: %w", err)
	}

	var v model.ConfigRunServiceConfig
	if err := json.Unmarshal([]byte(resp.RunServiceConfigRawJSON), &v); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if err := clienv.MarshalFile(v, cmd.String(flagConfig), toml.Marshal); err != nil {
		return fmt.Errorf("failed to save config to file: %w", err)
	}

	return nil
}
