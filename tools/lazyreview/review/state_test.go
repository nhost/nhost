package review_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

func TestLoadSaveRoundTrip(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "feature/test", "main")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if state.Base != "main" {
		t.Errorf("expected base main, got %s", state.Base)
	}

	if len(state.Files) != 0 {
		t.Errorf("expected 0 files, got %d", len(state.Files))
	}

	state.Files["abc123"] = review.FileState{
		Path:     "main.go",
		Reviewed: true,
		Hunks: map[string]review.HunkState{
			"0": {Reviewed: true},
		},
	}

	if err := state.Save(); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify file was created with sanitized branch name
	expectedPath := filepath.Join(tmpDir, ".lazyreview", "feature_test.json")
	if _, err := os.Stat(expectedPath); err != nil {
		t.Fatalf("state file not created at expected path %s: %v", expectedPath, err)
	}

	loaded, err := review.Load(tmpDir, "feature/test", "main")
	if err != nil {
		t.Fatalf("Load round-trip failed: %v", err)
	}

	if loaded.Base != "main" {
		t.Errorf("round-trip base: expected main, got %s", loaded.Base)
	}

	wantFile := review.FileState{
		Path:     "main.go",
		Reviewed: true,
		Hunks: map[string]review.HunkState{
			"0": {Reviewed: true},
		},
	}

	gotFile, ok := loaded.Files["abc123"]
	if !ok {
		t.Fatal("round-trip: file abc123 not found")
	}

	if d := cmp.Diff(wantFile, gotFile); d != "" {
		t.Errorf("round-trip file mismatch (-want +got):\n%s", d)
	}
}

func TestLoadNonExistentReturnsEmpty(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "nonexistent", "main")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(state.Files) != 0 {
		t.Errorf("expected empty files map, got %d entries", len(state.Files))
	}
}

func makeFiles(paths ...string) []*diff.File {
	files := make([]*diff.File, 0, len(paths))
	for i, p := range paths {
		hunks := make([]*diff.Hunk, 0, 1)
		hunks = append(hunks, &diff.Hunk{
			Header:   "@@ -1,1 +1,1 @@",
			OldStart: 1,
			OldCount: 1,
			NewStart: 1,
			NewCount: 1,
			Lines:    nil,
		})

		raw := "diff content for " + p
		if i > 0 {
			raw += " unique"
		}

		files = append(files, &diff.File{
			Path:    p,
			Hunks:   hunks,
			RawDiff: raw,
		})
	}

	return files
}

func TestReconcile_FreshState(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go", "b.go")
	state.Reconcile(files)

	if len(state.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(state.Files))
	}

	for _, fs := range state.Files {
		if fs.Reviewed {
			t.Error("fresh files should not be reviewed")
		}

		if len(fs.Hunks) != 1 {
			t.Errorf("expected 1 hunk, got %d", len(fs.Hunks))
		}

		h, ok := fs.Hunks["0"]
		if !ok {
			t.Error("hunk 0 not found")
		}

		if h.Reviewed {
			t.Error("fresh hunks should not be reviewed")
		}
	}
}

func TestReconcile_PreservesReviewedUnchangedFiles(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go")
	state.Reconcile(files)

	// Mark the file as reviewed
	for hash := range state.Files {
		state.ToggleFileReviewed(hash)
	}

	// Reconcile again with the same files (same RawDiff → same hash)
	state.Reconcile(files)

	for _, fs := range state.Files {
		if !fs.Reviewed {
			t.Error("unchanged file should remain reviewed after reconcile")
		}
	}
}

func TestReconcile_ResetsChangedFiles(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go")
	state.Reconcile(files)

	for hash := range state.Files {
		state.ToggleFileReviewed(hash)
	}

	// Change the file's diff content (different hash)
	files[0].RawDiff = "completely different content"
	state.Reconcile(files)

	for _, fs := range state.Files {
		if fs.Reviewed {
			t.Error("changed file should not be reviewed after reconcile")
		}
	}
}

func TestToggleFileReviewed(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go")
	state.Reconcile(files)

	var hash string
	for h := range state.Files {
		hash = h
	}

	// Toggle on
	state.ToggleFileReviewed(hash)

	fs := state.Files[hash]
	if !fs.Reviewed {
		t.Error("file should be reviewed after toggle on")
	}

	for _, h := range fs.Hunks {
		if !h.Reviewed {
			t.Error("all hunks should be reviewed when file is toggled on")
		}
	}

	// Toggle off
	state.ToggleFileReviewed(hash)

	fs = state.Files[hash]
	if fs.Reviewed {
		t.Error("file should not be reviewed after toggle off")
	}

	for _, h := range fs.Hunks {
		if h.Reviewed {
			t.Error("all hunks should not be reviewed when file is toggled off")
		}
	}
}

