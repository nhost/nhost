package cloud

import (
	"context"
	"net/http"

	"github.com/mark3labs/mcp-go/server"
)

type Tool struct {
	graphqlURL    string
	withMutations bool
	interceptors  []func(ctx context.Context, req *http.Request) error
}

func NewTool(
	graphqlURL string,
	withMutations bool,
	interceptors ...func(ctx context.Context, req *http.Request) error,
) *Tool {
	return &Tool{
		graphqlURL:    graphqlURL,
		withMutations: withMutations,
		interceptors:  interceptors,
	}
}

func (t *Tool) Register(mcpServer *server.MCPServer) error {
	t.registerGraphqlQuery(mcpServer)

	return nil
}
