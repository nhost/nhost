package docs

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/pkg/docssearch"
)

const (
	ToolReadPageName = "read_page"
	//nolint:lll
	ToolReadPageInstructions = `Read the full content of an Nhost documentation page. Use this after searching to get the complete documentation for a specific page.`
)

type ReadPageRequest struct {
	Path string `json:"path"`
}

type ReadPageResponse struct {
	Path    string `json:"path"`
	URL     string `json:"url"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (t *Tool) registerReadPage(mcpServer *server.MCPServer) {
	readPageTool := mcp.NewTool(
		ToolReadPageName,
		mcp.WithDescription(ToolReadPageInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Read Nhost Documentation Page",
				ReadOnlyHint:    new(true),
				DestructiveHint: new(false),
				IdempotentHint:  new(true),
				OpenWorldHint:   new(false),
			},
		),
		mcp.WithString(
			"path",
			mcp.Description(
				"The documentation page path (e.g., /products/auth/overview or products/auth/overview)",
			),
			mcp.Required(),
		),
	)
	mcpServer.AddTool(readPageTool, mcp.NewStructuredToolHandler(t.handleReadPage))
}

func (t *Tool) handleReadPage(
	_ context.Context, _ mcp.CallToolRequest, args ReadPageRequest,
) (*mcp.CallToolResult, error) {
	if args.Path == "" {
		return mcp.NewToolResultError("path is required"), nil
	}

	content, err := docssearch.ReadPageBytes(args.Path)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("failed to read page", err), nil
	}

	fm, body := docssearch.ParseFrontmatter(content)

	// Normalize path for URL
	path := args.Path
	if len(path) > 0 && path[0] != '/' {
		path = "/" + path
	}

	response := ReadPageResponse{
		Path:    path,
		URL:     "https://docs.nhost.io" + path,
		Title:   fm.Title,
		Content: body,
	}

	return mcp.NewToolResultStructured(response, formatReadPageText(response)), nil
}

func formatReadPageText(response ReadPageResponse) string {
	text := "# " + response.Title + "\n\n"
	text += "URL: " + response.URL + "\n\n"
	text += "---\n\n"
	text += response.Content

	return text
}
