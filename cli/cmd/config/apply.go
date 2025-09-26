package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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
				EnvVars:  []string{"NHOST_SUBDOMAIN"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Usage:   "Skip confirmation",
				EnvVars: []string{"NHOST_YES"},
			},
		},
	}
}

func commandApply(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	ce.Infoln("Validating configuration...")

	cfg, _, err := ValidateRemote(
		cCtx.Context,
		ce,
		proj.GetSubdomain(),
		proj.GetID(),
	)
	if err != nil {
		return err
	}

	return Apply(cCtx.Context, ce, proj.ID, cfg, cCtx.Bool(flagYes))
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
