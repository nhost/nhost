package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain))
	if err != nil {
		return cli.Exit(fmt.Sprintf("Failed to get app info: %v", err), 1)
	}

	skipConfirm := cmd.Bool(flagYes)

	if term.IsTerminal(int(os.Stdout.Fd())) {
		return commandApplyTUI(ctx, ce, proj.GetSubdomain(), proj.GetID(), proj.ID, skipConfirm)
	}

	return commandApplyPlain(ctx, ce, proj.GetSubdomain(), proj.GetID(), proj.ID, skipConfirm)
}

func commandApplyTUI(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain, projID, appID string,
	skipConfirm bool,
) error {
	if !skipConfirm {
		if err := confirmApply(); err != nil {
			return err
		}
	}

	var cfg *model.ConfigConfig

	ce.SetStdout(io.Discard)
	defer ce.SetStdout(os.Stdout)

	return tui.RunSteps([]tui.Step{ //nolint:wrapcheck
		{
			Name: "Validating configuration",
			Fn: func() error {
				var err error

				cfg, _, err = ValidateRemote(ctx, ce, subdomain, projID)

				return err
			},
		},
		{
			Name: "Applying configuration",
			Fn: func() error {
				return Apply(ctx, ce, appID, cfg, true)
			},
		},
	})
}

func commandApplyPlain(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain, projID, appID string,
	skipConfirm bool,
) error {
	ce.Infoln("Validating configuration...")

	cfg, _, err := ValidateRemote(ctx, ce, subdomain, projID)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	if err := Apply(ctx, ce, appID, cfg, skipConfirm); err != nil {
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
		if err := confirmApply(); err != nil {
			return err
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

func confirmApply() error {
	if !term.IsTerminal(int(os.Stdout.Fd())) {
		return errors.New("use --yes to skip confirmation") //nolint:err113
	}

	confirmed, err := tui.RunConfirm("Overwrite project configuration?")
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if !confirmed {
		return errors.New("operation cancelled") //nolint:err113
	}

	return nil
}
