package docssearch

import (
	"fmt"
	"io/fs"
	"regexp"
	"strings"
	"sync"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search/highlight/format/html"
	"github.com/blevesearch/bleve/v2/search/query"
	docsembed "github.com/nhost/nhost/docs"
)

//nolint:gochecknoglobals
var (
	searchIndex     bleve.Index
	searchIndexOnce sync.Once
	searchIndexErr  error
)

// Search performs a search query and returns results.
func Search(queryStr string, limit int) (*SearchResults, error) {
	index, err := getSearchIndex()
	if err != nil {
		return nil, fmt.Errorf("failed to build search index: %w", err)
	}

	searchQuery := buildSearchQuery(queryStr)
	searchRequest := bleve.NewSearchRequest(searchQuery)
	searchRequest.Size = limit
	searchRequest.Fields = []string{"path", "title", "content"}
	searchRequest.Highlight = bleve.NewHighlightWithStyle(html.Name)
	searchRequest.Highlight.AddField("content")
	searchRequest.Highlight.AddField("title")

	results, err := index.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	searchResults := &SearchResults{
		Query:   queryStr,
		Total:   results.Total,
		Results: make([]SearchResult, 0, len(results.Hits)),
	}

	for _, hit := range results.Hits {
		result := SearchResult{
			Path:  getFieldString(hit.Fields, "path"),
			Title: getFieldString(hit.Fields, "title"),
			Score: hit.Score,
		}

		if len(hit.Fragments) > 0 {
			if contentFragments, ok := hit.Fragments["content"]; ok && len(contentFragments) > 0 {
				for _, fragment := range contentFragments {
					cleanFragment := CleanupFragment(fragment)
					if cleanFragment != "" {
						result.Fragments = append(result.Fragments, cleanFragment)
					}
				}
			}
		}

		searchResults.Results = append(searchResults.Results, result)
	}

	return searchResults, nil
}

func getSearchIndex() (bleve.Index, error) { //nolint:ireturn
	searchIndexOnce.Do(func() {
		searchIndex, searchIndexErr = buildSearchIndex()
	})

	return searchIndex, searchIndexErr
}

func buildSearchIndex() (bleve.Index, error) { //nolint:ireturn
	indexMapping := buildIndexMapping()

	index, err := bleve.NewMemOnly(indexMapping)
	if err != nil {
		return nil, fmt.Errorf("failed to create index: %w", err)
	}

	err = fs.WalkDir(docsembed.DocsFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		if !strings.HasSuffix(path, ".mdx") && !strings.HasSuffix(path, ".md") {
			return nil
		}

		// Skip deprecated documentation
		if IsDeprecatedPath(path) {
			return nil
		}

		data, readErr := docsembed.DocsFS.ReadFile(path)
		if readErr != nil {
			return nil //nolint:nilerr // Skip files we can't read
		}

		content := string(data)
		title := ExtractTitle(content)
		keywords := ExtractKeywords(content)
		cleanContent := StripFrontmatter(content)

		doc := DocPage{
			Path:     "/" + strings.TrimSuffix(strings.TrimSuffix(path, ".mdx"), ".md"),
			Title:    title,
			Keywords: keywords,
			Content:  cleanContent,
		}

		if indexErr := index.Index(path, doc); indexErr != nil {
			return nil //nolint:nilerr // Skip files we can't index
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to walk docs: %w", err)
	}

	return index, nil
}

func buildSearchQuery(queryStr string) query.Query { //nolint:ireturn
	keywordsMatch := bleve.NewMatchQuery(queryStr)
	keywordsMatch.SetField("keywords")
	keywordsMatch.SetBoost(15.0) //nolint:mnd

	// Title exact phrase match (very high boost)
	titlePhrase := bleve.NewMatchPhraseQuery(queryStr)
	titlePhrase.SetField("title")
	titlePhrase.SetBoost(10.0) //nolint:mnd

	// Content phrase match (high boost)
	contentPhrase := bleve.NewMatchPhraseQuery(queryStr)
	contentPhrase.SetField("content")
	contentPhrase.SetBoost(5.0) //nolint:mnd

	// Title match (medium boost) - for partial/individual word matches
	titleMatch := bleve.NewMatchQuery(queryStr)
	titleMatch.SetField("title")
	titleMatch.SetBoost(3.0) //nolint:mnd

	// Content match (baseline) - for individual word matches
	contentMatch := bleve.NewMatchQuery(queryStr)
	contentMatch.SetField("content")
	contentMatch.SetBoost(1.0)

	// Path match - useful for finding by path segments
	pathMatch := bleve.NewMatchQuery(queryStr)
	pathMatch.SetField("path")
	pathMatch.SetBoost(2.0) //nolint:mnd

	// Combine all queries with OR (disjunction)
	return bleve.NewDisjunctionQuery(
		keywordsMatch,
		titlePhrase,
		contentPhrase,
		titleMatch,
		contentMatch,
		pathMatch,
	)
}

func buildIndexMapping() *mapping.IndexMappingImpl {
	indexMapping := bleve.NewIndexMapping()

	docMapping := bleve.NewDocumentMapping()

	pathFieldMapping := bleve.NewTextFieldMapping()
	pathFieldMapping.Store = true
	pathFieldMapping.IncludeTermVectors = true
	docMapping.AddFieldMappingsAt("path", pathFieldMapping)

	titleFieldMapping := bleve.NewTextFieldMapping()
	titleFieldMapping.Store = true
	titleFieldMapping.IncludeTermVectors = true
	titleFieldMapping.Analyzer = "en"
	docMapping.AddFieldMappingsAt("title", titleFieldMapping)

	keywordsFieldMapping := bleve.NewTextFieldMapping()
	keywordsFieldMapping.Store = true
	keywordsFieldMapping.IncludeTermVectors = true
	keywordsFieldMapping.Analyzer = "en"
	docMapping.AddFieldMappingsAt("keywords", keywordsFieldMapping)

	contentFieldMapping := bleve.NewTextFieldMapping()
	contentFieldMapping.Store = true
	contentFieldMapping.IncludeTermVectors = true
	contentFieldMapping.Analyzer = "en"
	docMapping.AddFieldMappingsAt("content", contentFieldMapping)

	indexMapping.AddDocumentMapping("docpage", docMapping)
	indexMapping.DefaultMapping = docMapping

	return indexMapping
}

func getFieldString(fields map[string]any, key string) string {
	if val, ok := fields[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}

	return ""
}

// ExtractTitle extracts the title from frontmatter.
func ExtractTitle(content string) string {
	titleRegex := regexp.MustCompile(`(?m)^title:\s*["']?([^"'\n]+)["']?\s*$`)
	matches := titleRegex.FindStringSubmatch(content)

	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}

	return ""
}

