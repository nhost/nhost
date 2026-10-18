package corpus_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/corpus"
	"github.com/nhost/nhost/tools/writing/internal/resolve"
)

const (
	blog = "landing/src/pages/blog/"
	docs = "docs/src/content/docs/"

	resolvesToBlog = "resolves to nhost-blog"
	resolvesToDocs = "resolves to nhost-docs"
	coAuthored     = "resolve error: --voice required: 2 authors listed (David Barroso, Nuno Pato)"
	outsideTrees   = "resolve error: --scope required: README.md is outside the docs and blog trees"
	generated      = "excluded: generated page"
	notBlog        = "not a blog post: resolves to scope docs"
	unprofiled     = "unprofiled author"
)

// candidates maps the repository path each candidate claims to the fixture
// holding its source, so the filter sees the tree layout without reading
// landing/ or docs/.
func candidates(t *testing.T) []corpus.Document {
	t.Helper()

	fixtures := []struct{ path, fixture string }{
		{blog + "co-authored.mdx", "blog/co-authored.mdx"},
		{blog + "david-2024.mdx", "blog/david-2024.mdx"},
		{blog + "nuno-2023.mdx", "blog/nuno-2023.mdx"},
		{blog + "nuno-2025.mdx", "blog/nuno-2025.mdx"},
		{"./" + blog + "nuno-2025.mdx", "blog/nuno-2025.mdx"},
		{blog + "nuno-held-out.mdx", "blog/nuno-held-out.mdx"},
		{blog + "johan-2019.mdx", "blog/johan-2019.mdx"},
		{blog + "undated.mdx", "blog/undated.mdx"},
		{blog + "unprofiled.mdx", "blog/unprofiled.mdx"},
		{docs + "guide.mdx", "docs/page.mdx"},
		{docs + "held-out.mdx", "docs/page.mdx"},
		{docs + "reference/cli/commands.mdx", "docs/page.mdx"},
		{"README.md", "docs/page.mdx"},
	}

	out := make([]corpus.Document, 0, len(fixtures))

	for _, f := range fixtures {
		data, err := os.ReadFile(filepath.Join("testdata", f.fixture))
		if err != nil {
			t.Fatalf("reading fixture: %v", err)
		}

		out = append(out, corpus.Document{Path: f.path, Source: data})
	}

	return out
}

