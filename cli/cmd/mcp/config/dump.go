package config

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

func actionDump(_ context.Context, cmd *cli.Command) error {
	configPath := config.GetConfigPath(cmd)
	if configPath == "" {
		return fmt.Errorf("config file path is required") //nolint:err113
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf( //nolint:err113
			"failed to load config. Run `nhost mcp config` to configure",
		)
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	fmt.Print(string(b)) //nolint:forbidigo

	return nil
}
