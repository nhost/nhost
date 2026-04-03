package config

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const (
	flagConfirm = "confirm"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "config",
		Usage: "Generate and save configuration file",
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagConfirm,
				Usage:   "Skip confirmation prompt",
				Value:   false,
				Sources: cli.EnvVars("CONFIRM"),
			},
		},
		Commands: []*cli.Command{
			{
				Name:   "dump",
				Usage:  "Dump the configuration to stdout for verification",
				Flags:  []cli.Flag{},
				Action: actionDump,
			},
		},
		Action: action,
	}
}

func action(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	cfg, err := config.RunWizard()
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to run wizard: %s", err), 1)
	}

	tomlData, err := toml.Marshal(cfg)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to marshal config: %s", err), 1)
	}

	ce.Println("Configuration Preview:")
	ce.Println("---------------------")
	ce.Println("%s", string(tomlData))

	filePath := config.GetConfigPath(cmd)

	confirmed, err := ce.ConfirmPrompt(
		fmt.Sprintf("Save configuration to %s?", filePath),
		false,
	)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to read input: %s", err), 1)
	}

	if !confirmed {
		ce.Println("Operation cancelled.")
		return nil
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0o600); err != nil { //nolint:mnd
		return fmt.Errorf("failed to write config file: %w", err)
	}

	ce.Println("\nConfiguration saved successfully!")
	ce.Println("Note: Review the documentation for additional configuration options,")
	ce.Println("      especially for fine-tuning LLM access permissions.")

	return nil
}
