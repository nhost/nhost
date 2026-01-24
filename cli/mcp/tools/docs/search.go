package docs

import (
	"context"

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

	results, err := docssearch.Search(args.Query, limit)
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
		// Strip ANSI codes from fragments for MCP output
		cleanFragments := make([]string, 0, len(r.Fragments))
		for _, f := range r.Fragments {
			cleanFragments = append(cleanFragments, stripANSICodes(f))
		}

		response.Results = append(response.Results, SearchResultOutput{
			Path:      r.Path,
			URL:       "https://docs.nhost.io" + r.Path,
			Title:     r.Title,
			Score:     r.Score,
			Fragments: cleanFragments,
		})
	}

	return mcp.NewToolResultStructured(response, formatSearchResultsText(response)), nil
}

func stripANSICodes(s string) string {
	// Remove ANSI escape codes (like \033[1;33m and \033[0m)
	result := s
	for {
		start := -1
		for i := 0; i < len(result)-1; i++ {
			if result[i] == '\033' && result[i+1] == '[' {
				start = i
				break
			}
		}
		if start == -1 {
			break
		}
		end := start + 2
		for end < len(result) && result[end] != 'm' {
			end++
		}
		if end < len(result) {
			result = result[:start] + result[end+1:]
		} else {
			break
		}
	}
	return result
}

func formatSearchResultsText(response SearchResponse) string {
	if response.Total == 0 {
		return "No results found for: " + response.Query
	}

	text := "Search results for: " + response.Query + "\n\n"

	for i, r := range response.Results {
		text += formatResultText(i+1, r)
	}

	return text
}

func formatResultText(index int, r SearchResultOutput) string {
	result := ""
	result += "---\n"
	result += "## " + r.Title + "\n"
	result += "Path: " + r.Path + "\n"
	result += "URL: " + r.URL + "\n"
	result += "Score: " + formatFloat(r.Score) + "\n"

	if len(r.Fragments) > 0 {
		result += "\nRelevant excerpts:\n"
		for _, f := range r.Fragments {
			result += "> " + f + "\n"
		}
	}

	_ = index // unused but kept for potential future use

	return result + "\n"
}

func formatFloat(f float64) string {
	return string(rune('0'+int(f))) + "." + string(rune('0'+int(f*10)%10)) + string(rune('0'+int(f*100)%10))
}
