package cloud

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

const (
	ToolGraphqlQueryName = "cloud-graphql-query"
	//nolint:lll
	ToolGraphqlQueryInstructions = `Execute a GraphQL query against the Nhost Cloud to perform operations on projects and organizations. It also allows configuring projects hosted on Nhost Cloud. Make sure you got the schema before attempting to execute any query. If you get an error while performing a query refresh the schema in case something has changed or you did something wrong. If you get an error indicating mutations are not allowed the user may have disabled them in the server, don't retry and ask the user they need to pass --with-cloud-mutations when starting mcp-nhost to enable them. Projects are apps.`
)

func ptr[T any](v T) *T {
	return &v
}

type GraphqlQueryRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

func (t *Tool) registerGraphqlQuery(mcpServer *server.MCPServer) {
	queryTool := mcp.NewTool(
		ToolGraphqlQueryName,
		mcp.WithDescription(ToolGraphqlQueryInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Perform GraphQL Query on Nhost Cloud Platform",
				ReadOnlyHint:    ptr(!t.withMutations),
				DestructiveHint: ptr(t.withMutations),
				IdempotentHint:  ptr(false),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("graphql query to perform"),
			mcp.Required(),
		),
		mcp.WithString(
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

	allowedMutations := []string{}
	if t.withMutations {
		allowedMutations = nil
	}

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		t.graphqlURL,
		args.Query,
		args.Variables,
		&resp,
		nil,
		allowedMutations,
		t.interceptors...,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query graphql endpoint", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("failed to marshal graphql response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
