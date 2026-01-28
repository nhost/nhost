package docssearch

import (
	"encoding/json"
	"fmt"
	"strings"

	docsembed "github.com/nhost/nhost/docs"
)

// LoadConfig loads and parses the docs.json configuration.
func LoadConfig() (*Config, error) {
	data, err := docsembed.DocsFS.ReadFile("docs.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read docs.json: %w", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse docs.json: %w", err)
	}

	return &config, nil
}

// ExtractPages extracts all page entries from the config.
func ExtractPages(config *Config) []PageEntry {
	var entries []PageEntry

	for _, tab := range config.Navigation.Tabs {
		if tab.Href != "" {
			continue
		}

		if len(tab.Pages) > 0 {
			entries = append(entries, extractPagesFromList(tab.Pages, tab.Tab, "", "")...)
		}

		for _, dropdown := range tab.Dropdowns {
			entries = append(
				entries,
				extractPagesFromList(dropdown.Pages, tab.Tab, dropdown.Dropdown, "")...)
		}
	}

	return entries
}

func extractPagesFromList(pages []any, tab, dropdown, group string) []PageEntry {
	var entries []PageEntry

	for _, page := range pages {
		switch v := page.(type) {
		case string:
			if !IsDeprecatedPath(v) {
				entries = append(entries, PageEntry{
					Tab:      tab,
					Dropdown: dropdown,
					Group:    group,
					Path:     v,
				})
			}
		case map[string]any:
			if groupName, ok := v["group"].(string); ok {
				// Skip deprecated groups entirely
				if strings.Contains(strings.ToLower(groupName), "deprecated") {
					continue
				}

				if groupPages, ok := v["pages"].([]any); ok {
					entries = append(
						entries,
						extractPagesFromList(groupPages, tab, dropdown, groupName)...)
				}
			}
		}
	}

	return entries
}

// GetAllPagePaths returns all non-deprecated page paths.
func GetAllPagePaths(config *Config) []string {
	entries := ExtractPages(config)

	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !IsDeprecatedPath(entry.Path) {
			paths = append(paths, entry.Path)
		}
	}

	return paths
}

// PageInfo contains metadata about a documentation page.
type PageInfo struct {
	Path        string
	Title       string
	Description string
}

// GetPageInfo returns the title and description for a given page path.
func GetPageInfo(pagePath string) PageInfo {
	content, err := ReadPageBytes(pagePath)
	if err != nil {
		return PageInfo{Path: pagePath, Title: "", Description: ""}
	}

	fm, _ := ParseFrontmatter(content)

	return PageInfo{
		Path:        pagePath,
		Title:       fm.Title,
		Description: fm.Description,
	}
}

// GetAllPagesWithInfo returns all non-deprecated pages with their metadata.
func GetAllPagesWithInfo(config *Config) []PageInfo {
	paths := GetAllPagePaths(config)
	pages := make([]PageInfo, 0, len(paths))

	for _, path := range paths {
		pages = append(pages, GetPageInfo(path))
	}

	return pages
}

// IsDeprecatedPath checks if a path is in a deprecated section.
func IsDeprecatedPath(path string) bool {
	return strings.Contains(path, "/deprecated/") || strings.Contains(path, "deprecated/")
}

// ReadPageBytes reads a documentation page by path and returns the raw bytes.
func ReadPageBytes(pagePath string) ([]byte, error) {
	normalizedPath := NormalizePath(pagePath)

	extensions := []string{".mdx", ".md"}
	for _, ext := range extensions {
		filePath := normalizedPath + ext

		data, err := docsembed.DocsFS.ReadFile(filePath)
		if err == nil {
			return data, nil
		}
	}

	return nil, fmt.Errorf( //nolint:err113
		"page not found: %s",
		pagePath,
	)
}

// ReadPage reads a documentation page by path.
func ReadPage(pagePath string) (string, error) {
	data, err := ReadPageBytes(pagePath)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// NormalizePath normalizes a page path for file lookup.
func NormalizePath(path string) string {
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimSuffix(path, ".mdx")
	path = strings.TrimSuffix(path, ".md")

	return path
}
