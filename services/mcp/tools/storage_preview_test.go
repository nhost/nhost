package tools_test

import (
	"regexp"
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

	checkStoragePreviewHTML(t, view.Text)
}

func checkStoragePreviewHTML(t *testing.T, page string) {
	t.Helper()

	const (
		cspHeader = `http-equiv="content-security-policy"`
		wantCSP   = "default-src 'none'; img-src data:; " +
			"script-src 'unsafe-inline'; style-src 'unsafe-inline'"
	)

	cspTag := regexp.MustCompile(`(?i)<meta\s+` + cspHeader + `\s+content="([^"]*)"\s*>`)

	match := cspTag.FindStringSubmatch(page)
	if strings.Count(strings.ToLower(page), cspHeader) != 1 ||
		len(match) != 2 || match[1] != wantCSP {
		t.Errorf("expected one no-network CSP %q, got %q", wantCSP, match)
	}

	for _, forbidden := range []string{
		"fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "<link", `src="http`, "@import",
	} {
		if strings.Contains(page, forbidden) {
			t.Errorf("preview must not reference %q", forbidden)
		}
	}

	for _, required := range []string{
		"'2026-01-26'",
		"'ui/initialize'",
		"'ui/notifications/initialized'",
		"'ui/notifications/tool-result'",
		"'ui/resource-teardown'",
	} {
		if !strings.Contains(page, required) {
			t.Errorf("preview is missing MCP Apps protocol marker %s", required)
		}
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