func TestSelect(t *testing.T) {
	t.Parallel()

	heldOut := []string{blog + "nuno-held-out.mdx", "./" + docs + "held-out.mdx"}

	tests := []struct {
		name        string
		voice       string
		wantKept    []string
		wantHeldOut []string
		wantSkipped []corpus.Skip
	}{
		{
			name:        "named author keeps only byline matches, at any date",
			voice:       "nuno-pato",
			wantKept:    []string{blog + "nuno-2023.mdx", blog + "nuno-2025.mdx"},
			wantHeldOut: []string{blog + "nuno-held-out.mdx"},
			wantSkipped: []corpus.Skip{
				{Path: "README.md", Reason: outsideTrees},
				{Path: docs + "guide.mdx", Reason: resolvesToDocs},
				{Path: docs + "held-out.mdx", Reason: resolvesToDocs},
				{Path: docs + "reference/cli/commands.mdx", Reason: generated},
				{Path: blog + "co-authored.mdx", Reason: coAuthored},
				{Path: blog + "david-2024.mdx", Reason: "resolves to david-barroso"},
				{Path: blog + "johan-2019.mdx", Reason: resolvesToBlog},
				{Path: blog + "nuno-2025.mdx", Reason: "listed twice"},
				{Path: blog + "undated.mdx", Reason: "resolves to david-barroso"},
				{Path: blog + "unprofiled.mdx", Reason: resolvesToBlog},
			},
		},
		{
			name:        "named author without a window keeps an undated post",
			voice:       "david-barroso",
			wantKept:    []string{blog + "david-2024.mdx", blog + "undated.mdx"},
			wantHeldOut: nil,
			wantSkipped: []corpus.Skip{
				{Path: "README.md", Reason: outsideTrees},
				{Path: docs + "guide.mdx", Reason: resolvesToDocs},
				{Path: docs + "held-out.mdx", Reason: resolvesToDocs},
				{Path: docs + "reference/cli/commands.mdx", Reason: generated},
				{Path: blog + "co-authored.mdx", Reason: coAuthored},
				{Path: blog + "johan-2019.mdx", Reason: resolvesToBlog},
				{Path: blog + "nuno-2023.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "nuno-2025.mdx", Reason: "listed twice"},
				{Path: blog + "nuno-2025.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "nuno-held-out.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "unprofiled.mdx", Reason: resolvesToBlog},
			},
		},
		{
			name:        "house voice pools profiled authors' posts in its window",
			voice:       "nhost-blog",
			wantKept:    []string{blog + "david-2024.mdx", blog + "nuno-2025.mdx"},
			wantHeldOut: []string{blog + "nuno-held-out.mdx"},
			wantSkipped: []corpus.Skip{
				{Path: "README.md", Reason: outsideTrees},
				{Path: docs + "guide.mdx", Reason: notBlog},
				{Path: docs + "held-out.mdx", Reason: notBlog},
				{Path: docs + "reference/cli/commands.mdx", Reason: generated},
				{Path: blog + "co-authored.mdx", Reason: coAuthored},
				{Path: blog + "johan-2019.mdx", Reason: unprofiled},
				{Path: blog + "nuno-2023.mdx", Reason: "dated 2023-06-01, before since 2024-01-01"},
				{Path: blog + "nuno-2025.mdx", Reason: "listed twice"},
				{Path: blog + "undated.mdx", Reason: "no date in export const article"},
				{Path: blog + "unprofiled.mdx", Reason: unprofiled},
			},
		},
		{
			name:        "docs voice keeps hand-written pages, not generated ones",
			voice:       "nhost-docs",
			wantKept:    []string{docs + "guide.mdx"},
			wantHeldOut: []string{docs + "held-out.mdx"},
			wantSkipped: []corpus.Skip{
				{Path: "README.md", Reason: outsideTrees},
				{Path: docs + "reference/cli/commands.mdx", Reason: generated},
				{Path: blog + "co-authored.mdx", Reason: coAuthored},
				{Path: blog + "david-2024.mdx", Reason: "resolves to david-barroso"},
				{Path: blog + "johan-2019.mdx", Reason: resolvesToBlog},
				{Path: blog + "nuno-2023.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "nuno-2025.mdx", Reason: "listed twice"},
				{Path: blog + "nuno-2025.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "nuno-held-out.mdx", Reason: "resolves to nuno-pato"},
				{Path: blog + "undated.mdx", Reason: "resolves to david-barroso"},
				{Path: blog + "unprofiled.mdx", Reason: resolvesToBlog},
			},
		},
	}

	r, err := resolve.New(filepath.Join("testdata", "rules"))
	if err != nil {
		t.Fatalf("resolve.New: %v", err)
	}

	docs := candidates(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := corpus.Select(r, tt.voice, heldOut, docs)
			if err != nil {
				t.Fatalf("Select() error = %v", err)
			}

			kept := make([]string, 0, len(got.Kept))
			for _, doc := range got.Kept {
				kept = append(kept, doc.Path)
			}

			if diff := cmp.Diff(tt.wantKept, kept); diff != "" {
				t.Errorf("Select() kept mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tt.wantHeldOut, got.HeldOut); diff != "" {
				t.Errorf("Select() held out mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tt.wantSkipped, got.Skipped); diff != "" {
				t.Errorf("Select() skipped mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSelectUnknownVoice(t *testing.T) {
	t.Parallel()

	r, err := resolve.New(filepath.Join("testdata", "rules"))
	if err != nil {
		t.Fatalf("resolve.New: %v", err)
	}

	_, err = corpus.Select(r, "johan-eliasson", nil, candidates(t))
	if !errors.Is(err, resolve.ErrUnknownVoice) {
		t.Errorf("Select() error = %v, want %v", err, resolve.ErrUnknownVoice)
	}
}