func TestToggleFileReviewed_NonExistentHash(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	// Should not panic
	state.ToggleFileReviewed("nonexistent")
}

func TestSetHunkReviewed(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	files := []*diff.File{
		{
			Path: "multi.go",
			Hunks: []*diff.Hunk{
				{
					Header:   "@@ -1,3 +1,3 @@",
					OldStart: 1, OldCount: 3,
					NewStart: 1, NewCount: 3,
				},
				{
					Header:   "@@ -10,3 +10,3 @@",
					OldStart: 10, OldCount: 3,
					NewStart: 10, NewCount: 3,
				},
			},
			RawDiff: "diff content for set hunk reviewed",
		},
	}

	s.Reconcile(files)

	hash := review.Hash("diff content for set hunk reviewed")

	// Set hunk 0 reviewed
	s.SetHunkReviewed(hash, 0, true)

	if !s.IsHunkReviewed(hash, 0) {
		t.Error("hunk 0 should be reviewed after SetHunkReviewed(true)")
	}

	if s.Files[hash].Reviewed {
		t.Error("file should not be fully reviewed when only 1/2 hunks are reviewed")
	}

	// Set hunk 1 reviewed
	s.SetHunkReviewed(hash, 1, true)

	if !s.Files[hash].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}

	// Unset hunk 0
	s.SetHunkReviewed(hash, 0, false)

	if s.IsHunkReviewed(hash, 0) {
		t.Error("hunk 0 should not be reviewed after SetHunkReviewed(false)")
	}

	if s.Files[hash].Reviewed {
		t.Error("file should not be reviewed when a hunk is unreviewed")
	}

	// Non-existent hash — should not panic
	s.SetHunkReviewed("nonexistent", 0, true)

	// Non-existent hunk index — should not panic
	s.SetHunkReviewed(hash, 99, true)
}

func TestToggleHunkReviewed(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go")
	state.Reconcile(files)

	var hash string
	for h := range state.Files {
		hash = h
	}

	// Toggle hunk 0 on
	state.ToggleHunkReviewed(hash, 0)

	if !state.IsHunkReviewed(hash, 0) {
		t.Error("hunk should be reviewed after toggle")
	}

	// With only one hunk, toggling it on should mark the file reviewed
	if !state.Files[hash].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}

	// Toggle hunk 0 off
	state.ToggleHunkReviewed(hash, 0)

	if state.IsHunkReviewed(hash, 0) {
		t.Error("hunk should not be reviewed after second toggle")
	}

	if state.Files[hash].Reviewed {
		t.Error("file should not be reviewed when a hunk is unreviewed")
	}
}

func TestToggleHunkReviewed_NonExistent(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	// Should not panic
	state.ToggleHunkReviewed("nonexistent", 0)

	files := makeFiles("a.go")
	state.Reconcile(files)

	var hash string
	for h := range state.Files {
		hash = h
	}

	// Non-existent hunk index
	state.ToggleHunkReviewed(hash, 99)
}

func TestReviewedFileCount(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	if state.ReviewedFileCount() != 0 {
		t.Errorf("expected 0 reviewed files, got %d", state.ReviewedFileCount())
	}

	files := makeFiles("a.go", "b.go", "c.go")
	state.Reconcile(files)

	if state.ReviewedFileCount() != 0 {
		t.Errorf("expected 0 reviewed files after reconcile, got %d", state.ReviewedFileCount())
	}

	// Mark one file reviewed
	var firstHash string
	for h := range state.Files {
		firstHash = h

		break
	}

	state.ToggleFileReviewed(firstHash)

	if state.ReviewedFileCount() != 1 {
		t.Errorf("expected 1 reviewed file, got %d", state.ReviewedFileCount())
	}
}

func TestSetFilesReviewed(t *testing.T) { //nolint:cyclop
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	files := makeFiles("a.go", "b.go")
	state.Reconcile(files)

	hashes := make([]string, 0, len(state.Files))
	for h := range state.Files {
		hashes = append(hashes, h)
	}

	state.SetFilesReviewed(hashes, true)

	for _, fs := range state.Files {
		if !fs.Reviewed {
			t.Error("file should be reviewed after SetFilesReviewed(true)")
		}

		for _, h := range fs.Hunks {
			if !h.Reviewed {
				t.Error("hunk should be reviewed after SetFilesReviewed(true)")
			}
		}
	}

	state.SetFilesReviewed(hashes, false)

	for _, fs := range state.Files {
		if fs.Reviewed {
			t.Error("file should not be reviewed after SetFilesReviewed(false)")
		}

		for _, h := range fs.Hunks {
			if h.Reviewed {
				t.Error("hunk should not be reviewed after SetFilesReviewed(false)")
			}
		}
	}
}

