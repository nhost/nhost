package run

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/urfave/cli/v2"
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
				EnvVars:  []string{"NHOST_RUN_SERVICE_CONFIG"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagEditor,
				Usage:   "Editor to use",
				Value:   "vim",
				EnvVars: []string{"EDITOR"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagOverlayName,
				Usage:   "If specified, apply this overlay",
				EnvVars: []string{"NHOST_RUN_SERVICE_ID", "NHOST_SERVICE_OVERLAY_NAME"},
			},
		},
		Action: commandConfigEdit,
	}
}

func commandConfigEdit(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	overlayName := cCtx.String(flagOverlayName)
	if overlayName == "" {
		if err := config.EditFile(
			cCtx.Context, cCtx.String(flagEditor), cCtx.String(flagConfig),
		); err != nil {
			return fmt.Errorf("failed to edit config: %w", err)
		}

		return nil
	}

	if err := os.MkdirAll(ce.Path.RunServiceOverlaysFolder(
		cCtx.String(flagConfig),
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
		cCtx.String(flagConfig),
		tmpfileName,
		ce.Path.RunServiceOverlay(cCtx.String(flagConfig), overlayName),
	); err != nil {
		return fmt.Errorf("failed to copy config: %w", err)
	}

	if err := config.EditFile(cCtx.Context, cCtx.String(flagEditor), tmpfileName); err != nil {
		return fmt.Errorf("failed to edit config: %w", err)
	}

	if err := config.GenerateJSONPatch(
		cCtx.String(flagConfig),
		tmpfileName,
		ce.Path.RunServiceOverlay(cCtx.String(flagConfig), overlayName),
	); err != nil {
		return fmt.Errorf("failed to generate json patch: %w", err)
	}

	return nil
}