// ExtractKeywords extracts keywords from frontmatter.
func ExtractKeywords(content string) string {
	// Match keywords array in frontmatter: keywords: ["word1", "word2"] or keywords: [word1, word2]
	keywordsRegex := regexp.MustCompile(`(?m)^keywords:\s*\[([^\]]+)\]`)
	matches := keywordsRegex.FindStringSubmatch(content)

	if len(matches) > 1 {
		// Clean up the keywords: remove quotes, trim spaces
		raw := matches[1]
		raw = strings.ReplaceAll(raw, "\"", "")
		raw = strings.ReplaceAll(raw, "'", "")

		// Split by comma and rejoin with spaces for better indexing
		parts := strings.Split(raw, ",")

		var keywords []string
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				keywords = append(keywords, trimmed)
			}
		}

		return strings.Join(keywords, " ")
	}

	return ""
}

// StripFrontmatter removes YAML frontmatter from content.
func StripFrontmatter(content string) string {
	frontmatterRegex := regexp.MustCompile(`(?s)^---\n.*?\n---\n*`)
	return frontmatterRegex.ReplaceAllString(content, "")
}

// CleanupFragment cleans up a search result fragment for display.
func CleanupFragment(fragment string) string {
	// Convert HTML highlight marks to ANSI bold yellow
	fragment = strings.ReplaceAll(fragment, "<mark>", "\033[1;33m")
	fragment = strings.ReplaceAll(fragment, "</mark>", "\033[0m")

	// Decode common HTML entities first
	cleaned := strings.ReplaceAll(fragment, "&#34;", "\"")
	cleaned = strings.ReplaceAll(cleaned, "&#39;", "'")
	cleaned = strings.ReplaceAll(cleaned, "&quot;", "\"")
	cleaned = strings.ReplaceAll(cleaned, "&amp;", "&")
	cleaned = strings.ReplaceAll(cleaned, "&lt;", "<")
	cleaned = strings.ReplaceAll(cleaned, "&gt;", ">")

	// Remove complete MDX/HTML tags
	mdxTagRegex := regexp.MustCompile(`</?[A-Za-z][^>]*>`)
	cleaned = mdxTagRegex.ReplaceAllString(cleaned, "")

	// Remove truncated tag fragments (like "…pandable>" or "able>")
	truncatedTagRegex := regexp.MustCompile(`…?[a-zA-Z]+>`)
	cleaned = truncatedTagRegex.ReplaceAllString(cleaned, "")

	// Remove truncated tag fragments at end (like "<Expandable title="prop")
	endFragmentRegex := regexp.MustCompile(`<[^>]*$`)
	cleaned = endFragmentRegex.ReplaceAllString(cleaned, "")

	cleaned = strings.ReplaceAll(cleaned, "```", "")

	lines := strings.Split(cleaned, "\n")

	var result []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return strings.Join(result, "\n")
}
