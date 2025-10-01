package run

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const flagImage = "image"

func CommandConfigEditImage() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-edit-image",
		Aliases: []string{},
		Usage:   "Edits configuration file and sets the image",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfig,
				Aliases: []string{},
				Usage:   "Service configuration file",
				Value:   "nhost-run-service.toml",
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_CONFIG"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagImage,
				Aliases:  []string{},
				Usage:    "Image to use",
				Required: true,
				Sources:  cli.EnvVars("NHOST_RUN_SERVICE_IMAGE"),
			},
		},
		Action: commandConfigEditImage,
	}
}

func commandConfigEditImage(ctx context.Context, cmd *cli.Command) error {
	var cfg model.ConfigRunServiceConfig
	if err := clienv.UnmarshalFile(cmd.String(flagConfig), &cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	cfg.Image.Image = cmd.String(flagImage)

	if err := clienv.MarshalFile(cfg, cmd.String(flagConfig), toml.Marshal); err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	return nil
}
