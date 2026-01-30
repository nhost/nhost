package docs

import (
	"context"
	"sort"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/pkg/docssearch"
)

const (
	ToolListName = "list"
	//nolint:lll
	ToolListInstructions = `List all Nhost documentation pages. Use this tool to discover available documentation pages and their topics. Optionally group pages by section for a structured overview.`
)

type ListRequest struct {
	Grouped bool `json:"grouped,omitempty"`
}

type ListPageOutput struct {
	Path        string `json:"path"`
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type ListResponse struct {
	Total int              `json:"total"`
	Pages []ListPageOutput `json:"pages"`
}

func (t *Tool) registerList(mcpServer *server.MCPServer) {
	listTool := mcp.NewTool(
		ToolListName,
		mcp.WithDescription(ToolListInstructions),
		mcp.WithToolAnnotation(
			mcp.ToolAnnotation{
				Title:           "List Nhost Docs",
				ReadOnlyHint:    ptr(true),
				DestructiveHint: ptr(false),
				IdempotentHint:  ptr(true),
				OpenWorldHint:   ptr(false),
			},
		),
		mcp.WithBoolean(
			"grouped",
			mcp.Description("Show pages organized by top-level section"),
		),
	)
	mcpServer.AddTool(listTool, mcp.NewStructuredToolHandler(t.handleList))
}

func (t *Tool) handleList(
	_ context.Context, _ mcp.CallToolRequest, args ListRequest,
) (*mcp.CallToolResult, error) {
	pages := docssearch.GetAllPagesWithInfo()

	response := ListResponse{
		Total: len(pages),
		Pages: make([]ListPageOutput, 0, len(pages)),
	}

	for _, page := range pages {
		response.Pages = append(response.Pages, ListPageOutput{
			Path:        page.Path,
			URL:         "https://docs.nhost.io" + page.Path,
			Title:       page.Title,
			Description: page.Description,
		})
	}

	var text string
	if args.Grouped {
		text = formatListGroupedText(pages)
	} else {
		text = formatListFlatText(pages)
	}

	return mcp.NewToolResultStructured(response, text), nil
}

func formatListFlatText(pages []docssearch.PageInfo) string {
	var sb strings.Builder

	sb.WriteString("Documentation pages:\n\n")

	for _, page := range pages {
		title := page.Title
		if title == "" {
			title = page.Path
		}

		if page.Description != "" {
			sb.WriteString("[" + page.Path + "](" + title + ") - " + page.Description + "\n")
		} else {
			sb.WriteString("[" + page.Path + "](" + title + ")\n")
		}
	}

	return sb.String()
}

func formatListGroupedText(pages []docssearch.PageInfo) string {
	sections := make(map[string][]docssearch.PageInfo)

	for _, page := range pages {
		parts := strings.SplitN(strings.TrimPrefix(page.Path, "/"), "/", 2) //nolint:mnd
		section := parts[0]
		sections[section] = append(sections[section], page)
	}

	sectionNames := make([]string, 0, len(sections))
	for name := range sections {
		sectionNames = append(sectionNames, name)
	}

	sort.Strings(sectionNames)

	var sb strings.Builder

	sb.WriteString("Documentation pages by section:\n\n")

	for _, section := range sectionNames {
		sb.WriteString("## " + section + "\n\n")

		for _, page := range sections[section] {
			title := page.Title
			if title == "" {
				title = page.Path
			}

			if page.Description != "" {
				sb.WriteString("  [" + page.Path + "](" + title + ") - " + page.Description + "\n")
			} else {
				sb.WriteString("  [" + page.Path + "](" + title + ")\n")
			}
		}

		sb.WriteString("\n")
	}

	return sb.String()
}
