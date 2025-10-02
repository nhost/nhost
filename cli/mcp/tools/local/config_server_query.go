package local

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

const (
	ToolConfigServerQueryName = "local-config-server-query"
	//nolint:lll
	ToolConfigServerQueryInstructions = `Execute a GraphQL query against the local config server. This tool is useful to query and perform configuration changes on the local development project. Before using this tool, make sure to get the schema using the local-config-server-schema tool. To perform configuration changes this endpoint is all you need but to apply them you need to run 'nhost up' again. Ask the user for input when you need information about settings, for instance if the user asks to enable some oauth2 method and you need the client id or secret.`
)

type ConfigServerQueryRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

func (t *Tool) registerConfigServerQuery(mcpServer *server.MCPServer) {
	configServerQueryTool := mcp.NewTool(
		ToolConfigServerQueryName,
		mcp.WithDescription(ToolConfigServerQueryInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Perform GraphQL Query on Nhost Config Server",
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
		mcp.WithString(
			"variables",
			mcp.Description("variables to use in the query"),
		),
	)
	mcpServer.AddTool(
		configServerQueryTool,
		mcp.NewStructuredToolHandler(t.handleConfigServerQuery),
	)
}

func (t *Tool) handleConfigServerQuery(
	ctx context.Context, _ mcp.CallToolRequest, args ConfigServerQueryRequest,
) (*mcp.CallToolResult, error) {
	if args.Query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		t.configServerURL,
		args.Query,
		args.Variables,
		&resp,
		nil,
		nil,
		t.interceptors...,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query graphql endpoint", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
