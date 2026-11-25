package tools_test

import (
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
)

func TestStoragePreviewResource(t *testing.T) {
	t.Parallel()

	const (
		uri      = "ui://nhost/storage-preview.html"
		mimeType = "text/html;profile=mcp-app"
	)

	ctx := t.Context()
	c := storageClient(t, "https://storage.example/v1")

	checkStoragePreviewLink(t, c, uri)

	resources, err := c.ListResources(ctx, mcp.ListResourcesRequest{})
	if err != nil {
		t.Fatal(err)
	}

	if len(resources.Resources) != 1 || resources.Resources[0].URI != uri ||
		resources.Resources[0].MIMEType != mimeType {
		t.Fatalf("unexpected resources: %+v", resources.Resources)
	}

	read := mcp.ReadResourceRequest{}
	read.Params.URI = uri

	result, err := c.ReadResource(ctx, read)
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Contents) != 1 {
		t.Fatalf("expected one preview resource, got %d", len(result.Contents))
	}

	view, ok := mcp.AsTextResourceContents(result.Contents[0])
	if !ok || view.URI != uri || view.MIMEType != mimeType ||
		!strings.HasPrefix(view.Text, "<!doctype html>") {
		t.Fatalf("expected HTML preview resource, got %T", result.Contents[0])
	}
}

func checkStoragePreviewLink(t *testing.T, c *client.Client, uri string) {
	t.Helper()

	list, err := c.ListTools(t.Context(), mcp.ListToolsRequest{})
	if err != nil {
		t.Fatal(err)
	}

	if len(list.Tools) != 1 || list.Tools[0].Name != "storage-download" {
		t.Fatalf("expected only storage-download, got %+v", list.Tools)
	}

	meta := list.Tools[0].Meta
	if meta == nil {
		t.Fatal("storage-download has no UI metadata")
	}

	ui, ok := meta.AdditionalFields["ui"].(map[string]any)
	if !ok || ui["resourceUri"] != uri {
		t.Fatalf("unexpected tool UI metadata: %+v", meta)
	}
}
