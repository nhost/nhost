package mcp

import (
	"github.com/nhost/nhost/cli/cmd/mcp/config"
	"github.com/nhost/nhost/cli/cmd/mcp/gen"
	"github.com/nhost/nhost/cli/cmd/mcp/start"
	"github.com/urfave/cli/v3"
)

const (
	flagConfigFile = "config-file"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "mcp",
		Aliases: []string{},
		Usage:   "Model Context Protocol (MCP) related commands",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfigFile,
				Usage:   "Configuration file path. Defaults to $NHOST_DOT_NHOST_FOLDER/nhost-mcp.toml",
				Value:   "",
				Sources: cli.EnvVars("NHOST_MCP_CONFIG_FILE"),
			},
		},
		Commands: []*cli.Command{
			config.Command(),
			start.Command(),
			gen.Command(),
		},
	}
}