func TestHash(t *testing.T) {
	t.Parallel()

	h1 := review.Hash("hello")
	h2 := review.Hash("hello")
	h3 := review.Hash("world")

	if h1 != h2 {
		t.Error("same input should produce same hash")
	}

	if h1 == h3 {
		t.Error("different input should produce different hash")
	}

	if len(h1) != 64 {
		t.Errorf("expected 64-char hex sha256, got %d chars", len(h1))
	}
}

func TestNewTransientState(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	if s.Base != "" {
		t.Errorf("expected empty base, got %s", s.Base)
	}

	if s.Files == nil {
		t.Error("Files map should not be nil")
	}

	if len(s.Files) != 0 {
		t.Errorf("expected 0 files, got %d", len(s.Files))
	}
}

func TestNewTransientState_SaveFails(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	err := s.Save()
	if err == nil {
		t.Error("expected error when saving transient state with empty path")
	}
}

func TestLoadCorruptedStateFile(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	stateDir := filepath.Join(tmpDir, ".lazyreview")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatalf("failed to create state dir: %v", err)
	}

	corrupted := filepath.Join(stateDir, "branch.json")
	if err := os.WriteFile(corrupted, []byte("not valid json{{{"), 0o600); err != nil {
		t.Fatalf("failed to write corrupted file: %v", err)
	}

	_, err := review.Load(tmpDir, "branch", "main")
	if err == nil {
		t.Error("expected error for corrupted state file")
	}
}

func TestReconcile_MultipleHunksPerFile(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	files := []*diff.File{
		{
			Path: "multi.go",
			Hunks: []*diff.Hunk{
				{
					Header:   "@@ -1,3 +1,3 @@",
					OldStart: 1, OldCount: 3,
					NewStart: 1, NewCount: 3,
				},
				{
					Header:   "@@ -10,3 +10,3 @@",
					OldStart: 10, OldCount: 3,
					NewStart: 10, NewCount: 3,
				},
				{
					Header:   "@@ -20,3 +20,3 @@",
					OldStart: 20, OldCount: 3,
					NewStart: 20, NewCount: 3,
				},
			},
			RawDiff: "diff content for multi.go",
		},
	}

	s.Reconcile(files)

	hash := review.Hash("diff content for multi.go")

	fs, ok := s.Files[hash]
	if !ok {
		t.Fatal("file not found in state")
	}

	if len(fs.Hunks) != 3 {
		t.Fatalf("expected 3 hunks, got %d", len(fs.Hunks))
	}

	// Toggle first two hunks
	s.ToggleHunkReviewed(hash, 0)
	s.ToggleHunkReviewed(hash, 1)

	if s.Files[hash].Reviewed {
		t.Error("file should not be reviewed when only 2/3 hunks are reviewed")
	}

	// Toggle the last hunk
	s.ToggleHunkReviewed(hash, 2)

	if !s.Files[hash].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}
}

func TestReconcile_RemovesStaleFiles(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	files := makeFiles("a.go", "b.go")
	s.Reconcile(files)

	if len(s.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(s.Files))
	}

	// Reconcile with only one file; the other should be removed
	s.Reconcile(makeFiles("a.go"))

	if len(s.Files) != 1 {
		t.Fatalf("expected 1 file after reconcile, got %d", len(s.Files))
	}
}

func TestReconcile_EmptyFiles(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	files := makeFiles("a.go")
	s.Reconcile(files)

	if len(s.Files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(s.Files))
	}

	// Reconcile with empty list removes all files
	s.Reconcile(nil)

	if len(s.Files) != 0 {
		t.Fatalf("expected 0 files after empty reconcile, got %d", len(s.Files))
	}
}

func TestSetFilesReviewed_NonExistentHash(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	// Should not panic
	s.SetFilesReviewed([]string{"nonexistent1", "nonexistent2"}, true)

	if len(s.Files) != 0 {
		t.Errorf("expected 0 files, got %d", len(s.Files))
	}
}

func TestIsHunkReviewed_Defaults(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	// Non-existent file
	if state.IsHunkReviewed("nonexistent", 0) {
		t.Error("should return false for non-existent file")
	}

	files := makeFiles("a.go")
	state.Reconcile(files)

	var hash string
	for h := range state.Files {
		hash = h
	}

	// Non-existent hunk index
	if state.IsHunkReviewed(hash, 99) {
		t.Error("should return false for non-existent hunk")
	}
}
