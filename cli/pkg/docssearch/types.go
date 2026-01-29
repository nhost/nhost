package docssearch

// docPage represents a document for indexing.
type docPage struct {
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
