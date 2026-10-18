package resolve_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/resolve"
)

const (
	docsPage = "docs/src/content/docs/products/auth/sign-in-magic-link.mdx"
	blogPost = "landing/src/pages/blog/stub-post.mdx"
)

func readFixture(t *testing.T, name string) []byte {
	t.Helper()

	data, err := os.ReadFile(filepath.Join("testdata", "blog", name))
	if err != nil {
		t.Fatalf("reading fixture: %v", err)
	}

	return data
}

func newResolver(t *testing.T, rulesDir string) *resolve.Resolver {
	t.Helper()

	r, err := resolve.New(filepath.Join("testdata", rulesDir))
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	return r
}

func TestResolve(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		path        string
		scope       string
		fixture     string
		voice       string
		want        resolve.Result
		wantErr     error
		wantErrText string
	}{
		{
			name:  "scope only, docs",
			scope: "docs",
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name:  "scope only, blog with voice flag",
			scope: "blog",
			voice: "nuno-pato",
			want: resolve.Result{
				Scope: "blog", Voice: "nuno-pato", Excluded: false, Reason: "voice flag",
			},
		},
		{
			name:        "scope only, blog without voice",
			scope:       "blog",
			wantErr:     resolve.ErrVoiceRequired,
			wantErrText: "--voice required: no author listed in export const article",
		},
		{
			name:  "scope plus a path outside both trees",
			path:  "README.md",
			scope: "docs",
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name:  "scope flag beats the path tree",
			path:  docsPage,
			scope: "blog",
			voice: "nhost-blog",
			want: resolve.Result{
				Scope: "blog", Voice: "nhost-blog", Excluded: false, Reason: "voice flag",
			},
		},
		{
			name: "docs path",
			path: docsPage,
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name: "docs path with OS separators and a leading dot",
			path: filepath.Join(".", filepath.FromSlash(docsPage)),
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name:  "docs path with voice flag",
			path:  docsPage,
			voice: "nhost-docs",
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "voice flag",
			},
		},
		{
			name:    "single known author",
			path:    blogPost,
			fixture: "single-profiled.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "david-barroso", Excluded: false, Reason: "byline match",
			},
		},
		{
			name:    "single known author, double-quoted fields",
			path:    blogPost,
			fixture: "double-quoted.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "nuno-pato", Excluded: false, Reason: "byline match",
			},
		},
		{
			name:        "co-authored post",
			path:        blogPost,
			fixture:     "co-authored.mdx",
			wantErr:     resolve.ErrVoiceRequired,
			wantErrText: "--voice required: 2 authors listed (David Barroso, Nuno Pato)",
		},
		{
			name:    "co-authored post with voice flag",
			path:    blogPost,
			fixture: "co-authored.mdx",
			voice:   "nuno-pato",
			want: resolve.Result{
				Scope: "blog", Voice: "nuno-pato", Excluded: false, Reason: "voice flag",
			},
		},
		{
			name:    "single unprofiled author",
			path:    blogPost,
			fixture: "unprofiled.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "nhost-blog", Excluded: false, Reason: "unprofiled author",
			},
		},
		{
			name:    "bare byline David is not David Barroso",
			path:    blogPost,
			fixture: "bare-david.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "nhost-blog", Excluded: false, Reason: "unprofiled author",
			},
		},
		{
			name:    "voice flag nhost-blog beats a profiled byline",
			path:    blogPost,
			fixture: "single-profiled.mdx",
			voice:   "nhost-blog",
			want: resolve.Result{
				Scope: "blog", Voice: "nhost-blog", Excluded: false, Reason: "voice flag",
			},
		},
		{
			name:        "empty authors list",
			path:        blogPost,
			fixture:     "no-authors.mdx",
			wantErr:     resolve.ErrVoiceRequired,
			wantErrText: "--voice required: no author listed in export const article",
		},
		{
			name:    "authors outside an article export are ignored",
			path:    blogPost,
			fixture: "no-article.mdx",
			wantErr: resolve.ErrVoiceRequired,
		},
		{
			name:        "authors in the body after the export are ignored",
			path:        blogPost,
			fixture:     "body-authors.mdx",
			wantErr:     resolve.ErrVoiceRequired,
			wantErrText: "--voice required: no author listed in export const article",
		},
		{
			name:    "export with nested objects, braces in strings and comments",
			path:    blogPost,
			fixture: "nested-article.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "nuno-pato", Excluded: false, Reason: "byline match",
			},
		},
		{
			name:        "export whose braces never balance",
			path:        blogPost,
			fixture:     "unbalanced-article.mdx",
			wantErr:     resolve.ErrVoiceRequired,
			wantErrText: "--voice required: no author listed in export const article",
		},
		{
			name: "excluded generated page under a directory glob",
			path: "docs/src/content/docs/reference/cli/commands.mdx",
			want: resolve.Result{
				Scope: "docs", Voice: "", Excluded: true, Reason: "generated page",
			},
		},
		{
			name: "excluded generated page by exact path",
			path: "docs/src/content/docs/products/database/extensions.mdx",
			want: resolve.Result{
				Scope: "docs", Voice: "", Excluded: true, Reason: "generated page",
			},
		},
		{
			name:  "exclusion beats the voice flag",
			path:  "docs/src/content/docs/reference/javascript/auth/client.mdx",
			voice: "nhost-docs",
			want: resolve.Result{
				Scope: "docs", Voice: "", Excluded: true, Reason: "generated page",
			},
		},
		{
			name: "sibling of an excluded directory is not excluded",
			path: "docs/src/content/docs/reference/cli.mdx",
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name:        "no path and no scope",
			wantErr:     resolve.ErrScopeRequired,
			wantErrText: "--scope required: no path given",
		},
		{
			name:        "path outside both trees and no scope",
			path:        "services/auth/README.md",
			wantErr:     resolve.ErrScopeRequired,
			wantErrText: "--scope required: services/auth/README.md is outside the docs and blog trees",
		},
		{
			name:        "invalid scope",
			path:        docsPage,
			scope:       "landing",
			wantErr:     resolve.ErrInvalidScope,
			wantErrText: `--scope must be docs or blog: got "landing"`,
		},
		{
			name:    "voice flag naming no profile",
			path:    docsPage,
			voice:   "johan-eliasson",
			wantErr: resolve.ErrUnknownVoice,
		},
	}

	r := newResolver(t, "rules")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var frontmatter []byte
			if tt.fixture != "" {
				frontmatter = readFixture(t, tt.fixture)
			}

			got, err := r.Resolve(tt.path, tt.scope, frontmatter, tt.voice)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Resolve() error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantErrText != "" && err.Error() != tt.wantErrText {
				t.Errorf("Resolve() error = %q, want %q", err.Error(), tt.wantErrText)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestResolveDefaultsWithoutProfiles(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		path    string
		fixture string
		voice   string
		want    resolve.Result
		wantErr error
	}{
		{
			name: "docs default without nhost-docs.md",
			path: docsPage,
			want: resolve.Result{
				Scope: "docs", Voice: "nhost-docs", Excluded: false, Reason: "docs default",
			},
		},
		{
			name:    "unprofiled author without nhost-blog.md",
			path:    blogPost,
			fixture: "unprofiled.mdx",
			want: resolve.Result{
				Scope: "blog", Voice: "nhost-blog", Excluded: false, Reason: "unprofiled author",
			},
		},
		{
			name:    "voice flag needs the profile",
			path:    blogPost,
			fixture: "unprofiled.mdx",
			voice:   "nhost-blog",
			wantErr: resolve.ErrUnknownVoice,
		},
	}

	r := newResolver(t, "authors-only")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var frontmatter []byte
			if tt.fixture != "" {
				frontmatter = readFixture(t, tt.fixture)
			}

			got, err := r.Resolve(tt.path, "", frontmatter, tt.voice)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Resolve() error = %v, want %v", err, tt.wantErr)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNew(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		rulesDir string
		wantErr  error
		wantText string
	}{
		{
			name:     "valid rules dir",
			rulesDir: "rules",
		},
		{
			name:     "missing voices dir",
			rulesDir: "does-not-exist",
			wantErr:  os.ErrNotExist,
			wantText: "reading voice profiles",
		},
		{
			name:     "profile without a header",
			rulesDir: "bad/no-header",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: "no leading --- header",
		},
		{
			name:     "profile without a slug",
			rulesDir: "bad/no-slug",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: "header has no slug",
		},
		{
			name:     "unterminated header",
			rulesDir: "bad/unterminated",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: "unterminated --- header",
		},
		{
			name:     "duplicate slug",
			rulesDir: "bad/duplicate-slug",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: `slug "david-barroso" is used twice`,
		},
		{
			name:     "duplicate byline",
			rulesDir: "bad/duplicate-byline",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: `byline "David Barroso" is also used by`,
		},
		{
			name:     "scope default with a byline",
			rulesDir: "bad/default-byline",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: "nhost-blog is a scope default and takes no byline",
		},
		{
			name:     "since that is not a date",
			rulesDir: "bad/bad-since",
			wantErr:  resolve.ErrInvalidProfile,
			wantText: `since "January 2024" is not a YYYY-MM-DD date`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := resolve.New(filepath.Join("testdata", tt.rulesDir))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("New() error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantText != "" && !strings.Contains(err.Error(), tt.wantText) {
				t.Errorf("New() error = %q, want it to contain %q", err.Error(), tt.wantText)
			}
		})
	}
}

