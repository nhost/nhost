package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func CommandApply() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "apply",
		Aliases: []string{},
		Usage:   "Apply configuration to cloud project",
		Action:  commandApply,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagSubdomain,
				Usage:    "Subdomain of the Nhost project to apply configuration to. Defaults to linked project",
				Required: true,
				Sources:  cli.EnvVars("NHOST_SUBDOMAIN"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Usage:   "Skip confirmation",
				Sources: cli.EnvVars("NHOST_YES"),
			},
		},
	}
}

func commandApply(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
	if err != nil {
		return cli.Exit(fmt.Sprintf("Failed to get app info: %v", err), 1)
	}

	ce.Infoln("Validating configuration...")

	cfg, _, err := ValidateRemote(
		ctx,
		ce,
		proj.GetSubdomain(),
		proj.GetID(),
	)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	if err := Apply(ctx, ce, proj.ID, cfg, cmd.Bool(flagYes)); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	return nil
}

func Apply(
	ctx context.Context,
	ce *clienv.CliEnv,
	appID string,
	cfg *model.ConfigConfig,
	skipConfirmation bool,
) error {
	if !skipConfirmation {
		ce.PromptMessage(
			"We are going to overwrite the project's configuration. Do you want to proceed? [y/N] ",
		)

		resp, err := ce.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}

		if resp != "y" && resp != "Y" {
			return errors.New("aborting") //nolint:err113
		}
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	b, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if _, err := cl.ReplaceConfigRawJSON(
		ctx,
		appID,
		string(b),
	); err != nil {
		return fmt.Errorf("failed to apply config: %w", err)
	}

	ce.Infoln("Configuration applied successfully!")

	return nil
}
