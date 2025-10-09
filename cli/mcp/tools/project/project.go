package project

import (
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
)

type Tool struct {
	cfg *config.Config
}

func NewTool(
	cfg *config.Config,
) *Tool {
	return &Tool{
		cfg: cfg,
	}
}

func (t *Tool) Register(mcpServer *server.MCPServer) error {
	t.registerGraphqlQuery(mcpServer)
	t.registerManageGraphql(mcpServer)

	return nil
}