func TestResolverProfile(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		slug   string
		want   resolve.Profile
		wantOK bool
	}{
		{
			name: "house voice with a window, ignoring other keys and indented lines",
			slug: "nhost-blog",
			want: resolve.Profile{
				Slug:   "nhost-blog",
				Byline: "",
				Since:  time.Date(2024, time.January, 1, 0, 0, 0, 0, time.UTC),
			},
			wantOK: true,
		},
		{
			name: "quoted slug and byline",
			slug: "nuno-pato",
			want: resolve.Profile{
				Slug: "nuno-pato", Byline: "Nuno Pato", Since: time.Time{},
			},
			wantOK: true,
		},
		{
			name: "docs voice without a byline",
			slug: "nhost-docs",
			want: resolve.Profile{
				Slug: "nhost-docs", Byline: "", Since: time.Time{},
			},
			wantOK: true,
		},
		{
			name:   "no profile with the slug",
			slug:   "johan-eliasson",
			want:   resolve.Profile{Slug: "", Byline: "", Since: time.Time{}},
			wantOK: false,
		},
	}

	r := newResolver(t, "rules")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := r.Profile(tt.slug)
			if ok != tt.wantOK {
				t.Fatalf("Profile(%q) ok = %v, want %v", tt.slug, ok, tt.wantOK)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Profile(%q) mismatch (-want +got):\n%s", tt.slug, diff)
			}
		})
	}
}

