package docs

import (
	"encoding/json"
	"fmt"

	docsembed "github.com/nhost/nhost/docs"
)

type DocsConfig struct {
	Navigation Navigation `json:"navigation"`
}

type Navigation struct {
	Tabs []Tab `json:"tabs"`
}

type Tab struct {
	Tab       string     `json:"tab"`
	Pages     []any      `json:"pages,omitempty"`
	Dropdowns []Dropdown `json:"dropdowns,omitempty"`
	Href      string     `json:"href,omitempty"`
}

type Dropdown struct {
	Dropdown string `json:"dropdown"`
	Pages    []any  `json:"pages"`
}

type Group struct {
	Group string `json:"group"`
	Pages []any  `json:"pages"`
}

type PageEntry struct {
	Tab      string
	Dropdown string
	Group    string
	Path     string
}

func LoadDocsIndex() (*DocsConfig, error) {
	data, err := docsembed.DocsFS.ReadFile("docs.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read docs.json: %w", err)
	}

	var config DocsConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse docs.json: %w", err)
	}

	return &config, nil
}

func ExtractPages(config *DocsConfig) []PageEntry {
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
			entries = append(entries, PageEntry{
				Tab:      tab,
				Dropdown: dropdown,
				Group:    group,
				Path:     v,
			})
		case map[string]any:
			if groupName, ok := v["group"].(string); ok {
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

func GetAllPagePaths(config *DocsConfig) []string {
	entries := ExtractPages(config)

	paths := make([]string, len(entries))
	for i, entry := range entries {
		paths[i] = entry.Path
	}

	return paths
}
