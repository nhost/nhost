package config

import (
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/project"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
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

func commandDefault(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if err := os.MkdirAll(ce.Path.NhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create nhost folder: %w", err)
	}

	ce.Infoln("Initializing Nhost project")

	if err := InitConfigAndSecrets(ce); err != nil {
		return fmt.Errorf("failed to initialize project: %w", err)
	}

	ce.Infoln("Successfully generated default configuration and secrets")

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
