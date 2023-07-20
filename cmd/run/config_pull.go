package run

import (
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const flagServiceID = "service-id"

func CommandConfigPull() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-pull",
		Aliases: []string{},
		Usage:   "Download service configuration",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagConfig,
				Aliases:  []string{},
				Usage:    "Service configuration file",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_CONFIG"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagServiceID,
				Usage:    "Service ID to update",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_ID"},
			},
		},
		Action: commandConfigPull,
	}
}

func commandConfigPull(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)
	session, err := ce.LoadSession(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	cl := ce.GetNhostClient()

	appID, err := getAppIDFromServiceID(cCtx.Context, cl, session, cCtx.String(flagServiceID))
	if err != nil {
		return err
	}

	resp, err := cl.GetRunServiceConfigRawJSON(
		cCtx.Context,
		appID,
		cCtx.String(flagServiceID),
		false,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get service config: %w", err)
	}

	var v model.ConfigRunServiceConfig
	if err := json.Unmarshal([]byte(resp.RunServiceConfigRawJSON), &v); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if err := clienv.MarshalFile(v, cCtx.String(flagConfig), toml.Marshal); err != nil {
		return fmt.Errorf("failed to save config to file: %w", err)
	}

	return nil
}
