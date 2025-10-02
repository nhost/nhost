package local

import (
	"context"
	"net/http"

	"github.com/mark3labs/mcp-go/server"
)

type Tool struct {
	graphqlURL      string
	configServerURL string
	interceptors    []func(ctx context.Context, req *http.Request) error
}

func NewTool(
	graphqlURL string,
	configServerURL string,
	interceptors ...func(ctx context.Context, req *http.Request) error,
) *Tool {
	return &Tool{
		graphqlURL:      graphqlURL,
		configServerURL: configServerURL,
		interceptors:    interceptors,
	}
}

func (t *Tool) Register(mcpServer *server.MCPServer) error {
	t.registerGetGraphqlSchema(mcpServer)
	t.registerGraphqlQuery(mcpServer)
	t.registerGetConfigServerSchema(mcpServer)
	t.registerConfigServerQuery(mcpServer)
	t.registerGetGraphqlManagementSchema(mcpServer)
	t.registerManageGraphql(mcpServer)

	return nil
}
