package review_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/lazyreview/review"
	"github.com/nhost/nhost/tools/lazyreview/review/mock"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
	"go.uber.org/mock/gomock"
)

func makeDiffOutput(path, content string) string {
	lines := strings.Split(content, "\n")

	var b strings.Builder

	b.WriteString("diff --git a/" + path + " b/" + path + "\n")
	b.WriteString("index 1234567..abcdefg 100644\n")
	b.WriteString("--- a/" + path + "\n")
	b.WriteString("+++ b/" + path + "\n")
	b.WriteString("@@ -1,1 +1,1 @@\n")

	for _, l := range lines {
		b.WriteString("+" + l + "\n")
	}

	return b.String()
}

func makeNameStatus(entries ...string) string {
	return strings.Join(entries, "\n") + "\n"
}

func setupQuerier(
	ctrl *gomock.Controller,
	nameStatus string,
	bulkDiff string,
) *mock.MockGitQuerier {
	querier := mock.NewMockGitQuerier(ctrl)
	querier.EXPECT().MergeBase(gomock.Any(), "main").Return("abc123", nil).AnyTimes()
	querier.EXPECT().NameStatus(gomock.Any(), "abc123").Return(nameStatus, nil).AnyTimes()
	querier.EXPECT().UntrackedFiles(gomock.Any()).Return("", nil).AnyTimes()
	querier.EXPECT().
		DiffFile(gomock.Any(), "-M", "abc123").
		Return(bulkDiff, nil).
		AnyTimes()

	return querier
}

func setupQuerierFull(ctrl *gomock.Controller) *mock.MockGitQuerier {
	querier := mock.NewMockGitQuerier(ctrl)
	querier.EXPECT().MergeBase(gomock.Any(), "main").Return("abc123", nil).AnyTimes()

	return querier
}

func TestReview_GetStatus(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("M\tmain.go")
	bulkDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if len(statuses) != 1 {
		t.Fatalf("expected 1 file status, got %d", len(statuses))
	}

	want := []versioncontrol.FileStatus{
		{
			Path:     "main.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   false,
			Partial:  false,
		},
	}

	if d := cmp.Diff(want, statuses); d != "" {
		t.Errorf("status mismatch (-want +got):\n%s", d)
	}
}

func TestReview_GetStatus_Added(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("A\tnew.go")
	bulkDiff := makeDiffOutput("new.go", "package new")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if statuses[0].Kind != versioncontrol.ChangeAdded {
		t.Errorf("expected ChangeAdded, got %v", statuses[0].Kind)
	}
}

func TestReview_GetStatus_Deleted(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("D\told.go")
	bulkDiff := makeDiffOutput("old.go", "package old")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if statuses[0].Kind != versioncontrol.ChangeDeleted {
		t.Errorf("expected ChangeDeleted, got %v", statuses[0].Kind)
	}
}

func TestReview_GetStatus_Renamed(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("R100\told.go\tnew.go")
	bulkDiff := makeDiffOutput("new.go", "package new")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if len(statuses) != 1 {
		t.Fatalf("expected 1 status, got %d", len(statuses))
	}

	if statuses[0].Kind != versioncontrol.ChangeRenamed {
		t.Errorf("expected ChangeRenamed, got %v", statuses[0].Kind)
	}

	if statuses[0].Path != "new.go" {
		t.Errorf("expected path new.go, got %s", statuses[0].Path)
	}

	if statuses[0].OrigPath != "old.go" {
		t.Errorf("expected origPath old.go, got %s", statuses[0].OrigPath)
	}
}

