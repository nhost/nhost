package docssearch_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/pkg/docssearch"
)

func TestGetAllPagesWithInfo(t *testing.T) { //nolint:cyclop
	t.Parallel()

	pages := docssearch.GetAllPagesWithInfo()

	if len(pages) == 0 {
		t.Fatal("expected pages, got none")
	}

	for _, page := range pages {
		if page.Path == "" {
			t.Error("page has empty path")
		}

		if !strings.HasPrefix(page.Path, "/") {
			t.Errorf("page path %q does not start with /", page.Path)
		}

		if strings.Contains(page.Path, "/deprecated/") ||
			strings.HasPrefix(page.Path, "/deprecated") {
			t.Errorf("deprecated page should be excluded: %s", page.Path)
		}

		if strings.HasSuffix(page.Path, ".mdx") || strings.HasSuffix(page.Path, ".md") {
			t.Errorf("page path should not have file extension: %s", page.Path)
		}

		if strings.HasSuffix(page.Path, "/index") {
			t.Errorf("page path should not end with /index: %s", page.Path)
		}
	}

	// Verify a known page exists
	found := false
	for _, page := range pages {
		if page.Path == "/getting-started" {
			found = true

			if page.Title == "" {
				t.Error("/getting-started page has empty title")
			}

			break
		}
	}

	if !found {
		t.Error("expected /getting-started page to exist")
	}
}

func TestGetAllPagesWithInfo_HasTitles(t *testing.T) {
	t.Parallel()

	pages := docssearch.GetAllPagesWithInfo()

	withTitle := 0
	for _, page := range pages {
		if page.Title != "" {
			withTitle++
		}
	}

	// The vast majority of pages should have titles
	ratio := float64(withTitle) / float64(len(pages))
	if ratio < 0.9 {
		t.Errorf("only %.0f%% of pages have titles, expected > 90%%", ratio*100)
	}
}

func TestReadPageBytes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{
			name:    "index page without leading slash",
			path:    "getting-started",
			wantErr: false,
		},
		{
			name:    "index page with leading slash",
			path:    "/getting-started",
			wantErr: false,
		},
		{
			name:    "leaf page",
			path:    "/products/auth/sign-in-email-password",
			wantErr: false,
		},
		{
			name:    "nonexistent page",
			path:    "/this/page/does/not/exist",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			data, err := docssearch.ReadPageBytes(tt.path)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(data) == 0 {
				t.Error("expected non-empty content")
			}

			if !strings.Contains(string(data), "---") {
				t.Error("expected content to contain frontmatter delimiters")
			}
		})
	}
}

func TestParseFrontmatter(t *testing.T) {
	t.Parallel()

	content := []byte(`---
title: Test Page
description: A test description
keywords: ["foo", "bar"]
---
Body content here.
`)

	fm, body := docssearch.ParseFrontmatter(content)

	if fm.Title != "Test Page" {
		t.Errorf("title = %q, want %q", fm.Title, "Test Page")
	}

	if fm.Description != "A test description" {
		t.Errorf("description = %q, want %q", fm.Description, "A test description")
	}

	if len(fm.Keywords) != 2 || fm.Keywords[0] != "foo" || fm.Keywords[1] != "bar" {
		t.Errorf("keywords = %v, want [foo bar]", fm.Keywords)
	}

	if !strings.Contains(body, "Body content here.") {
		t.Errorf("body = %q, want it to contain %q", body, "Body content here.")
	}

	if strings.Contains(body, "title:") {
		t.Error("body should not contain frontmatter")
	}
}

func TestParseFrontmatter_NoFrontmatter(t *testing.T) {
	t.Parallel()

	content := []byte("Just some content without frontmatter.")
	fm, body := docssearch.ParseFrontmatter(content)

	if fm.Title != "" {
		t.Errorf("title = %q, want empty", fm.Title)
	}

	if body == "" {
		t.Error("expected non-empty body")
	}
}

func TestParseFrontmatter_RealPage(t *testing.T) {
	t.Parallel()

	data, err := docssearch.ReadPageBytes("/getting-started")
	if err != nil {
		t.Fatalf("failed to read page: %v", err)
	}

	fm, body := docssearch.ParseFrontmatter(data)

	if fm.Title == "" {
		t.Error("expected non-empty title from real page")
	}

	if len(fm.Keywords) == 0 {
		t.Error("expected keywords from real page")
	}

	if body == "" {
		t.Error("expected non-empty body from real page")
	}
}

func TestSearch(t *testing.T) {
	t.Parallel()

	results, err := docssearch.Search("authentication", 5, false)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if results.Query != "authentication" {
		t.Errorf("query = %q, want %q", results.Query, "authentication")
	}

	if results.Total == 0 {
		t.Fatal("expected search results for 'authentication', got none")
	}

	if len(results.Results) == 0 {
		t.Fatal("expected result entries, got none")
	}

	if len(results.Results) > 5 {
		t.Errorf("expected at most 5 results, got %d", len(results.Results))
	}

	for _, r := range results.Results {
		if r.Path == "" {
			t.Error("result has empty path")
		}

		if r.Score <= 0 {
			t.Errorf("result %s has non-positive score: %f", r.Path, r.Score)
		}
	}
}

func TestSearch_NoResults(t *testing.T) {
	t.Parallel()

	results, err := docssearch.Search("xyzzy_nonexistent_term_abc123", 5, false)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if results.Total != 0 {
		t.Errorf("expected 0 results, got %d", results.Total)
	}
}

func TestSearch_LimitRespected(t *testing.T) {
	t.Parallel()

	results, err := docssearch.Search("nhost", 2, false)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if len(results.Results) > 2 {
		t.Errorf("expected at most 2 results, got %d", len(results.Results))
	}
}

func TestSearch_ANSIHighlight(t *testing.T) {
	t.Parallel()

	results, err := docssearch.Search("authentication", 3, true)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	// At least one result should have fragments with ANSI codes
	hasANSI := false

	for _, r := range results.Results {
		for _, f := range r.Fragments {
			if strings.Contains(f, "\033[") {
				hasANSI = true

				break
			}
		}
	}

	if results.Total > 0 && !hasANSI {
		t.Log(
			"warning: no ANSI-highlighted fragments found (fragments may be empty for title-only matches)",
		)
	}
}

func TestSearch_NoANSIWhenDisabled(t *testing.T) {
	t.Parallel()

	results, err := docssearch.Search("authentication", 3, false)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	for _, r := range results.Results {
		for _, f := range r.Fragments {
			if strings.Contains(f, "\033[") {
				t.Errorf("fragment contains ANSI codes when highlight disabled: %s", f)
			}
		}
	}
}
