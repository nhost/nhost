package review_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
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

	state.Files["main.go"] = review.FileState{
		Path:     "main.go",
		Hash:     "abc123",
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
		Hash:     "abc123",
		Reviewed: true,
		Hunks: map[string]review.HunkState{
			"0": {Reviewed: true},
		},
	}

	gotFile, ok := loaded.Files["main.go"]
	if !ok {
		t.Fatal("round-trip: file main.go not found")
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

func TestReconcile_FreshState(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	state.Reconcile([]string{"a.go", "b.go"})

	if len(state.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(state.Files))
	}

	for _, fs := range state.Files {
		if fs.Reviewed {
			t.Error("fresh files should not be reviewed")
		}

		if fs.Hash != "" {
			t.Error("fresh files should have empty hash")
		}

		if fs.Hunks != nil {
			t.Error("fresh files should have nil hunks")
		}
	}
}

func TestReconcile_PreservesExistingEntries(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	state.Reconcile([]string{"a.go"})

	// Simulate having viewed the file (sets hash and hunks)
	state.ReconcileFile("a.go", "hash1", 1)

	// Mark the file as reviewed
	state.ToggleFileReviewed("a.go")

	// Reconcile again with the same path
	state.Reconcile([]string{"a.go"})

	fs := state.Files["a.go"]
	if !fs.Reviewed {
		t.Error("existing file should remain reviewed after reconcile")
	}

	if fs.Hash != "hash1" {
		t.Error("existing file should keep its hash after reconcile")
	}
}

func TestReconcile_RemovesStaleFiles(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	s.Reconcile([]string{"a.go", "b.go"})

	if len(s.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(s.Files))
	}

	// Reconcile with only one file; the other should be removed
	s.Reconcile([]string{"a.go"})

	if len(s.Files) != 1 {
		t.Fatalf("expected 1 file after reconcile, got %d", len(s.Files))
	}

	if _, ok := s.Files["a.go"]; !ok {
		t.Error("a.go should still be present")
	}
}

func TestReconcile_EmptyFiles(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	s.Reconcile([]string{"a.go"})

	if len(s.Files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(s.Files))
	}

	// Reconcile with empty list removes all files
	s.Reconcile(nil)

	if len(s.Files) != 0 {
		t.Fatalf("expected 0 files after empty reconcile, got %d", len(s.Files))
	}
}

func TestReconcileFile_NewFile(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()
	s.Reconcile([]string{"a.go"})

	s.ReconcileFile("a.go", "hash1", 2)

	fs := s.Files["a.go"]
	if fs.Hash != "hash1" {
		t.Errorf("expected hash hash1, got %s", fs.Hash)
	}

	if fs.Reviewed {
		t.Error("new file should not be reviewed")
	}

	if len(fs.Hunks) != 2 {
		t.Fatalf("expected 2 hunks, got %d", len(fs.Hunks))
	}

	for _, h := range fs.Hunks {
		if h.Reviewed {
			t.Error("new hunks should not be reviewed")
		}
	}
}

func TestReconcileFile_HashMatch(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()
	s.Reconcile([]string{"a.go"})
	s.ReconcileFile("a.go", "hash1", 2)

	// Mark hunk 0 as reviewed
	s.SetHunkReviewed("a.go", 0, true)

	// Reconcile again with same hash — should preserve review state
	s.ReconcileFile("a.go", "hash1", 2)

	if !s.IsHunkReviewed("a.go", 0) {
		t.Error("hunk 0 should remain reviewed when hash matches")
	}

	if s.IsHunkReviewed("a.go", 1) {
		t.Error("hunk 1 should remain unreviewed when hash matches")
	}
}

func TestReconcileFile_HashMismatch(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()
	s.Reconcile([]string{"a.go"})
	s.ReconcileFile("a.go", "hash1", 1)

	// Mark as reviewed
	s.ToggleFileReviewed("a.go")

	if !s.Files["a.go"].Reviewed {
		t.Fatal("file should be reviewed")
	}

	// Reconcile with different hash — should reset
	s.ReconcileFile("a.go", "hash2", 2)

	fs := s.Files["a.go"]
	if fs.Reviewed {
		t.Error("file should not be reviewed after hash change")
	}

	if fs.Hash != "hash2" {
		t.Errorf("expected hash hash2, got %s", fs.Hash)
	}

	if len(fs.Hunks) != 2 {
		t.Fatalf("expected 2 hunks, got %d", len(fs.Hunks))
	}
}

func TestReconcileFile_EmptyHashWithReviewed(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()
	s.Reconcile([]string{"a.go"})

	// Stage the file before viewing details (sets Reviewed but hash is empty)
	s.SetFilesReviewed([]string{"a.go"}, true)

	// Now view details — should populate hash and mark all hunks reviewed
	s.ReconcileFile("a.go", "hash1", 2)

	fs := s.Files["a.go"]
	if !fs.Reviewed {
		t.Error("file should remain reviewed")
	}

	if fs.Hash != "hash1" {
		t.Errorf("expected hash hash1, got %s", fs.Hash)
	}

	for k, h := range fs.Hunks {
		if !h.Reviewed {
			t.Errorf("hunk %s should be reviewed since file was reviewed", k)
		}
	}
}

func TestReconcileFile_EntryDoesNotExist(t *testing.T) {
	t.Parallel()

	s := review.NewTransientState()

	// ReconcileFile for a path not in state — should create entry
	s.ReconcileFile("new.go", "hash1", 1)

	fs, ok := s.Files["new.go"]
	if !ok {
		t.Fatal("file should have been created")
	}

	if fs.Reviewed {
		t.Error("new file should not be reviewed")
	}

	if fs.Hash != "hash1" {
		t.Errorf("expected hash hash1, got %s", fs.Hash)
	}

	if len(fs.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(fs.Hunks))
	}
}