func TestReview_StageUnstageHunk(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("M\tmain.go")
	bulkDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	// GetStatus to initialize
	if _, err := v.GetStatus(ctx); err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	// GetChangeDetails to populate hunks in state
	detail, err := v.GetChangeDetails(ctx, versioncontrol.FileStatus{
		Path: "main.go", OrigPath: "", Kind: versioncontrol.ChangeModified, Staged: false, Partial: false,
	})
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details for main.go")
	}

	mainFS := versioncontrol.FileStatus{
		Path:     "main.go",
		OrigPath: "",
		Kind:     versioncontrol.ChangeModified,
		Staged:   false,
		Partial:  false,
	}

	if err := v.StageHunk(ctx, mainFS, 0); err != nil {
		t.Fatalf("StageHunk failed: %v", err)
	}

	// Verify via GetChangeDetails
	detail, err = v.GetChangeDetails(ctx, mainFS)
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if !detail.Hunks[0].Staged {
		t.Error("hunk should be staged after StageHunk")
	}

	// Unstage hunk
	if err := v.UnstageHunk(ctx, mainFS, 0); err != nil {
		t.Fatalf("UnstageHunk failed: %v", err)
	}

	detail, err = v.GetChangeDetails(ctx, mainFS)
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail.Hunks[0].Staged {
		t.Error("hunk should not be staged after UnstageHunk")
	}
}

func TestReview_StageUnstageFile(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("M\tmain.go")
	bulkDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	if _, err := v.GetStatus(ctx); err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if err := v.StageFile(ctx, "main.go"); err != nil {
		t.Fatalf("StageFile failed: %v", err)
	}

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if !statuses[0].Staged {
		t.Error("file should be staged after StageFile")
	}

	if err := v.UnstageFile(ctx, "main.go"); err != nil {
		t.Fatalf("UnstageFile failed: %v", err)
	}

	statuses, err = v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if statuses[0].Staged {
		t.Error("file should not be staged after UnstageFile")
	}
}

func TestReview_StageFolder(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("M\tpkg/a.go", "M\tpkg/b.go", "M\tother/c.go")
	bulkDiff := makeDiffOutput("pkg/a.go", "package a") +
		makeDiffOutput("pkg/b.go", "package b") +
		makeDiffOutput("other/c.go", "package c")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, ns, bulkDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	if _, err := v.GetStatus(ctx); err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if err := v.StageFolder(ctx, "pkg"); err != nil {
		t.Fatalf("StageFolder failed: %v", err)
	}

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	want := []versioncontrol.FileStatus{
		{
			Path:     "pkg/a.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   true,
			Partial:  false,
		},
		{
			Path:     "pkg/b.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   true,
			Partial:  false,
		},
		{
			Path:     "other/c.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   false,
			Partial:  false,
		},
	}

	if d := cmp.Diff(want, statuses); d != "" {
		t.Errorf("status mismatch (-want +got):\n%s", d)
	}
}

func TestReview_GetStatus_UntrackedFiles(t *testing.T) {
	t.Parallel()

	ns := makeNameStatus("M\tmain.go")
	bulkDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerierFull(ctrl)
	querier.EXPECT().NameStatus(gomock.Any(), "abc123").Return(ns, nil).AnyTimes()
	querier.EXPECT().UntrackedFiles(gomock.Any()).Return("newfile.go\n", nil).AnyTimes()
	querier.EXPECT().
		DiffFile(gomock.Any(), "-M", "abc123").
		Return(bulkDiff, nil).
		AnyTimes()
	querier.EXPECT().
		NewFileDiff("newfile.go").
		Return(makeDiffOutput("newfile.go", "package newfile"), nil).
		AnyTimes()

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	statuses, err := v.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if len(statuses) != 2 {
		t.Fatalf("expected 2 file statuses, got %d", len(statuses))
	}

	want := []versioncontrol.FileStatus{
		{
			Path:     "main.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   false,
			Partial:  false,
		},
		{
			Path:     "newfile.go",
			OrigPath: "",
			Kind:     versioncontrol.ChangeAdded,
			Staged:   false,
			Partial:  false,
		},
	}

	if d := cmp.Diff(want, statuses); d != "" {
		t.Errorf("status mismatch (-want +got):\n%s", d)
	}

	// Verify GetChangeDetails works for untracked file (uses NewFileDiff)
	detail, err := v.GetChangeDetails(ctx, versioncontrol.FileStatus{
		Path:     "newfile.go",
		OrigPath: "",
		Kind:     versioncontrol.ChangeAdded,
		Staged:   false,
		Partial:  false,
	})
	if err != nil {
		t.Fatalf("GetChangeDetails for untracked file failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details for untracked file")
	}

	if detail.Kind != versioncontrol.ChangeAdded {
		t.Errorf("expected ChangeAdded, got %v", detail.Kind)
	}
}
