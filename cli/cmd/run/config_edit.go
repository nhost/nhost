package run

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/urfave/cli/v3"
)

const flagEditor = "editor"

func CommandConfigEdit() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config-edit",
		Aliases: []string{},
		Usage:   "Edit service configuration",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagConfig,
				Aliases:  []string{},
				Usage:    "Service configuration file",
				Value:    "nhost-run-service.toml",
				Required: true,
				Sources:  cli.EnvVars("NHOST_RUN_SERVICE_CONFIG"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagEditor,
				Usage:   "Editor to use",
				Value:   "vim",
				Sources: cli.EnvVars("EDITOR"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagOverlayName,
				Usage:   "If specified, apply this overlay",
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_ID", "NHOST_SERVICE_OVERLAY_NAME"),
			},
		},
		Action: commandConfigEdit,
	}
}

func commandConfigEdit(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	overlayName := cmd.String(flagOverlayName)
	if overlayName == "" {
		if err := config.EditFile(
			ctx, cmd.String(flagEditor), cmd.String(flagConfig),
		); err != nil {
			return fmt.Errorf("failed to edit config: %w", err)
		}

		return nil
	}

	if err := os.MkdirAll(ce.Path.RunServiceOverlaysFolder(
		cmd.String(flagConfig),
	), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create json patches directory: %w", err)
	}

	tmpdir, err := os.MkdirTemp(os.TempDir(), "nhost-jsonpatch")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer os.RemoveAll(tmpdir)

	tmpfileName := filepath.Join(tmpdir, "nhost.toml")

	if err := config.CopyConfig[model.ConfigRunServiceConfig](
		cmd.String(flagConfig),
		tmpfileName,
		ce.Path.RunServiceOverlay(cmd.String(flagConfig), overlayName),
	); err != nil {
		return fmt.Errorf("failed to copy config: %w", err)
	}

	if err := config.EditFile(ctx, cmd.String(flagEditor), tmpfileName); err != nil {
		return fmt.Errorf("failed to edit config: %w", err)
	}

	if err := config.GenerateJSONPatch(
		cmd.String(flagConfig),
		tmpfileName,
		ce.Path.RunServiceOverlay(cmd.String(flagConfig), overlayName),
	); err != nil {
		return fmt.Errorf("failed to generate json patch: %w", err)
	}

	return nil
}
