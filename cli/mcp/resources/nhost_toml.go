package resources

import (
	"context"
	_ "embed"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

//go:embed nhost_toml_schema.cue
var schemaNhostToml string

const (
	NhostTomlResourceURI         = "schema://nhost.toml"
	NhostTomlResourceDescription = `Cuelang schema for the nhost.toml configuration file. Run nhost
config validate after making changes to your nhost.toml file to ensure it is valid.`
)

type NhostToml struct{}

func NewNhostToml() *NhostToml {
	return &NhostToml{}
}

func (t *NhostToml) Register(server *server.MCPServer) {
	server.AddResource(
		mcp.Resource{
			URI:  NhostTomlResourceURI,
			Name: "nhost.toml",
			Annotated: mcp.Annotated{
				Annotations: &mcp.Annotations{
					Audience: []mcp.Role{"agent"},
					Priority: 9.0, //nolint:mnd
				},
			},
			Description: NhostTomlResourceDescription,
			MIMEType:    "text/plain",
			Meta:        nil,
		},
		t.handle,
	)
}

//go:generate cp ../../../vendor/github.com/nhost/be/services/mimir/schema/schema.cue nhost_toml_schema.cue
func (t *NhostToml) handle(
	_ context.Context, request mcp.ReadResourceRequest,
) ([]mcp.ResourceContents, error) {
	return []mcp.ResourceContents{
		mcp.TextResourceContents{
			URI:      request.Params.URI,
			MIMEType: "text/plain",
			Text:     schemaNhostToml,
			Meta:     nil,
		},
	}, nil
}
