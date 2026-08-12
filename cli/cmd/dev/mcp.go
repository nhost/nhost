package dev

import (
	"github.com/nhost/nhost/cli/clienv"
	mcpconfig "github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/tui"
)

// mcpStatus returns information about the MCP server configuration if present.
func mcpStatus(ce *clienv.CliEnv) tui.MCPStatus {
	path := ce.Path.MCPConfig()
	if !clienv.PathExists(path) {
		return tui.MCPStatus{Configured: false, Projects: nil}
	}

	cfg, err := mcpconfig.Load(path)
	if err != nil {
		return tui.MCPStatus{Configured: true, Projects: nil}
	}

	return tui.MCPStatus{
		Configured: true,
		Projects:   cfg.Projects.Subdomains(),
	}
}
