package docssearch

// Config represents the docs.json configuration structure.
type Config struct {
	Navigation Navigation `json:"navigation"`
}

// Navigation contains the navigation tabs.
type Navigation struct {
	Tabs []Tab `json:"tabs"`
}

// Tab represents a navigation tab.
type Tab struct {
	Tab       string     `json:"tab"`
	Pages     []any      `json:"pages,omitempty"`
	Dropdowns []Dropdown `json:"dropdowns,omitempty"`
	Href      string     `json:"href,omitempty"`
}

// Dropdown represents a dropdown menu in a tab.
type Dropdown struct {
	Dropdown string `json:"dropdown"`
	Pages    []any  `json:"pages"`
}

// Group represents a group of pages.
type Group struct {
	Group string `json:"group"`
	Pages []any  `json:"pages"`
}

// PageEntry represents a page in the documentation.
type PageEntry struct {
	Tab      string
	Dropdown string
	Group    string
	Path     string
}

// DocPage represents a document for indexing.
type DocPage struct {
	Path     string `json:"path"`
	Title    string `json:"title"`
	Keywords string `json:"keywords"`
	Content  string `json:"content"`
}

// Frontmatter represents the YAML frontmatter of a documentation page.
type Frontmatter struct {
	Title       string   `yaml:"title"`
	Description string   `yaml:"description"`
	Keywords    []string `yaml:"keywords"`
}

// SearchResult represents a single search result.
type SearchResult struct {
	Path      string   `json:"path"`
	Title     string   `json:"title"`
	Score     float64  `json:"score"`
	Fragments []string `json:"fragments,omitempty"`
}

// SearchResults represents the complete search response.
type SearchResults struct {
	Query   string         `json:"query"`
	Total   uint64         `json:"total"`
	Results []SearchResult `json:"results"`
}