func TestArticleDate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		fixture string
		want    time.Time
		wantErr error
	}{
		{
			name:    "single-quoted date",
			fixture: "single-profiled.mdx",
			want:    time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "double-quoted date",
			fixture: "double-quoted.mdx",
			want:    time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "date after nested objects",
			fixture: "nested-article.mdx",
			want:    time.Date(2026, time.January, 6, 0, 0, 0, 0, time.UTC),
		},
		{
			name:    "date in the body only",
			fixture: "body-date.mdx",
			wantErr: resolve.ErrNoDate,
		},
		{
			name:    "date that does not parse",
			fixture: "bad-date.mdx",
			wantErr: resolve.ErrNoDate,
		},
		{
			name:    "no article export",
			fixture: "no-article.mdx",
			wantErr: resolve.ErrNoDate,
		},
		{
			name:    "export whose braces never balance",
			fixture: "unbalanced-article.mdx",
			wantErr: resolve.ErrNoDate,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolve.ArticleDate(readFixture(t, tt.fixture))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ArticleDate() error = %v, want %v", err, tt.wantErr)
			}

			if !got.Equal(tt.want) {
				t.Errorf("ArticleDate() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExclusionList(t *testing.T) {
	t.Parallel()

	r := newResolver(t, "rules")

	globs := strings.Split(strings.TrimSuffix(resolve.ExclusionList(), "\n"), "\n")
	if len(globs) == 0 || !strings.HasSuffix(resolve.ExclusionList(), "\n") {
		t.Fatalf("ExclusionList() = %q, want newline-terminated globs", resolve.ExclusionList())
	}

	for _, glob := range globs {
		t.Run(glob, func(t *testing.T) {
			t.Parallel()

			page := strings.Replace(glob, "**", "nested/page.mdx", 1)

			got, err := r.Resolve("docs/src/content/docs/"+page, "", nil, "")
			if err != nil {
				t.Fatalf("Resolve() error = %v", err)
			}

			if !got.Excluded {
				t.Errorf("Resolve(%q) = %+v, want excluded", page, got)
			}
		})
	}
}

func TestTableMarkdown(t *testing.T) {
	t.Parallel()

	const (
		header = "| Input | Scope | Voice |\n| --- | --- | --- |\n"
		rows   = 10
	)

	table := resolve.TableMarkdown()
	if !strings.HasPrefix(table, header) {
		t.Errorf("TableMarkdown() does not start with the table header:\n%s", table)
	}

	if got := strings.Count(strings.TrimPrefix(table, header), "\n"); got != rows {
		t.Errorf("TableMarkdown() has %d rows, want %d", got, rows)
	}
}
