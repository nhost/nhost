package resources

import (
	"context"
	_ "embed"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
)

//go:embed cloud_schema.graphql
var schemaGraphql string

//go:embed cloud_schema-with-mutations.graphql
var schemaGraphqlWithMutations string

const CloudDescription = `Schema to interact with the Nhost Cloud. Projects are equivalent
to apps in the schema. IDs are typically uuids.`

type Cloud struct {
	schema string
}

func NewCloud(cfg *config.Config) *Cloud {
	schema := schemaGraphql
	if cfg.Cloud.EnableMutations {
		schema = schemaGraphqlWithMutations
	}

	return &Cloud{
		schema: schema,
	}
}

func (t *Cloud) Register(server *server.MCPServer) {
	server.AddResource(
		mcp.Resource{
			URI:  "schema://nhost-cloud",
			Name: "nhost-cloud",
			Annotated: mcp.Annotated{
				Annotations: &mcp.Annotations{
					Audience: []mcp.Role{"agent"},
					Priority: 9.0, //nolint:mnd
				},
			},
			Description: CloudDescription,
			MIMEType:    "text/plain",
			Meta:        nil,
		},
		t.handle,
	)
}

func (t *Cloud) handle(
	_ context.Context, request mcp.ReadResourceRequest,
) ([]mcp.ResourceContents, error) {
	return []mcp.ResourceContents{
		mcp.TextResourceContents{
			URI:      request.Params.URI,
			MIMEType: "text/plain",
			Text:     t.schema,
			Meta:     nil,
		},
	}, nil
}
