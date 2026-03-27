package tools

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

const (
	ToolGetSchemaName = "get-schema"
	//nolint:lll
	DefaultSchemaInstructions = `Get the GraphQL schema for the configured endpoint. Returns either a summary (list of available queries/mutations) or the full SDL schema. Use the summary to discover available operations, then fetch the full schema for specific queries/mutations you need.`
)

type GetSchemaRequest struct {
	Summary   bool     `json:"summary,omitempty"`
	Queries   []string `json:"queries,omitempty"`
	Mutations []string `json:"mutations,omitempty"`
}

func (t *Tool) RegisterSchema(mcpServer *mcpserver.MCPServer) {
	description := t.schemaInstructions
	if description == "" {
		description = DefaultSchemaInstructions
	}

	schemaTool := mcp.NewTool(
		ToolGetSchemaName,
		mcp.WithDescription(description),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Get GraphQL Schema",
				ReadOnlyHint:    new(true),
				DestructiveHint: new(false),
				IdempotentHint:  new(true),
				OpenWorldHint:   new(true),
			},
		),
		mcp.WithBoolean(
			"summary",
			mcp.Description("only return a summary of the schema"),
			mcp.DefaultBool(true),
		),
		mcp.WithArray(
			"queries",
			mcp.WithStringItems(),
			mcp.Description("list of query names to include in the schema"),
		),
		mcp.WithArray(
			"mutations",
			mcp.WithStringItems(),
			mcp.Description("list of mutation names to include in the schema"),
		),
	)
	mcpServer.AddTool(schemaTool, mcp.NewStructuredToolHandler(t.handleGetSchema))
}

func (t *Tool) handleGetSchema(
	ctx context.Context, _ mcp.CallToolRequest, args GetSchemaRequest,
) (*mcp.CallToolResult, error) {
	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		t.graphqlEndpoint,
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		[]string{"*"},
		nil,
		authorizationInterceptor,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query GraphQL schema", err), nil
	}

	var schema string
	if args.Summary {
		schema = graphql.SummarizeSchema(introspection)
	} else {
		schema = graphql.ParseSchema(
			introspection,
			graphql.Filter{
				AllowQueries:   toQueries(args.Queries),
				AllowMutations: toQueries(args.Mutations),
			},
		)
	}

	return mcp.NewToolResultText(schema), nil
}

func toQueries(q []string) []graphql.Queries {
	if q == nil {
		return nil
	}

	queries := make([]graphql.Queries, len(q))
	for i, v := range q {
		queries[i] = graphql.Queries{
			Name:           v,
			DisableNesting: false,
		}
	}

	return queries
}
