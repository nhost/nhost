package project

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

const (
	ToolGetGraphqlSchemaName         = "project-get-graphql-schema"
	ToolGetGraphqlSchemaInstructions = `Get GraphQL schema for an Nhost project running in the Nhost Cloud.`
)

var (
	ErrNotFound           = errors.New("not found")
	ErrInvalidRequestBody = errors.New("invalid request body")
)

type GetGraphqlSchemaRequest struct {
	Role             string `json:"role"`
	ProjectSubdomain string `json:"projectSubdomain"`
}

func (t *Tool) registerGetGraphqlSchemaTool(mcpServer *server.MCPServer, projects string) {
	schemaTool := mcp.NewTool(
		ToolGetGraphqlSchemaName,
		mcp.WithDescription(ToolGetGraphqlSchemaInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Get GraphQL Schema for Nhost Project running on Nhost Cloud",
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
		mcp.WithString(
			"projectSubdomain",
			mcp.Description(
				fmt.Sprintf(
					"Project to get the GraphQL schema for. Must be one of %s, otherwise you don't have access to it. You can use cloud-* tools to resolve subdomains and map them to names", //nolint:lll
					projects,
				),
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

	if args.ProjectSubdomain == "" {
		return mcp.NewToolResultError("projectSubdomain is required"), nil
	}

	project, ok := t.projects[args.ProjectSubdomain]
	if !ok {
		return mcp.NewToolResultError("project not configured to be accessed by an LLM"), nil
	}

	interceptors := []func(ctx context.Context, req *http.Request) error{
		project.authInterceptor,
		auth.WithRole(args.Role),
	}

	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		project.graphqlURL,
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

	return mcp.NewToolResultStructured(schema, schema), nil
}
