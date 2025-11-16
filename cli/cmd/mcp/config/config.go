package config

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

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

//nolint:forbidigo
func action(_ context.Context, cmd *cli.Command) error {
	cfg, err := config.RunWizard()
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to run wizard: %s", err), 1)
	}

	tomlData, err := toml.Marshal(cfg)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to marshal config: %s", err), 1)
	}

	fmt.Println("Configuration Preview:")
	fmt.Println("---------------------")
	fmt.Println(string(tomlData))
	fmt.Println()

	filePath := config.GetConfigPath(cmd)
	fmt.Printf("Save configuration to %s?\n", filePath)
	fmt.Print("Proceed? (y/N): ")

	var confirm string
	if _, err := fmt.Scanln(&confirm); err != nil {
		return cli.Exit(fmt.Sprintf("failed to read input: %s", err), 1)
	}

	if confirm != "y" && confirm != "Y" {
		fmt.Println("Operation cancelled.")
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

	fmt.Println("\nConfiguration saved successfully!")
	fmt.Println("Note: Review the documentation for additional configuration options,")
	fmt.Println("      especially for fine-tuning LLM access permissions.")

	return nil
}
