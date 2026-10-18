package expect_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/expect"
)

func TestLoad(t *testing.T) {
	t.Parallel()

	want := &expect.File{
		Model: "",
		Voices: map[string]expect.Voice{
			"nhost-docs": {
				HeldOut: &expect.HeldOut{
					Path:     "docs/src/content/docs/stub/held-out.mdx",
					Blob:     "de433d4c53239adaad28568a51e991aad7e393b5",
					Note:     "Re-recorded after a sweep.",
					ChosenAt: "bdc2708b52",
					Rule:     "Latest last-commit date.",
					Reason:   "First in the ordering.",
				},
				Skip:       false,
				RecordOnly: false,
				Reason:     "",
				Vetoed: []expect.Veto{
					{Path: "docs/src/content/docs/stub/vetoed.mdx", Reason: "LLM-assisted."},
				},
			},
			"nuno-pato": {
				HeldOut: &expect.HeldOut{
					Path:     "landing/src/pages/blog/./nuno-latest.mdx",
					Blob:     "593a2ef202fbc62229a141d6f4c2fa0b8c43dcb0",
					Note:     "",
					ChosenAt: "bdc2708b52",
					Rule:     "Most recent single-author post.",
					Reason:   "Dated 2026-01-02.",
				},
				Skip:       false,
				RecordOnly: false,
				Reason:     "",
				Vetoed:     []expect.Veto{},
			},
			"nhost-blog": {
				HeldOut: &expect.HeldOut{
					Path:     "landing/src/pages/blog/house-latest.mdx",
					Blob:     "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567",
					Note:     "",
					ChosenAt: "bdc2708b52",
					Rule:     "Most recent profiled-author post not held out for its own voice.",
					Reason:   "Dated 2026-01-01.",
				},
				Skip:       false,
				RecordOnly: true,
				Reason:     "Averages the profiled authors.",
				Vetoed:     nil,
			},
			"max-serdiukov": {
				HeldOut:    nil,
				Skip:       true,
				RecordOnly: false,
				Reason:     "One post, so no held-out.",
				Vetoed:     nil,
			},
		},
	}

	got, err := expect.Load(filepath.Join("testdata", "valid.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Load() mismatch (-want +got):\n%s", diff)
	}
}

func TestLoadModel(t *testing.T) {
	t.Parallel()

	got, err := expect.Load(filepath.Join("testdata", "pinned.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if got.Model != "stub-judge-model" {
		t.Errorf("Load().Model = %q, want %q", got.Model, "stub-judge-model")
	}
}

func TestLoadErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		file      string
		wantErr   error
		wantTexts []string
	}{
		{
			name:      "missing file",
			file:      "does-not-exist.yaml",
			wantErr:   os.ErrNotExist,
			wantTexts: []string{"reading voice expectations"},
		},
		{
			name:      "unknown key",
			file:      "unknown-key.yaml",
			wantErr:   expect.ErrInvalid,
			wantTexts: []string{`unknown field "picked_by"`},
		},
		{
			name:      "no voices",
			file:      "no-voices.yaml",
			wantErr:   expect.ErrInvalid,
			wantTexts: []string{"no voices"},
		},
		{
			name:    "every schema problem is listed",
			file:    "invalid.yaml",
			wantErr: expect.ErrInvalid,
			wantTexts: []string{
				"voices.bad-veto: vetoed 1: path and reason are required",
				"voices.incomplete-held-out: held_out.blob is required",
				"voices.incomplete-held-out: held_out.chosen_at is required",
				"voices.incomplete-held-out: held_out.rule is required",
				"voices.incomplete-held-out: held_out.reason is required",
				"voices.incomplete-held-out: held_out.path must be repository-relative",
				"voices.missing-held-out: held_out is required unless skip is set",
				"voices.numeric-sha: held_out.blob must be a 40-character hex SHA, got 1",
				"voices.numeric-sha: held_out.chosen_at must be a hex commit SHA, got 42798",
				"voices.reason-without-flag: reason is required with skip or record-only, and only then",
				"voices.skip-without-reason: reason is required with skip or record-only, and only then",
				"voices.skipped-with-held-out: skip is set, so held_out must not be",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := expect.Load(filepath.Join("testdata", tt.file))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Load() error = %v, want %v", err, tt.wantErr)
			}

			for _, text := range tt.wantTexts {
				if !strings.Contains(err.Error(), text) {
					t.Errorf("Load() error = %q, want it to contain %q", err.Error(), text)
				}
			}
		})
	}
}

func TestFileHeldOutPaths(t *testing.T) {
	t.Parallel()

	f, err := expect.Load(filepath.Join("testdata", "valid.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	want := []string{
		"docs/src/content/docs/stub/held-out.mdx",
		"landing/src/pages/blog/house-latest.mdx",
		"landing/src/pages/blog/nuno-latest.mdx",
	}

	if diff := cmp.Diff(want, f.HeldOutPaths()); diff != "" {
		t.Errorf("HeldOutPaths() mismatch (-want +got):\n%s", diff)
	}
}
