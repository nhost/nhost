package docssearch

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"

	docsembed "github.com/nhost/nhost/docs-starlight"
)

// getAllPagePaths returns all non-deprecated page paths by walking the embedded filesystem.
func getAllPagePaths() []string {
	var paths []string

	_ = fs.WalkDir(
		docsembed.DocsFS,
		docsembed.DocsRoot,
		func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil //nolint:nilerr
			}

			if !strings.HasSuffix(path, ".mdx") && !strings.HasSuffix(path, ".md") {
				return nil
			}

			pagePath := filePathToPagePath(path)
			if !isDeprecatedPath(pagePath) {
				paths = append(paths, pagePath)
			}

			return nil
		},
	)

	sort.Strings(paths)

	return paths
}

// PageInfo contains metadata about a documentation page.
type PageInfo struct {
	Path        string
	Title       string
	Description string
}

// getPageInfo returns the title and description for a given page path.
func getPageInfo(pagePath string) PageInfo {
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
func GetAllPagesWithInfo() []PageInfo {
	paths := getAllPagePaths()
	pages := make([]PageInfo, 0, len(paths))

	for _, path := range paths {
		pages = append(pages, getPageInfo(path))
	}

	return pages
}

// isDeprecatedPath checks if a path is in a deprecated section.
func isDeprecatedPath(path string) bool {
	return strings.Contains(path, "/deprecated/") || strings.Contains(path, "deprecated/")
}

// ReadPageBytes reads a documentation page by path and returns the raw bytes.
func ReadPageBytes(pagePath string) ([]byte, error) {
	normalizedPath := normalizePath(pagePath)
	fsPath := filepath.Join(docsembed.DocsRoot, normalizedPath)

	// Try direct path and index path for each extension
	candidates := []string{
		fsPath + ".mdx",
		fsPath + ".md",
		filepath.Join(fsPath, "index.mdx"),
		filepath.Join(fsPath, "index.md"),
	}

	for _, filePath := range candidates {
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

// normalizePath normalizes a page path for file lookup.
func normalizePath(path string) string {
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimSuffix(path, ".mdx")
	path = strings.TrimSuffix(path, ".md")

	return path
}

// filePathToPagePath converts an embedded filesystem path to a documentation page path.
func filePathToPagePath(fsPath string) string {
	// Remove the DocsRoot prefix
	pagePath := strings.TrimPrefix(fsPath, docsembed.DocsRoot)
	pagePath = strings.TrimPrefix(pagePath, "/")

	// Remove file extension
	pagePath = strings.TrimSuffix(pagePath, ".mdx")
	pagePath = strings.TrimSuffix(pagePath, ".md")

	// Remove trailing /index for index pages, and handle root index
	pagePath = strings.TrimSuffix(pagePath, "/index")
	if pagePath == "index" {
		pagePath = ""
	}

	return "/" + pagePath
}
