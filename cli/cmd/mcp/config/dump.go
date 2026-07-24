package config

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

var (
	errConfigPathRequired = errors.New("config file path is required")
	errConfigLoad         = errors.New(
		"failed to load config. Run `nhost mcp config` to configure",
	)
)

func actionDump(_ context.Context, cmd *cli.Command) error {
	configPath := config.GetConfigPath(cmd)
	if configPath == "" {
		return errConfigPathRequired
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		return errConfigLoad
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	fmt.Print(string(b)) //nolint:forbidigo

	return nil
}
