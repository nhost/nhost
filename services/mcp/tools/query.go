package tools

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

const (
	ToolGraphqlQueryName = "graphql-query"
	//nolint:lll
	DefaultQueryInstructions = `Execute a GraphQL query or mutation against the configured endpoint. If you run into issues executing queries, retrieve the schema again in case the schema has changed.`
)

type Tool struct {
	graphqlEndpoint    string
	queryInstructions  string
	schemaInstructions string
}

func NewTool(
	graphqlEndpoint string,
	queryInstructions string,
	schemaInstructions string,
) *Tool {
	return &Tool{
		graphqlEndpoint:    graphqlEndpoint,
		queryInstructions:  queryInstructions,
		schemaInstructions: schemaInstructions,
	}
}

type GraphqlQueryRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

func (t *Tool) RegisterQuery(mcpServer *mcpserver.MCPServer) {
	description := t.queryInstructions
	if description == "" {
		description = DefaultQueryInstructions
	}

	queryTool := mcp.NewTool(
		ToolGraphqlQueryName,
		mcp.WithDescription(description),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Execute GraphQL Query",
				ReadOnlyHint:    new(false),
				DestructiveHint: new(true),
				IdempotentHint:  new(false),
				OpenWorldHint:   new(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("GraphQL query or mutation to execute"),
			mcp.Required(),
		),
		mcp.WithObject(
			"variables",
			mcp.Description("variables to use in the query"),
		),
	)
	mcpServer.AddTool(queryTool, mcp.NewStructuredToolHandler(t.handleGraphqlQuery))
}

func (t *Tool) handleGraphqlQuery(
	ctx context.Context, _ mcp.CallToolRequest, args GraphqlQueryRequest,
) (*mcp.CallToolResult, error) {
	if args.Query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		t.graphqlEndpoint,
		args.Query,
		args.Variables,
		&resp,
		[]string{"*"},
		[]string{"*"},
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query graphql endpoint", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