func TestToggleFileReviewed(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	state.Reconcile([]string{"a.go"})
	state.ReconcileFile("a.go", "hash1", 1)

	// Toggle on
	state.ToggleFileReviewed("a.go")

	fs := state.Files["a.go"]
	if !fs.Reviewed {
		t.Error("file should be reviewed after toggle on")
	}

	for _, h := range fs.Hunks {
		if !h.Reviewed {
			t.Error("all hunks should be reviewed when file is toggled on")
		}
	}

	// Toggle off
	state.ToggleFileReviewed("a.go")

	fs = state.Files["a.go"]
	if fs.Reviewed {
		t.Error("file should not be reviewed after toggle off")
	}

	for _, h := range fs.Hunks {
		if h.Reviewed {
			t.Error("all hunks should not be reviewed when file is toggled off")
		}
	}
}

func TestToggleFileReviewed_NonExistentPath(t *testing.T) {
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

	s.Reconcile([]string{"multi.go"})
	s.ReconcileFile("multi.go", "hash1", 2)

	// Set hunk 0 reviewed
	s.SetHunkReviewed("multi.go", 0, true)

	if !s.IsHunkReviewed("multi.go", 0) {
		t.Error("hunk 0 should be reviewed after SetHunkReviewed(true)")
	}

	if s.Files["multi.go"].Reviewed {
		t.Error("file should not be fully reviewed when only 1/2 hunks are reviewed")
	}

	// Set hunk 1 reviewed
	s.SetHunkReviewed("multi.go", 1, true)

	if !s.Files["multi.go"].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}

	// Unset hunk 0
	s.SetHunkReviewed("multi.go", 0, false)

	if s.IsHunkReviewed("multi.go", 0) {
		t.Error("hunk 0 should not be reviewed after SetHunkReviewed(false)")
	}

	if s.Files["multi.go"].Reviewed {
		t.Error("file should not be reviewed when a hunk is unreviewed")
	}

	// Non-existent path — should not panic
	s.SetHunkReviewed("nonexistent", 0, true)

	// Non-existent hunk index — should not panic
	s.SetHunkReviewed("multi.go", 99, true)
}

func TestToggleHunkReviewed(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	state.Reconcile([]string{"a.go"})
	state.ReconcileFile("a.go", "hash1", 1)

	// Toggle hunk 0 on
	state.ToggleHunkReviewed("a.go", 0)

	if !state.IsHunkReviewed("a.go", 0) {
		t.Error("hunk should be reviewed after toggle")
	}

	// With only one hunk, toggling it on should mark the file reviewed
	if !state.Files["a.go"].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}

	// Toggle hunk 0 off
	state.ToggleHunkReviewed("a.go", 0)

	if state.IsHunkReviewed("a.go", 0) {
		t.Error("hunk should not be reviewed after second toggle")
	}

	if state.Files["a.go"].Reviewed {
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

	state.Reconcile([]string{"a.go"})
	state.ReconcileFile("a.go", "hash1", 1)

	// Non-existent hunk index
	state.ToggleHunkReviewed("a.go", 99)
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

	state.Reconcile([]string{"a.go", "b.go", "c.go"})

	if state.ReviewedFileCount() != 0 {
		t.Errorf("expected 0 reviewed files after reconcile, got %d", state.ReviewedFileCount())
	}

	// Mark one file reviewed
	state.ReconcileFile("a.go", "hash1", 1)
	state.ToggleFileReviewed("a.go")

	if state.ReviewedFileCount() != 1 {
		t.Errorf("expected 1 reviewed file, got %d", state.ReviewedFileCount())
	}
}

func TestSetFilesReviewed(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()

	state, err := review.Load(tmpDir, "branch", "main")
	if err != nil {
		t.Fatal(err)
	}

	state.Reconcile([]string{"a.go", "b.go"})
	state.ReconcileFile("a.go", "hash1", 1)
	state.ReconcileFile("b.go", "hash2", 1)

	state.SetFilesReviewed([]string{"a.go", "b.go"}, true)

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

	state.SetFilesReviewed([]string{"a.go", "b.go"}, false)

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

	s.Reconcile([]string{"multi.go"})
	s.ReconcileFile("multi.go", "hash1", 3)

	fs, ok := s.Files["multi.go"]
	if !ok {
		t.Fatal("file not found in state")
	}

	if len(fs.Hunks) != 3 {
		t.Fatalf("expected 3 hunks, got %d", len(fs.Hunks))
	}

	// Toggle first two hunks
	s.ToggleHunkReviewed("multi.go", 0)
	s.ToggleHunkReviewed("multi.go", 1)

	if s.Files["multi.go"].Reviewed {
		t.Error("file should not be reviewed when only 2/3 hunks are reviewed")
	}

	// Toggle the last hunk
	s.ToggleHunkReviewed("multi.go", 2)

	if !s.Files["multi.go"].Reviewed {
		t.Error("file should be reviewed when all hunks are reviewed")
	}
}

func TestSetFilesReviewed_NonExistentPath(t *testing.T) {
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

	state.Reconcile([]string{"a.go"})
	state.ReconcileFile("a.go", "hash1", 1)

	// Non-existent hunk index
	if state.IsHunkReviewed("a.go", 99) {
		t.Error("should return false for non-existent hunk")
	}
}
