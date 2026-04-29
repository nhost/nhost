package config

import (
	"context"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/project"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/nhost/nhost/cli/tui"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func CommandDefault() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "default",
		Aliases: []string{},
		Usage:   "Create default configuration and secrets",
		Action:  commandDefault,
		Flags:   []cli.Flag{},
	}
}

func commandDefault(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	if term.IsTerminal(int(os.Stdout.Fd())) {
		return commandDefaultTUI(ce)
	}

	return commandDefaultPlain(ce)
}

func commandDefaultTUI(ce *clienv.CliEnv) error {
	return tui.RunSteps([]tui.Step{
		{
			Name: "Generating default configuration",
			Fn: func() error {
				cfg, err := project.DefaultConfig()
				if err != nil {
					return fmt.Errorf("failed to create config: %w", err)
				}

				return clienv.MarshalFile(cfg, ce.Path.NhostToml(), toml.Marshal)
			},
		},
		{
			Name: "Generating default secrets",
			Fn: func() error {
				secrets := project.DefaultSecrets()

				return clienv.MarshalFile(secrets, ce.Path.Secrets(), env.Marshal)
			},
		},
	}) //nolint:wrapcheck
}

func commandDefaultPlain(ce *clienv.CliEnv) error {
	ce.Infoln("Generating default configuration and secrets...")

	if err := InitConfigAndSecrets(ce); err != nil {
		return fmt.Errorf("failed to initialize project: %w", err)
	}

	ce.Infoln("Done")

	return nil
}

func InitConfigAndSecrets(ce *clienv.CliEnv) error {
	config, err := project.DefaultConfig()
	if err != nil {
		return fmt.Errorf("failed to create default config: %w", err)
	}

	if err := clienv.MarshalFile(config, ce.Path.NhostToml(), toml.Marshal); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	secrets := project.DefaultSecrets()
	if err := clienv.MarshalFile(secrets, ce.Path.Secrets(), env.Marshal); err != nil {
		return fmt.Errorf("failed to save secrets: %w", err)
	}

	return nil
}
