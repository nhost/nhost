package schemas

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
)

const (
	ToolGetSchemaName         = "get-schema"
	ToolGetSchemaInstructions = `
Get GraphQL/API schemas to interact with various services. Use the "service" parameter to
specify which schema you want. Supported services are:

- project: Get GraphQL schema for an Nhost project. The "subdomain"
  parameter is required to specify which project to get the schema for. The "role"
  parameter can be passed to specify the role to use when fetching the schema (defaults
  to admin).
`
)

func ptr[T any](v T) *T {
	return &v
}

type Tool struct {
	cfg *config.Config
}

func NewTool(cfg *config.Config) *Tool {
	return &Tool{cfg: cfg}
}

func (t *Tool) Register(mcpServer *server.MCPServer) {
	queryTool := mcp.NewTool(
		ToolGetSchemaName,
		mcp.WithDescription(ToolGetGraphqlSchemaInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Get GraphQL/API schema for various services",
				ReadOnlyHint:    ptr(true),
				DestructiveHint: ptr(false),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"role",
			mcp.Description(
				"role to use when executing queries. Keep in mind the schema depends on the role so if you retrieved the schema for a different role previously retrieve it for this role beforehand as it might differ", //nolint:lll
			),
			mcp.Required(),
		),
		mcp.WithString(
			"subdomain",
			mcp.Description(
				"Project to get the GraphQL schema for. Required when service is `project`",
			),
			mcp.Enum(t.cfg.Projects.Subdomains()...),
			mcp.Required(),
		),
		mcp.WithBoolean(
			"summary",
			mcp.Description("only return a summary of the schema"),
			mcp.DefaultBool(true),
		),
		mcp.WithArray(
			"queries",
			mcp.WithStringItems(),
			mcp.Description("list of queries to fetch"),
		),
		mcp.WithArray(
			"mutations",
			mcp.WithStringItems(),
			mcp.Description("list of mutations to fetch"),
		),
	)

	mcpServer.AddTool(queryTool, mcp.NewStructuredToolHandler(t.handle))
}

type HandleRequest struct {
	Role      string   `json:"role,omitempty"`
	Subdomain string   `json:"subdomain,omitempty"`
	Summary   bool     `json:"summary,omitempty"`
	Queries   []string `json:"queries,omitempty"`
	Mutations []string `json:"mutations,omitempty"`
}

func (t *Tool) handle(
	ctx context.Context, _ mcp.CallToolRequest, args HandleRequest,
) (*mcp.CallToolResult, error) {
	schema, err := t.handleProjectGraphqlSchema(
		ctx, args.Role, args.Subdomain, args.Summary, args.Queries, args.Mutations,
	)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(schema), nil
}
