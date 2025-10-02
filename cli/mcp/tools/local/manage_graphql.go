package local

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	ToolManageGraphqlName         = "local-manage-graphql"
	ToolManageGraphqlInstructions = `
		Query GraphQL's management endpoints on an Nhost development project running locally via
		the Nhost CLI. This tool is useful to manage hasura metadata, migrations, permissions,
		remote schemas, database migrations, etc. It also allows to interact with the underlying
		database directly.

		* Do not forget to use the base url in the endpoint.
		* Before using this tool always describe in natural languate what you are about to do.

		## Metadata changes

		* When changing metadata always use the /apis/migrate endpoint
		* Always perform a bulk request to avoid
		  having to perform multiple requests
		* The admin user always has full permissions to everything by default, no need to configure
		  anything

		## Schema changes

		* Before performing any schema changes describe the changes in natural language
		* Before performing any database schema changes, always check the current state of the database
		* When performing database schema changes, always follow existing patterns in the database schema
		* When making database schema changes, always do it via the /apis/migrate endpoint
		* Always provide a down migration
		* Always track new tables
		* Always track new foreign keys as relationships
		* Never modify the database schema directly via SQL commands, always use the /apis/migrate endpoint

		## Roles

		* Roles need to be added to the table auth.roles, if requested to add a new role for an
		  application always do it via a migration

		## Data changes

		* Before adding/changing/modifying data confirm with the user if the change should be done
		  using a migration via the /apis/migrate endpoint
		`
)

type ManageGraphqlRequest struct {
	Endpoint string `json:"endpoint"`
	Body     string `json:"body"`
}

func (t *Tool) registerManageGraphql(mcpServer *server.MCPServer) {
	schemaTool := mcp.NewTool(
		ToolManageGraphqlName,
		mcp.WithDescription(ToolManageGraphqlInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Manage GraphQL's Metadata on an Nhost Development Project",
				ReadOnlyHint:    ptr(false),
				DestructiveHint: ptr(true),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"endpoint",
			mcp.Description(
				"The GraphQL management endpoint to query. Use https://local.hasura.local.nhost.run as base URL",
			),
			mcp.Required(),
		),
		mcp.WithString(
			"body",
			mcp.Description("The body for the HTTP request"),
			mcp.Required(),
		),
	)
	mcpServer.AddTool(schemaTool, mcp.NewStructuredToolHandler(t.handleManageGraphql))
}

type httpResponse struct {
	StatusCode int    `json:"status_code"`
	Body       string `json:"body"`
}

func genericQuery(
	ctx context.Context,
	endpoint string,
	body string,
	method string,
	headers http.Header,
	interceptors []func(ctx context.Context, req *http.Request) error,
) (httpResponse, error) {
	request, err := http.NewRequestWithContext(ctx, method, endpoint, strings.NewReader(body))
	if err != nil {
		return httpResponse{}, fmt.Errorf("failed to create request: %w", err)
	}

	for key, values := range headers {
		for _, value := range values {
			request.Header.Add(key, value)
		}
	}

	for _, interceptor := range interceptors {
		if err := interceptor(ctx, request); err != nil {
			return httpResponse{}, fmt.Errorf("failed to execute interceptor: %w", err)
		}
	}

	client := &http.Client{} //nolint: exhaustruct

	response, err := client.Do(request)
	if err != nil {
		return httpResponse{}, fmt.Errorf("failed to execute request: %w", err)
	}
	defer response.Body.Close()

	b, _ := io.ReadAll(response.Body)

	return httpResponse{
		StatusCode: response.StatusCode,
		Body:       string(b),
	}, nil
}

func (t *Tool) handleManageGraphql(
	ctx context.Context, _ mcp.CallToolRequest, args ManageGraphqlRequest,
) (*mcp.CallToolResult, error) {
	if args.Endpoint == "" {
		return mcp.NewToolResultError("endpoint is required"), nil
	}

	if args.Body == "" {
		return mcp.NewToolResultError("body is required"), nil
	}

	headers := http.Header{}
	headers.Add("Content-Type", "application/json")
	headers.Add("Accept", "application/json")

	response, err := genericQuery(
		ctx, args.Endpoint, args.Body, http.MethodPost, headers, t.interceptors,
	)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("failed to execute query", err), nil
	}

	b, err := json.Marshal(response)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("failed to marshal response", err), nil
	}

	return mcp.NewToolResultStructured(response, string(b)), nil
}
