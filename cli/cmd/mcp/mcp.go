package mcp

import (
	"github.com/nhost/nhost/cli/cmd/mcp/config"
	"github.com/nhost/nhost/cli/cmd/mcp/gen"
	"github.com/nhost/nhost/cli/cmd/mcp/start"
	"github.com/urfave/cli/v3"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "mcp",
		Aliases: []string{},
		Usage:   "Model Context Protocol (MCP) related commands",
		Commands: []*cli.Command{
			config.Command(),
			start.Command(),
			gen.Command(),
		},
	}
}
