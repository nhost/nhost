package run

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

func CommandConfigShow() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:        "config-show",
		Aliases:     []string{},
		Usage:       "Shows Run service configuration after resolving secrets",
		Description: "Note that this command will always use the local secrets, even if you specify subdomain",
		Action:      commandConfigShow,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfig,
				Aliases: []string{},
				Usage:   "Service configuration file",
				Value:   "nhost-run-service.toml",
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_CONFIG"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagOverlayName,
				Usage:   "If specified, apply this overlay",
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_ID", "NHOST_SERVICE_OVERLAY_NAME"),
			},
		},
	}
}

func commandConfigShow(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cfg, err := Validate(
		ce,
		cmd.String(flagConfig),
		cmd.String(flagOverlayName),
		secrets,
		false,
	)
	if err != nil {
		return err
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("error marshalling config: %w", err)
	}

	ce.Println("%s", b)

	return nil
}
