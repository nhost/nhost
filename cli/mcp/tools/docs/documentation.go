package docs

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/tools/docs/mintlify"
)

type Tool struct {
	mintlify *mintlify.Mintlify
}

func NewTool(ctx context.Context) (*Tool, error) {
	mintlify, err := mintlify.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("error creating mintlify client: %w", err)
	}

	return &Tool{
		mintlify: mintlify,
	}, nil
}

func (t *Tool) Register(mcpServer *server.MCPServer) {
	t.registerSearch(mcpServer)
}
