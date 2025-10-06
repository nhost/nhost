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

- nhost: This is the schema to interact with the Nhost Cloud. Projects are equivalent
  to apps in the schema. IDs are typically uuids.
- config-schema: Get Cuelang schema for the nhost.toml configuration file. Run nhost
  config validate after making changes to your nhost.toml file to ensure it is valid.
- graphql-management: GraphQL's management schema for an Nhost development project
  running locally via the Nhost CLI. This tool is useful to properly understand how
  manage hasura metadata, migrations, permissions, remote schemas, etc.
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
			"service",
			mcp.Enum("nhost", "config-schema", "graphql-management", "project"),
			mcp.Required(),
		),
		mcp.WithString(
			"role",
			mcp.Description(
				"Role to use when fetching the schema. Useful only services `local` and `project`",
			),
			mcp.DefaultString("user"),
		),
		mcp.WithString(
			"subdomain",
			mcp.Description(
				"Project to get the GraphQL schema for. Required when service is `project`",
			),
			mcp.Enum(t.cfg.Projects.Subdomains()...),
		),
	)

	mcpServer.AddTool(queryTool, mcp.NewStructuredToolHandler(t.handle))
}

type HandleRequest struct {
	Service   string `json:"service"`
	Role      string `json:"role,omitempty"`
	Subdomain string `json:"subdomain,omitempty"`
}

func (t *Tool) handle(
	ctx context.Context, _ mcp.CallToolRequest, args HandleRequest,
) (*mcp.CallToolResult, error) {
	var (
		schema string
		err    error
	)
	switch args.Service {
	case "nhost":
		schema, err = t.handleResourceCloud()
	case "local-config-server":
		schema = t.handleSchemaNhostToml()
	case "graphql-management":
		schema = t.handleGraphqlManagementSchema()
	case "project":
		schema, err = t.handleProjectGraphqlSchema(ctx, args.Role, args.Subdomain)
	default:
		return mcp.NewToolResultError("unknown service: " + args.Service), nil
	}

	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(schema), nil
}
