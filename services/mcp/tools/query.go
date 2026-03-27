package tools

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

type authorizationContextKey struct{}

// AuthorizationToContext extracts the Authorization header from an HTTP request
// and stores it in the context so tool handlers can forward it to downstream services.
func AuthorizationToContext(ctx context.Context, r *http.Request) context.Context {
	if auth := r.Header.Get("Authorization"); auth != "" {
		ctx = context.WithValue(ctx, authorizationContextKey{}, auth)
	}

	return ctx
}

func authorizationInterceptor(ctx context.Context, req *http.Request) error {
	if auth, ok := ctx.Value(authorizationContextKey{}).(string); ok {
		req.Header.Set("Authorization", auth)
	}

	return nil
}

const (
	ToolGraphqlQueryName = "graphql-query"
	//nolint:lll
	DefaultQueryInstructions = `Execute a read-only GraphQL query against the configured endpoint. Only queries are allowed — mutations will be rejected. If you run into issues executing queries, retrieve the schema again in case the schema has changed.`

	ToolGraphqlMutationName = "graphql-mutation"
	//nolint:lll
	DefaultMutationInstructions = `Execute a GraphQL mutation against the configured endpoint. Only mutations are allowed — queries will be rejected. If you run into issues executing mutations, retrieve the schema again in case the schema has changed.`
)

type Tool struct {
	graphqlEndpoint      string
	queryInstructions    string
	mutationInstructions string
	schemaInstructions   string
}

func NewTool(
	graphqlEndpoint string,
	queryInstructions string,
	mutationInstructions string,
	schemaInstructions string,
) *Tool {
	return &Tool{
		graphqlEndpoint:      graphqlEndpoint,
		queryInstructions:    queryInstructions,
		mutationInstructions: mutationInstructions,
		schemaInstructions:   schemaInstructions,
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
				ReadOnlyHint:    new(true),
				DestructiveHint: new(false),
				IdempotentHint:  new(true),
				OpenWorldHint:   new(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("GraphQL query to execute"),
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
		nil,
		authorizationInterceptor,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to query graphql endpoint", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}

func (t *Tool) RegisterMutation(mcpServer *mcpserver.MCPServer) {
	description := t.mutationInstructions
	if description == "" {
		description = DefaultMutationInstructions
	}

	mutationTool := mcp.NewTool(
		ToolGraphqlMutationName,
		mcp.WithDescription(description),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Execute GraphQL Mutation",
				ReadOnlyHint:    new(false),
				DestructiveHint: new(true),
				IdempotentHint:  new(false),
				OpenWorldHint:   new(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("GraphQL mutation to execute"),
			mcp.Required(),
		),
		mcp.WithObject(
			"variables",
			mcp.Description("variables to use in the mutation"),
		),
	)
	mcpServer.AddTool(mutationTool, mcp.NewStructuredToolHandler(t.handleGraphqlMutation))
}

func (t *Tool) handleGraphqlMutation(
	ctx context.Context, _ mcp.CallToolRequest, args GraphqlQueryRequest,
) (*mcp.CallToolResult, error) {
	if args.Query == "" {
		return mcp.NewToolResultError("mutation is required"), nil
	}

	var resp graphql.Response[any]
	if err := graphql.Query(
		ctx,
		t.graphqlEndpoint,
		args.Query,
		args.Variables,
		&resp,
		nil,
		[]string{"*"},
		authorizationInterceptor,
	); err != nil {
		return mcp.NewToolResultErrorFromErr("failed to execute graphql mutation", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
