package project

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
)

const (
	ToolGraphqlQueryName = "project-graphql-query"
	//nolint:lll
	ToolGraphqlQueryInstructions = `Execute a GraphQL query against a Nhost project running in the Nhost Cloud. This tool is useful to query and mutate live data running on an online projec. If you run into issues executing queries, retrieve the schema using the project-get-graphql-schema tool in case the schema has changed. If you get an error indicating the query or mutation is not allowed the user may have disabled them in the server, don't retry and tell the user they need to enable them when starting mcp-nhost`
)

func ptr[T any](v T) *T {
	return &v
}

type GraphqlQueryRequest struct {
	Query            string         `json:"query"`
	Variables        map[string]any `json:"variables,omitempty"`
	ProjectSubdomain string         `json:"projectSubdomain"`
	Role             string         `json:"role"`
	UserID           string         `json:"userId,omitempty"`
}

func (t *Tool) registerGraphqlQuery(mcpServer *server.MCPServer, projects string) {
	allowedMutations := false

	for _, proj := range t.projects {
		if proj.allowMutations == nil || len(proj.allowMutations) > 0 {
			allowedMutations = true
			break
		}
	}

	queryTool := mcp.NewTool(
		ToolGraphqlQueryName,
		mcp.WithDescription(ToolGraphqlQueryInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Perform GraphQL Query on Nhost Project running on Nhost Cloud",
				ReadOnlyHint:    ptr(!allowedMutations),
				DestructiveHint: ptr(allowedMutations),
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
		mcp.WithString(
			"role",
			mcp.Description(
				"role to use when executing queries. Default to user but make sure the user is aware. Keep in mind the schema depends on the role so if you retrieved the schema for a different role previously retrieve it for this role beforehand as it might differ", //nolint:lll
			),
			mcp.Required(),
		),
		mcp.WithString(
			"userId",
			mcp.Description(
				"Overrides X-Hasura-User-Id in the GraphQL query/mutation. Credentials must allow it (i.e. admin secret must be in use)", //nolint:lll
			),
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

	if args.ProjectSubdomain == "" {
		return mcp.NewToolResultError("projectSubdomain is required"), nil
	}

	if args.Role == "" {
		return mcp.NewToolResultError("role is required"), nil
	}

	project, ok := t.projects[args.ProjectSubdomain]
	if !ok {
		return mcp.NewToolResultError(
			"this project is not configured to be accessed by an LLM",
		), nil
	}

	interceptors := []func(ctx context.Context, req *http.Request) error{
		project.authInterceptor,
		auth.WithRole(args.Role),
	}

	if args.UserID != "" {
		interceptors = append(interceptors, auth.WithUserID(args.UserID))
	}

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		project.graphqlURL,
		args.Query,
		args.Variables,
		&resp,
		project.allowQueries,
		project.allowMutations,
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
