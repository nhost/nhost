package cloud

import (
	"context"
	_ "embed"
	"net/http"

	"github.com/mark3labs/mcp-go/server"
)

//go:embed schema.graphql
var schemaGraphql string

//go:embed schema-with-mutations.graphql
var schemaGraphqlWithMutations string

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
	t.registerGetGraphqlSchema(mcpServer)
	t.registerGraphqlQuery(mcpServer)

	return nil
}
