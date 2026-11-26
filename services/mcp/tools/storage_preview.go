package tools

import (
	"context"
	_ "embed"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

const (
	storagePreviewURI      = "ui://nhost/storage-preview.html"
	storagePreviewMIMEType = "text/html;profile=mcp-app"
)

//go:embed storage_preview.html
var storagePreviewHTML string

func registerStoragePreview(server *mcpserver.MCPServer) {
	server.AddResource(
		mcp.NewResource(
			storagePreviewURI,
			"Storage image preview",
			mcp.WithMIMEType(storagePreviewMIMEType),
		),
		func(_ context.Context, _ mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
			return []mcp.ResourceContents{mcp.TextResourceContents{
				Meta:     nil,
				URI:      storagePreviewURI,
				MIMEType: storagePreviewMIMEType,
				Text:     storagePreviewHTML,
			}}, nil
		},
	)
}
