package resources

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/nhost/graphql"
)

const (
	GraphqlManagementResourceURI = "schema://graphql-management"
	GraphqlManagementDescription = `GraphQL's management schema for an Nhost project.
This tool is useful to properly understand how manage hasura metadata, migrations,
permissions, remote schemas, etc.`
)

type GraphqlManagement struct{}

func NewGraphqlManagement() *GraphqlManagement {
	return &GraphqlManagement{}
}

func (t *GraphqlManagement) Register(server *server.MCPServer) {
	server.AddResource(
		mcp.Resource{
			URI:  GraphqlManagementResourceURI,
			Name: "graphql-management",
			Annotated: mcp.Annotated{
				Annotations: &mcp.Annotations{
					Audience: []mcp.Role{"agent"},
					Priority: 9.0, //nolint:mnd
				},
			},
			Description: GraphqlManagementDescription,
			MIMEType:    "text/plain",
			Meta:        nil,
		},
		t.handle,
	)
}

func (t *GraphqlManagement) handle(
	_ context.Context, request mcp.ReadResourceRequest,
) ([]mcp.ResourceContents, error) {
	return []mcp.ResourceContents{
		mcp.TextResourceContents{
			URI:      request.Params.URI,
			MIMEType: "text/plain",
			Text:     graphql.Schema,
			Meta:     nil,
		},
	}, nil
}
