package docs

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/tools/docs/mintlify"
)

const (
	ToolSearchName = "search"
	//nolint:lll
	ToolSearchInstructions = `Search Nhost's official documentation. Use this tool to look for information about Nhost's features, APIs, guides, etc. Follow relevant links to get more details.`
)

func ptr[T any](v T) *T {
	return &v
}

type SearchRequest struct {
	Query string `json:"query"`
}

func (t *Tool) registerSearch(mcpServer *server.MCPServer) {
	configServerSchemaTool := mcp.NewTool(
		ToolSearchName,
		mcp.WithDescription(ToolSearchInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "Search Nhost Docs",
				ReadOnlyHint:    ptr(true),
				DestructiveHint: ptr(false),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(true),
			},
		),
		mcp.WithString(
			"query",
			mcp.Description("The search query"),
			mcp.Required(),
		),
	)
	mcpServer.AddTool(configServerSchemaTool, mcp.NewStructuredToolHandler(t.handleSearch))
}

func (t *Tool) handleSearch(
	ctx context.Context, _ mcp.CallToolRequest, args SearchRequest,
) (*mcp.CallToolResult, error) {
	if args.Query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	resp, err := t.mintlify.Autocomplete(
		ctx,
		mintlify.AutocompleteRequest{
			Query:          args.Query,
			PageSize:       10, //nolint:mnd
			SearchType:     "full_text",
			ExtendResults:  true,
			ScoreThreshold: 1,
		},
	)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error calling mintlify", err), nil
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("error marshalling response", err), nil
	}

	return mcp.NewToolResultStructured(resp, string(b)), nil
}
