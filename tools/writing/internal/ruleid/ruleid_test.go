package ruleid_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
)

func TestDefinitions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		src  string
		want []string
	}{
		{
			name: "definition lines in order",
			src:  "- **WR-STYLE-02** b\n- **WR-CONTENT-01** a\n- **DOCS-03** c\n- **BLOG-04** d\n",
			want: []string{"WR-STYLE-02", "WR-CONTENT-01", "DOCS-03", "BLOG-04"},
		},
		{
			name: "citations are not definitions",
			src:  "See WR-CONTENT-01 and **DOCS-02**.\n| WR-ANTI-01 |\n",
			want: []string{},
		},
		{
			name: "indented or double-spaced bullets are not definitions",
			src:  "  - **WR-ANTI-02** x\n-  **WR-ANTI-03** y\n* **WR-ANTI-04** z\n",
			want: []string{},
		},
		{
			name: "unknown scope family is not an ID",
			src:  "- **TGT-LANDING-01** x\n- **WR-content-01** y\n",
			want: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, ruleid.Definitions([]byte(tt.src))); diff != "" {
				t.Errorf("Definitions() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCitations(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		src  string
		want []string
	}{
		{
			name: "Vale message styles and repeats",
			src: "message: \"DOCS-06: use →\"\nmessage: \"Use '%s'. (WR-STYLE-12)\"\n" +
				"| 1 | WR-CONTENT-03 |\n| 2 | WR-CONTENT-03 |\n",
			want: []string{"DOCS-06", "WR-STYLE-12", "WR-CONTENT-03", "WR-CONTENT-03"},
		},
		{
			name: "definitions are citations too",
			src:  "- **BLOG-01** a post",
			want: []string{"BLOG-01"},
		},
		{
			name: "no IDs",
			src:  "WR-01, TGT-API-01, wr-style-01",
			want: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, ruleid.Citations([]byte(tt.src))); diff != "" {
				t.Errorf("Citations() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIsID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		id   string
		want bool
	}{
		{id: "WR-CONTENT-01", want: true},
		{id: "WR-STYLE-16", want: true},
		{id: "DOCS-09", want: true},
		{id: "BLOG-01", want: true},
		{id: "TGT-LANDING-01", want: false},
		{id: "WR-CONTENT-01 ", want: false},
		{id: "see WR-CONTENT-01", want: false},
		{id: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			t.Parallel()

			if got := ruleid.IsID(tt.id); got != tt.want {
				t.Errorf("IsID(%q) = %v, want %v", tt.id, got, tt.want)
			}
		})
	}
}

func TestLoad(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		rulesDir string
		want     []string
		wantErr  error
	}{
		{
			name:     "rules doc and every scope file",
			rulesDir: "rules",
			want: []string{
				"BLOG-01",
				"DOCS-01",
				"WR-ANTI-01",
				"WR-CONTENT-01",
				"WR-CONTENT-02",
			},
		},
		{
			name:     "no scope files",
			rulesDir: "no-scopes",
			want:     []string{"WR-STYLE-01"},
		},
		{
			name:     "ID defined in the rules doc and a scope",
			rulesDir: "duplicate",
			want:     []string{},
			wantErr:  ruleid.ErrDuplicate,
		},
		{
			name:     "no rules doc",
			rulesDir: "does-not-exist",
			want:     []string{},
			wantErr:  os.ErrNotExist,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			set, err := ruleid.Load(filepath.Join("testdata", tt.rulesDir))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Load() error = %v, want %v", err, tt.wantErr)
			}

			if diff := cmp.Diff(tt.want, set.IDs()); diff != "" {
				t.Errorf("Load() IDs mismatch (-want +got):\n%s", diff)
			}

			for _, id := range tt.want {
				if !set.Has(id) {
					t.Errorf("Has(%q) = false, want true", id)
				}
			}

			if set.Has("WR-ANTI-02") {
				t.Errorf("Has(%q) = true for an indented line", "WR-ANTI-02")
			}
		})
	}
}
