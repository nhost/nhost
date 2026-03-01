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

func setupQuerier(ctrl *gomock.Controller, rawDiff string) *mock.MockGitQuerier {
	querier := mock.NewMockGitQuerier(ctrl)
	querier.EXPECT().MergeBase(gomock.Any(), "main").Return("abc123", nil).AnyTimes()
	querier.EXPECT().Diff(gomock.Any(), "abc123").Return(rawDiff, nil).AnyTimes()

	return querier
}

func TestReview_GetStatus(t *testing.T) {
	t.Parallel()

	rawDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, rawDiff)

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

func TestReview_StageUnstageHunk(t *testing.T) {
	t.Parallel()

	rawDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, rawDiff)

	repoRoot := t.TempDir()
	v := review.NewReview(querier, "main", repoRoot, "feature")

	ctx := context.Background()

	// Stage hunk using FileStatus
	if _, err := v.GetStatus(ctx); err != nil {
		t.Fatalf("GetStatus failed: %v", err)
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
	detail, err := v.GetChangeDetails(ctx, versioncontrol.FileStatus{
		Path: "main.go", OrigPath: "", Kind: versioncontrol.ChangeModified, Staged: false, Partial: false,
	})
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details for main.go")
	}

	if !detail.Hunks[0].Staged {
		t.Error("hunk should be staged after StageHunk")
	}

	// Unstage hunk using FileStatus
	if err := v.UnstageHunk(ctx, mainFS, 0); err != nil {
		t.Fatalf("UnstageHunk failed: %v", err)
	}

	detail, err = v.GetChangeDetails(ctx, versioncontrol.FileStatus{
		Path: "main.go", OrigPath: "", Kind: versioncontrol.ChangeModified, Staged: false, Partial: false,
	})
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail.Hunks[0].Staged {
		t.Error("hunk should not be staged after UnstageHunk")
	}
}

func TestReview_StageUnstageFile(t *testing.T) {
	t.Parallel()

	rawDiff := makeDiffOutput("main.go", "package main")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, rawDiff)

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

	rawDiff := makeDiffOutput("pkg/a.go", "package a") +
		makeDiffOutput("pkg/b.go", "package b") +
		makeDiffOutput("other/c.go", "package c")

	ctrl := gomock.NewController(t)
	querier := setupQuerier(ctrl, rawDiff)

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
