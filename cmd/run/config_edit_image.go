package run

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
)

const flagImage = "image"

func CommandConfigEditImage() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-edit-image",
		Aliases: []string{},
		Usage:   "Edits configuration file and sets the image",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagConfig,
				Aliases:  []string{},
				Usage:    "Service configuration file",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_CONFIG"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagImage,
				Aliases:  []string{},
				Usage:    "Image to use",
				Required: true,
				EnvVars:  []string{"NHOST_RUN_SERVICE_IMAGE"},
			},
		},
		Action: commandConfigEditImage,
	}
}

func commandConfigEditImage(cCtx *cli.Context) error {
	var cfg model.ConfigRunServiceConfig
	if err := clienv.UnmarshalFile(cCtx.String(flagConfig), &cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	cfg.Image.Image = cCtx.String(flagImage)

	if err := clienv.MarshalFile(cfg, cCtx.String(flagConfig), toml.Marshal); err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	return nil
}
