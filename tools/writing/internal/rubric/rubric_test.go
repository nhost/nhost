package rubric_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/rubric"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
)

func loadIDs(t *testing.T) ruleid.Set {
	t.Helper()

	ids, err := ruleid.Load(filepath.Join("testdata", "rules"))
	if err != nil {
		t.Fatalf("ruleid.Load: %v", err)
	}

	return ids
}

func TestLoad(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		file     string
		wantErr  error
		wantText string
	}{
		{name: "valid rubric", file: "valid"},
		{
			name:     "unknown rule ID",
			file:     "unknown-id",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension running_example: rule ID WR-CONTENT-99 is not defined",
		},
		{
			name:     "blog ID before the blog scope defines it",
			file:     "undefined-blog-id",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension brief_fidelity: rule ID BLOG-01 is not defined",
		},
		{
			name:     "covers entry that is not one ID",
			file:     "malformed-id",
			wantErr:  rubric.ErrInvalid,
			wantText: "rule ID see DOCS-02 is not defined",
		},
		{
			name:     "dimension covering no ID",
			file:     "no-covers",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension brief_fidelity: covers no rule ID",
		},
		{
			name:     "missing anchor",
			file:     "missing-anchor",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension running_example: anchor 2 is missing",
		},
		{
			name:     "empty anchor",
			file:     "empty-anchor",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension brief_fidelity: anchor 4 is missing",
		},
		{
			name:     "anchor other than 0, 2 and 4",
			file:     "extra-anchor",
			wantErr:  rubric.ErrInvalid,
			wantText: "anchor keys are 0, 2 and 4, got 3",
		},
		{
			name:     "scope weighting an unknown dimension",
			file:     "unknown-weight",
			wantErr:  rubric.ErrInvalid,
			wantText: "scope blog: weights unknown dimension voice_match",
		},
		{
			name:     "scope blocking an unknown dimension",
			file:     "unknown-blocking",
			wantErr:  rubric.ErrInvalid,
			wantText: "scope blog: blocks unknown dimension voice_match",
		},
		{
			name:     "scope missing a dimension's weight",
			file:     "missing-weight",
			wantErr:  rubric.ErrInvalid,
			wantText: "scope blog: no weight for running_example",
		},
		{
			name:     "zero weight",
			file:     "zero-weight",
			wantErr:  rubric.ErrInvalid,
			wantText: "scope blog: weight of running_example is not positive",
		},
		{
			name:     "dimension blocked twice",
			file:     "duplicate-blocking",
			wantErr:  rubric.ErrInvalid,
			wantText: "scope docs: blocks running_example twice",
		},
		{
			name:     "no brief_fidelity dimension",
			file:     "no-brief-fidelity",
			wantErr:  rubric.ErrInvalid,
			wantText: "no brief_fidelity dimension",
		},
		{
			name:     "dimension defined twice",
			file:     "duplicate-dimension",
			wantErr:  rubric.ErrInvalid,
			wantText: "dimension brief_fidelity: defined twice",
		},
		{
			name:     "dimension name not snake_case",
			file:     "bad-name",
			wantErr:  rubric.ErrInvalid,
			wantText: `name "Running-Example" is not snake_case`,
		},
		{
			name:     "unknown key",
			file:     "unknown-key",
			wantErr:  rubric.ErrInvalid,
			wantText: `unknown field "weight"`,
		},
		{
			name:     "no scopes",
			file:     "no-scopes",
			wantErr:  rubric.ErrInvalid,
			wantText: "no scopes",
		},
		{
			name:    "missing file",
			file:    "does-not-exist",
			wantErr: os.ErrNotExist,
		},
	}

	ids := loadIDs(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := rubric.Load(filepath.Join("testdata", "rubrics", tt.file+".yaml"), ids)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Load() error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantText != "" && !strings.Contains(err.Error(), tt.wantText) {
				t.Errorf("Load() error = %q, want it to contain %q", err.Error(), tt.wantText)
			}
		})
	}
}

func TestRubric(t *testing.T) {
	t.Parallel()

	r, err := rubric.Load(filepath.Join("testdata", "rubrics", "valid.yaml"), loadIDs(t))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	wantDimensions := []rubric.Dimension{
		{
			Name:   "brief_fidelity",
			Covers: []string{"DOCS-02"},
			Anchors: rubric.Anchors{
				Zero: "Ignores the brief.",
				Two:  "Follows part of the brief.",
				Four: "Follows all of the brief.",
			},
		},
		{
			Name:   "running_example",
			Covers: []string{"WR-CONTENT-01", "WR-CONTENT-03"},
			Anchors: rubric.Anchors{
				Zero: "Disconnected examples.",
				Two:  "Mostly one example.",
				Four: "One example throughout.",
			},
		},
	}
	if diff := cmp.Diff(wantDimensions, r.Dimensions); diff != "" {
		t.Errorf("Dimensions mismatch (-want +got):\n%s", diff)
	}

	tests := []struct {
		name   string
		scope  string
		want   rubric.Scope
		wantOK bool
	}{
		{
			name:  "docs",
			scope: "docs",
			want: rubric.Scope{
				Weights:  map[string]float64{"brief_fidelity": 1, "running_example": 2},
				Blocking: []string{"running_example"},
			},
			wantOK: true,
		},
		{
			name:  "blog without a scope file",
			scope: "blog",
			want: rubric.Scope{
				Weights:  map[string]float64{"brief_fidelity": 2, "running_example": 0.5},
				Blocking: []string{},
			},
			wantOK: true,
		},
		{
			name:   "unknown scope",
			scope:  "landing",
			want:   rubric.Scope{Weights: nil, Blocking: nil},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := r.Scope(tt.scope)
			if ok != tt.wantOK {
				t.Fatalf("Scope(%q) ok = %v, want %v", tt.scope, ok, tt.wantOK)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Scope(%q) mismatch (-want +got):\n%s", tt.scope, diff)
			}
		})
	}

	for name, want := range map[string]bool{
		"brief_fidelity": true, "running_example": true, "voice_match": false,
	} {
		if got := r.Has(name); got != want {
			t.Errorf("Has(%q) = %v, want %v", name, got, want)
		}
	}
}
