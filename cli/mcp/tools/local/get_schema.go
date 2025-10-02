package local

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

const (
	ToolGetGraphqlSchemaName = "local-get-graphql-schema"
	//nolint:lll
	ToolGetGraphqlSchemaInstructions = `Get GraphQL schema for an Nhost development project running locally via the Nhost CLI. This tool is useful when the user is developing a project and wants help generating code to interact with their project's Graphql schema.`
)

type GetGraphqlSchemaRequest struct {
	Role string `json:"role"`
}

func (t *Tool) registerGetGraphqlSchema(mcpServer *server.MCPServer) {
	schemaTool := mcp.NewTool(
		ToolGetGraphqlSchemaName,
		mcp.WithDescription(ToolGetGraphqlSchemaInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Get GraphQL Schema for Nhost Development Project",
				ReadOnlyHint:    ptr(true),
				DestructiveHint: ptr(false),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"role",
			mcp.Description(
				"role to use when executing queries. Default to user but make sure the user is aware",
			),
			mcp.Required(),
		),
	)
	mcpServer.AddTool(schemaTool, mcp.NewStructuredToolHandler(t.handleGetGraphqlSchema))
}

func (t *Tool) handleGetGraphqlSchema(
	ctx context.Context, _ mcp.CallToolRequest, args GetGraphqlSchemaRequest,
) (*mcp.CallToolResult, error) {
	if args.Role == "" {
		return mcp.NewToolResultError("role is required"), nil
	}

	interceptors := append( //nolint:gocritic
		t.interceptors,
		auth.WithRole(args.Role),
	)

	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		t.graphqlURL,
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		nil,
		nil,
		interceptors...,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query GraphQL schema", err), nil
	}

	schema := graphql.ParseSchema(
		introspection,
		graphql.Filter{
			AllowQueries:   nil,
			AllowMutations: nil,
		},
	)

	return mcp.NewToolResultText(schema), nil
}
