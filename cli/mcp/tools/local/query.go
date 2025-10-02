package local

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

const (
	ToolGraphqlQueryName = "local-graphql-query"
	//nolint:lll
	ToolGraphqlQueryInstructions = `Execute a GraphQL query against an Nhost development project running locally via the Nhost CLI. This tool is useful to test queries and mutations during development. If you run into issues executing queries, retrieve the schema using the local-get-graphql-schema tool in case the schema has changed.`
)

func ptr[T any](v T) *T {
	return &v
}

type GraphqlQueryRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
	Role      string         `json:"role"`
}

func (t *Tool) registerGraphqlQuery(mcpServer *server.MCPServer) {
	queryTool := mcp.NewTool(
		ToolGraphqlQueryName,
		mcp.WithDescription(ToolGraphqlQueryInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Perform GraphQL Query on Nhost Development Project",
				ReadOnlyHint:    ptr(false),
				DestructiveHint: ptr(true),
				IdempotentHint:  ptr(false),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("graphql query to perform"),
			mcp.Required(),
		),
		mcp.WithObject(
			"variables",
			mcp.Description("variables to use in the query"),
			mcp.AdditionalProperties(true),
		),
		mcp.WithString(
			"role",
			mcp.Description(
				"role to use when executing queries. Default to user but make sure the user is aware. Keep in mind the schema depends on the role so if you retrieved the schema for a different role previously retrieve it for this role beforehand as it might differ", //nolint:lll
			),
			mcp.Required(),
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

	if args.Role == "" {
		return mcp.NewToolResultError("role is required"), nil
	}

	interceptors := append( //nolint:gocritic
		t.interceptors,
		auth.WithRole(args.Role),
	)

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		t.graphqlURL,
		args.Query,
		args.Variables,
		&resp,
		nil,
		nil,
		interceptors...,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query graphql endpoint", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
