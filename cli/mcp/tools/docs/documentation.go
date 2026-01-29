package docs

import (
	"github.com/mark3labs/mcp-go/server"
)

type Tool struct{}

func NewTool() *Tool {
	return &Tool{}
}

func (t *Tool) Register(mcpServer *server.MCPServer) {
	t.registerSearch(mcpServer)
	t.registerReadPage(mcpServer)
}
