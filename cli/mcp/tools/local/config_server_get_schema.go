package local

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

const (
	ToolConfigServerSchemaName = "local-config-server-get-schema"
	//nolint:lll
	ToolConfigServerSchemaInstructions = `Get GraphQL schema for the local config server. This tool is useful when the user is developing a project and wants help changing the project's settings.`
)

func (t *Tool) registerGetConfigServerSchema(mcpServer *server.MCPServer) {
	configServerSchemaTool := mcp.NewTool(
		ToolConfigServerSchemaName,
		mcp.WithDescription(ToolConfigServerSchemaInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Get GraphQL Schema for Nhost Config Server",
				ReadOnlyHint:    ptr(true),
				DestructiveHint: ptr(false),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithBoolean(
			"includeQueries",
			mcp.Description("include queries in the schema"),
			mcp.Required(),
		),
		mcp.WithBoolean(
			"includeMutations",
			mcp.Description("include mutations in the schema"),
			mcp.Required(),
		),
	)
	mcpServer.AddTool(
		configServerSchemaTool,
		mcp.NewStructuredToolHandler(t.handleConfigGetServerSchema),
	)
}

type ConfigServerGetSchemaRequest struct {
	IncludeQueries   bool `json:"includeQueries"`
	IncludeMutations bool `json:"includeMutations"`
}

func (t *Tool) handleConfigGetServerSchema(
	ctx context.Context, _ mcp.CallToolRequest, args ConfigServerGetSchemaRequest,
) (*mcp.CallToolResult, error) {
	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		t.configServerURL,
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		nil,
		nil,
		t.interceptors...,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query GraphQL schema", err), nil
	}

	var allowQueries, allowMutations []graphql.Queries
	if !args.IncludeQueries {
		allowQueries = []graphql.Queries{}
	}

	if !args.IncludeMutations {
		allowMutations = []graphql.Queries{}
	}

	schema := graphql.ParseSchema(
		introspection,
		graphql.Filter{
			AllowQueries:   allowQueries,
			AllowMutations: allowMutations,
		},
	)

	return mcp.NewToolResultStructured(schema, schema), nil
}
