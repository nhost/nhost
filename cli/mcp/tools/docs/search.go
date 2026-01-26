package docs

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/pkg/docssearch"
)

const (
	ToolSearchName = "search"
	//nolint:lll
	ToolSearchInstructions = `Search Nhost's official documentation. Use this tool to look for information about Nhost's features, APIs, guides, etc. Returns relevant documentation pages with highlighted snippets.`

	defaultSearchLimit = 10
)

func ptr[T any](v T) *T {
	return &v
}

type SearchRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}

type SearchResponse struct {
	Query   string               `json:"query"`
	Total   uint64               `json:"total"`
	Results []SearchResultOutput `json:"results"`
}

type SearchResultOutput struct {
	Path      string   `json:"path"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Score     float64  `json:"score"`
	Fragments []string `json:"fragments,omitempty"`
}

func (t *Tool) registerSearch(mcpServer *server.MCPServer) {
	searchTool := mcp.NewTool(
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
		mcp.WithNumber(
			"limit",
			mcp.Description("Maximum number of results to return (default: 10)"),
		),
	)
	mcpServer.AddTool(searchTool, mcp.NewStructuredToolHandler(t.handleSearch))
}

func (t *Tool) handleSearch(
	_ context.Context, _ mcp.CallToolRequest, args SearchRequest,
) (*mcp.CallToolResult, error) {
	if args.Query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	limit := args.Limit
	if limit <= 0 {
		limit = defaultSearchLimit
	}

	results, err := docssearch.Search(args.Query, limit, false)
	if err != nil {
		return mcp.NewToolResultErrorFromErr("search failed", err), nil
	}

	// Convert to output format with URLs
	response := SearchResponse{
		Query:   results.Query,
		Total:   results.Total,
		Results: make([]SearchResultOutput, 0, len(results.Results)),
	}

	for _, r := range results.Results {
		response.Results = append(response.Results, SearchResultOutput{
			Path:      r.Path,
			URL:       "https://docs.nhost.io" + r.Path,
			Title:     r.Title,
			Score:     r.Score,
			Fragments: r.Fragments,
		})
	}

	return mcp.NewToolResultStructured(response, formatSearchResultsText(response)), nil
}

func formatSearchResultsText(response SearchResponse) string {
	if response.Total == 0 {
		return "No results found for: " + response.Query
	}

	text := "Search results for: " + response.Query + "\n\n"

	var textSb145 strings.Builder
	for i, r := range response.Results {
		textSb145.WriteString(formatResultText(i+1, r))
	}

	text += textSb145.String()

	return text
}

func formatResultText(index int, r SearchResultOutput) string {
	result := ""
	result += "---\n"
	result += "## " + r.Title + "\n"
	result += "Path: " + r.Path + "\n"
	result += "URL: " + r.URL + "\n"
	result += fmt.Sprintf("Score: %.2f\n", r.Score)

	if len(r.Fragments) > 0 {
		result += "\nRelevant excerpts:\n"

		var resultSb162 strings.Builder
		for _, f := range r.Fragments {
			resultSb162.WriteString("> " + f + "\n")
		}

		result += resultSb162.String()
	}

	_ = index // unused but kept for potential future use

	return result + "\n"
}
