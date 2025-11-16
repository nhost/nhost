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
		return cli.Exit("config file path is required", 1)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Println("Please, run `nhost mcp config` to configure the service.") //nolint:forbidigo
		return cli.Exit("failed to load config file "+err.Error(), 1)
	}

	b, err := toml.Marshal(cfg)
	if err != nil {
		return cli.Exit("failed to marshal config file "+err.Error(), 1)
	}

	fmt.Println("Configuration Preview:") //nolint:forbidigo
	fmt.Println("---------------------")  //nolint:forbidigo
	fmt.Println(string(b))                //nolint:forbidigo
	fmt.Println()                         //nolint:forbidigo

	return nil
}
