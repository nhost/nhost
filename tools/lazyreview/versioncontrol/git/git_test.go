package git_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol/git"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol/git/mock"
	"go.uber.org/mock/gomock"
)

var errTest = errors.New("test error")

// twoHunkDiff is a realistic two-hunk diff used by hunk-level tests.
const twoHunkDiff = `diff --git a/main.go b/main.go
index 1159d81..f87c985 100644
--- a/main.go
+++ b/main.go
@@ -1,6 +1,9 @@
 package main

-import "fmt"
+import (
+	"fmt"
+	"os"
+)

 func main() {
 	fmt.Println("hello")
@@ -16,4 +19,5 @@ func main() {

 func other() {
 	fmt.Println("other")
+	os.Exit(0)
 }
`

func TestGit_GetStatus(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		statusOutput   string
		expectedStatus []versioncontrol.FileStatus
	}{
		{
			name:         "unstaged modified file",
			statusOutput: " M main.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "main.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   false,
					Partial:  false,
				},
			},
		},
		{
			name:         "fully staged file",
			statusOutput: "M  main.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "main.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   true,
					Partial:  false,
				},
			},
		},
		{
			name:         "partially staged file",
			statusOutput: "MM main.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "main.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   false,
					Partial:  true,
				},
			},
		},
		{
			name:         "untracked file",
			statusOutput: "?? newfile.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "newfile.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeAdded,
					Staged:   false,
					Partial:  false,
				},
			},
		},
		{
			name:         "added file",
			statusOutput: "A  main.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "main.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeAdded,
					Staged:   true,
					Partial:  false,
				},
			},
		},
		{
			name:         "deleted file",
			statusOutput: " D main.go\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "main.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeDeleted,
					Staged:   false,
					Partial:  false,
				},
			},
		},
		{
			name:           "empty status",
			statusOutput:   "",
			expectedStatus: nil,
		},
		{
			name:         "realistic mixed status",
			statusOutput: " M 1\nR  2 -> 3\nA  4\n M asd/wqe/1\n",
			expectedStatus: []versioncontrol.FileStatus{
				{
					Path:     "1",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   false,
					Partial:  false,
				},
				{
					Path:     "3",
					OrigPath: "2",
					Kind:     versioncontrol.ChangeRenamed,
					Staged:   true,
					Partial:  false,
				},
				{
					Path:     "4",
					OrigPath: "",
					Kind:     versioncontrol.ChangeAdded,
					Staged:   true,
					Partial:  false,
				},
				{
					Path:     "asd/wqe/1",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   false,
					Partial:  false,
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			executor := mock.NewMockExecutor(ctrl)
			executor.EXPECT().Status(gomock.Any()).Return(tc.statusOutput, nil)

			v := git.NewGit(executor)

			statuses, err := v.GetStatus(context.Background())
			if err != nil {
				t.Fatalf("GetStatus failed: %v", err)
			}

			if diff := cmp.Diff(tc.expectedStatus, statuses); diff != "" {
				t.Errorf("GetStatus mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func makeDiff(path string) string {
	return "diff --git a/" + path + " b/" + path + "\n" +
		"index 1234567..abcdefg 100644\n" +
		"--- a/" + path + "\n" +
		"+++ b/" + path + "\n" +
		"@@ -1,3 +1,4 @@\n" +
		" package main\n" +
		"\n" +
		"+import \"fmt\"\n" +
		" func main() {}\n"
}

func TestGit_GetChangeDetails(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		fs            versioncontrol.FileStatus
		setupMock     func(e *mock.MockExecutor)
		expectNil     bool
		expectedPath  string
		expectedHunks []versioncontrol.HunkDetail
	}{
		{
			name: "unstaged modified file returns details",
			fs: versioncontrol.FileStatus{
				Path:     "main.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeModified,
				Staged:   false,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().DiffFile(gomock.Any(), "--", "main.go").Return(makeDiff("main.go"), nil)
			},
			expectedPath:  "main.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: false, SourceIndex: 0}},
		},
		{
			name: "unstaged modified nonexistent returns nil",
			fs: versioncontrol.FileStatus{
				Path:     "nonexistent.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeModified,
				Staged:   false,
				Partial:  false,
			},
			expectNil: true,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().DiffFile(gomock.Any(), "--", "nonexistent.go").Return("", nil)
			},
			expectedPath:  "",
			expectedHunks: nil,
		},
		{
			name: "fully staged file",
			fs: versioncontrol.FileStatus{
				Path:     "main.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeModified,
				Staged:   true,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().
					DiffFile(gomock.Any(), "--cached", "--", "main.go").
					Return(makeDiff("main.go"), nil)
			},
			expectedPath:  "main.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: true, SourceIndex: 0}},
		},
		{
			name: "staged new file",
			fs: versioncontrol.FileStatus{
				Path:     "new.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeAdded,
				Staged:   true,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().
					DiffFile(gomock.Any(), "--cached", "--", "new.go").
					Return(makeDiff("new.go"), nil)
			},
			expectedPath:  "new.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: true, SourceIndex: 0}},
		},
		{
			name: "untracked file uses NewFileDiff",
			fs: versioncontrol.FileStatus{
				Path:     "untracked.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeAdded,
				Staged:   false,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().NewFileDiff("untracked.go").Return(makeDiff("untracked.go"), nil)
			},
			expectedPath:  "untracked.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: false, SourceIndex: 0}},
		},
		{
			name: "unstaged deleted file",
			fs: versioncontrol.FileStatus{
				Path:     "deleted.go",
				OrigPath: "",
				Kind:     versioncontrol.ChangeDeleted,
				Staged:   false,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().
					DiffFile(gomock.Any(), "--", "deleted.go").
					Return(makeDiff("deleted.go"), nil)
			},
			expectedPath:  "deleted.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: false, SourceIndex: 0}},
		},
		{
			name: "staged renamed file uses -M",
			fs: versioncontrol.FileStatus{
				Path:     "new_name.go",
				OrigPath: "old_name.go",
				Kind:     versioncontrol.ChangeRenamed,
				Staged:   true,
				Partial:  false,
			},
			expectNil: false,
			setupMock: func(e *mock.MockExecutor) {
				e.EXPECT().DiffFile(
					gomock.Any(), "--cached", "-M", "--", "new_name.go", "old_name.go",
				).Return(makeDiff("new_name.go"), nil)
			},
			expectedPath:  "new_name.go",
			expectedHunks: []versioncontrol.HunkDetail{{Staged: true, SourceIndex: 0}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			executor := mock.NewMockExecutor(ctrl)
			tc.setupMock(executor)

			v := git.NewGit(executor)

			detail, err := v.GetChangeDetails(context.Background(), tc.fs)
			if err != nil {
				t.Fatalf("GetChangeDetails failed: %v", err)
			}

			if tc.expectNil {
				if detail != nil {
					t.Errorf("expected nil, got %+v", detail)
				}

				return
			}

			if detail == nil {
				t.Fatal("expected non-nil change details")
			}

			if detail.Path != tc.expectedPath {
				t.Errorf("Path = %q, want %q", detail.Path, tc.expectedPath)
			}

			if detail.File == nil {
				t.Fatal("expected non-nil File")
			}

			if d := cmp.Diff(tc.expectedHunks, detail.Hunks); d != "" {
				t.Errorf("Hunks mismatch (-want +got):\n%s", d)
			}
		})
	}
}

func TestGit_GetStatus_Error(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	executor := mock.NewMockExecutor(ctrl)
	executor.EXPECT().Status(gomock.Any()).Return("", errTest)

	v := git.NewGit(executor)

	_, err := v.GetStatus(context.Background())
	if !errors.Is(err, errTest) {
		t.Errorf("error = %v, want %v", err, errTest)
	}
}

func TestGit_FileShims(t *testing.T) {
	t.Parallel()

	methods := []struct {
		name      string
		setupMock func(e *mock.MockExecutor, execErr error)
		call      func(v *git.Git, ctx context.Context) error
	}{
		{
			name: "StageFile",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().StageFiles(gomock.Any(), []string{"main.go"}).Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.StageFile(ctx, "main.go")
			},
		},
		{
			name: "UnstageFile",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().UnstageFiles(gomock.Any(), []string{"main.go"}).Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.UnstageFile(ctx, "main.go")
			},
		},
		{
			name: "DiscardFile",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().DiscardFiles(gomock.Any(), []string{"main.go"}).Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.DiscardFile(ctx, "main.go")
			},
		},
		{
			name: "StageFolder",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().StageFiles(gomock.Any(), []string{"pkg"}).Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.StageFolder(ctx, "pkg")
			},
		},
		{
			name: "UnstageFolder",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().UnstageFiles(gomock.Any(), []string{"pkg"}).Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.UnstageFolder(ctx, "pkg")
			},
		},
		{
			name: "Commit",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().Commit(gomock.Any(), "test msg").Return(execErr)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.Commit(ctx, "test msg")
			},
		},
	}

	for _, m := range methods {
		t.Run(m.name, func(t *testing.T) {
			t.Parallel()

			t.Run("success", func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				executor := mock.NewMockExecutor(ctrl)
				m.setupMock(executor, nil)

				v := git.NewGit(executor)

				if err := m.call(v, context.Background()); err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			})

			t.Run("executor error is propagated", func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				executor := mock.NewMockExecutor(ctrl)
				m.setupMock(executor, errTest)

				v := git.NewGit(executor)

				err := m.call(v, context.Background())
				if !errors.Is(err, errTest) {
					t.Errorf("error = %v, want %v", err, errTest)
				}
			})
		})
	}
}

func TestGit_HunkOperations(t *testing.T) {
	t.Parallel()

	mainFS := versioncontrol.FileStatus{
		Path:     "main.go",
		OrigPath: "",
		Kind:     versioncontrol.ChangeModified,
		Staged:   false,
		Partial:  false,
	}

	methods := []struct {
		name      string
		setupMock func(e *mock.MockExecutor, execErr error)
		call      func(v *git.Git, ctx context.Context, fs versioncontrol.FileStatus, idx int) error
	}{
		{
			name: "StageHunk",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().StageHunk(gomock.Any(), gomock.Any()).Return(execErr)
			},
			call: func(
				v *git.Git,
				ctx context.Context,
				fs versioncontrol.FileStatus,
				idx int,
			) error {
				return v.StageHunk(ctx, fs, idx)
			},
		},
		{
			name: "UnstageHunk",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().UnstageHunk(gomock.Any(), gomock.Any()).Return(execErr)
			},
			call: func(
				v *git.Git,
				ctx context.Context,
				fs versioncontrol.FileStatus,
				idx int,
			) error {
				return v.UnstageHunk(ctx, fs, idx)
			},
		},
		{
			name: "DiscardHunk",
			setupMock: func(e *mock.MockExecutor, execErr error) {
				e.EXPECT().DiscardHunk(gomock.Any(), gomock.Any()).Return(execErr)
			},
			call: func(
				v *git.Git,
				ctx context.Context,
				fs versioncontrol.FileStatus,
				idx int,
			) error {
				return v.DiscardHunk(ctx, fs, idx)
			},
		},
	}

	for _, m := range methods {
		t.Run(m.name, func(t *testing.T) {
			t.Parallel()

			t.Run("valid hunk", func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				executor := mock.NewMockExecutor(ctrl)
				executor.EXPECT().
					DiffFile(gomock.Any(), "--", "main.go").
					Return(twoHunkDiff, nil)
				m.setupMock(executor, nil)

				v := git.NewGit(executor)

				if err := m.call(v, context.Background(), mainFS, 0); err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			})

			t.Run("unknown path returns nil", func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				executor := mock.NewMockExecutor(ctrl)
				executor.EXPECT().
					DiffFile(gomock.Any(), "--", "nonexistent.go").
					Return("", nil)

				v := git.NewGit(executor)
				fs := versioncontrol.FileStatus{
					Path:     "nonexistent.go",
					OrigPath: "",
					Kind:     versioncontrol.ChangeModified,
					Staged:   false,
					Partial:  false,
				}

				if err := m.call(v, context.Background(), fs, 0); err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			})

			t.Run("executor error is propagated", func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				executor := mock.NewMockExecutor(ctrl)
				executor.EXPECT().
					DiffFile(gomock.Any(), "--", "main.go").
					Return(twoHunkDiff, nil)
				m.setupMock(executor, errTest)

				v := git.NewGit(executor)

				err := m.call(v, context.Background(), mainFS, 0)
				if !errors.Is(err, errTest) {
					t.Errorf("error = %v, want %v", err, errTest)
				}
			})
		})
	}
}

func TestGit_DiscardFolder(t *testing.T) {
	t.Parallel()

	t.Run("discards files under folder", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().Status(gomock.Any()).
			Return(" M pkg/bar.go\n M pkg/foo.go\n M main.go\n", nil)
		executor.EXPECT().
			DiscardFiles(gomock.Any(), []string{"pkg/bar.go", "pkg/foo.go"}).
			Return(nil)

		v := git.NewGit(executor)

		if err := v.DiscardFolder(context.Background(), "pkg"); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("nonexistent folder is no-op", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().Status(gomock.Any()).Return(" M main.go\n", nil)

		v := git.NewGit(executor)

		if err := v.DiscardFolder(context.Background(), "nonexistent"); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("status error is propagated", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().Status(gomock.Any()).Return("", errTest)

		v := git.NewGit(executor)

		err := v.DiscardFolder(context.Background(), "pkg")
		if !errors.Is(err, errTest) {
			t.Errorf("error = %v, want %v", err, errTest)
		}
	})

	t.Run("discard error is propagated", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().Status(gomock.Any()).
			Return(" M pkg/bar.go\n", nil)
		executor.EXPECT().
			DiscardFiles(gomock.Any(), []string{"pkg/bar.go"}).
			Return(errTest)

		v := git.NewGit(executor)

		err := v.DiscardFolder(context.Background(), "pkg")
		if !errors.Is(err, errTest) {
			t.Errorf("error = %v, want %v", err, errTest)
		}
	})
}

func TestGit_HunkOperations_RenamedFile(t *testing.T) {
	t.Parallel()

	// Simulates git diff -M HEAD output for a renamed file with a content change.
	const renameDiff = `diff --git a/old.go b/new.go
similarity index 90%
rename from old.go
rename to new.go
--- a/old.go
+++ b/new.go
@@ -9,1 +9,2 @@ func main() {
 func other() {}
+func added() {}
`

	renameFS := versioncontrol.FileStatus{
		Path:     "new.go",
		OrigPath: "old.go",
		Kind:     versioncontrol.ChangeRenamed,
		Staged:   true,
		Partial:  false,
	}

	methods := []struct {
		name      string
		setupMock func(e *mock.MockExecutor, patch string)
		call      func(v *git.Git, ctx context.Context) error
	}{
		{
			name: "DiscardHunk sanitizes rename patch",
			setupMock: func(e *mock.MockExecutor, patch string) {
				e.EXPECT().DiscardHunk(gomock.Any(), patch).Return(nil)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.DiscardHunk(ctx, renameFS, 0)
			},
		},
		{
			name: "StageHunk sanitizes rename patch",
			setupMock: func(e *mock.MockExecutor, patch string) {
				e.EXPECT().StageHunk(gomock.Any(), patch).Return(nil)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.StageHunk(ctx, renameFS, 0)
			},
		},
		{
			name: "UnstageHunk sanitizes rename patch",
			setupMock: func(e *mock.MockExecutor, patch string) {
				e.EXPECT().UnstageHunk(gomock.Any(), patch).Return(nil)
			},
			call: func(v *git.Git, ctx context.Context) error {
				return v.UnstageHunk(ctx, renameFS, 0)
			},
		},
	}

	// The sanitized patch should have rename metadata stripped and paths
	// normalized to new.go so git apply only modifies content, not the rename.
	const wantPatch = `diff --git a/new.go b/new.go
--- a/new.go
+++ b/new.go
@@ -9,1 +9,2 @@ func main() {
 func other() {}
+func added() {}
`

	for _, m := range methods {
		t.Run(m.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			executor := mock.NewMockExecutor(ctrl)
			executor.EXPECT().
				DiffFile(gomock.Any(), "--cached", "-M", "--", "new.go", "old.go").
				Return(renameDiff, nil)
			m.setupMock(executor, wantPatch)

			v := git.NewGit(executor)

			if err := m.call(v, context.Background()); err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestGit_GetChangeDetails_PartialStaging_Renamed(t *testing.T) {
	t.Parallel()

	// Simulates git diff --cached -M -- new.go old.go for a partially staged rename
	const stagedDiff = `diff --git a/old.go b/new.go
similarity index 90%
rename from old.go
rename to new.go
--- a/old.go
+++ b/new.go
@@ -1,6 +1,9 @@
 package main

-import "fmt"
+import (
+	"fmt"
+	"os"
+)

 func main() {
 	fmt.Println("hello")
`

	const unstagedDiff = `diff --git a/new.go b/new.go
index 4757c60..f87c985 100644
--- a/new.go
+++ b/new.go
@@ -19,4 +19,5 @@ func main() {

 func other() {
 	fmt.Println("other")
+	os.Exit(0)
 }
`

	ctrl := gomock.NewController(t)
	executor := mock.NewMockExecutor(ctrl)

	executor.EXPECT().
		DiffFile(gomock.Any(), "--cached", "-M", "--", "new.go", "old.go").
		Return(stagedDiff, nil)
	executor.EXPECT().
		DiffFile(gomock.Any(), "--", "new.go").
		Return(unstagedDiff, nil)

	v := git.NewGit(executor)

	fs := versioncontrol.FileStatus{
		Path:     "new.go",
		OrigPath: "old.go",
		Kind:     versioncontrol.ChangeRenamed,
		Staged:   false,
		Partial:  true,
	}

	detail, err := v.GetChangeDetails(context.Background(), fs)
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details for new.go")
	}

	want := []versioncontrol.HunkDetail{
		{Staged: true, SourceIndex: 0},
		{Staged: false, SourceIndex: 0},
	}

	if d := cmp.Diff(want, detail.Hunks); d != "" {
		t.Errorf("Hunks mismatch (-want +got):\n%s", d)
	}
}

func TestGit_GetChangeDetails_PartialStaging(t *testing.T) {
	t.Parallel()

	const stagedDiff = `diff --git a/main.go b/main.go
index 1159d81..4757c60 100644
--- a/main.go
+++ b/main.go
@@ -1,6 +1,9 @@
 package main

-import "fmt"
+import (
+	"fmt"
+	"os"
+)

 func main() {
 	fmt.Println("hello")
`

	const unstagedDiff = `diff --git a/main.go b/main.go
index 4757c60..f87c985 100644
--- a/main.go
+++ b/main.go
@@ -19,4 +19,5 @@ func main() {

 func other() {
 	fmt.Println("other")
+	os.Exit(0)
 }
`

	ctrl := gomock.NewController(t)
	executor := mock.NewMockExecutor(ctrl)

	// partiallyStaged calls diffStaged then diffUnstaged
	executor.EXPECT().DiffFile(gomock.Any(), "--cached", "--", "main.go").Return(stagedDiff, nil)
	executor.EXPECT().DiffFile(gomock.Any(), "--", "main.go").Return(unstagedDiff, nil)

	v := git.NewGit(executor)

	fs := versioncontrol.FileStatus{
		Path:     "main.go",
		OrigPath: "",
		Kind:     versioncontrol.ChangeModified,
		Staged:   false,
		Partial:  true,
	}

	detail, err := v.GetChangeDetails(context.Background(), fs)
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details for main.go")
	}

	want := []versioncontrol.HunkDetail{
		{Staged: true, SourceIndex: 0},
		{Staged: false, SourceIndex: 0},
	}

	if diff := cmp.Diff(want, detail.Hunks); diff != "" {
		t.Errorf("Hunks mismatch (-want +got):\n%s", diff)
	}
}

func TestGit_GetChangeDetails_PartialStaging_AdjacentChanges(t *testing.T) {
	t.Parallel()

	// Scenario: echo "asd" >> 1; git add 1; echo "asd" >> 1
	// git diff HEAD would combine these into 1 hunk, but staged and unstaged
	// diffs show separate hunks.
	const stagedDiff = `diff --git a/1 b/1
index 1234567..abcdefg 100644
--- a/1
+++ b/1
@@ -3,3 +3,4 @@ line2
 line3
 line4
 line5
+asd
`

	const unstagedDiff = `diff --git a/1 b/1
index abcdefg..9876543 100644
--- a/1
+++ b/1
@@ -6,3 +6,4 @@ line5
 asd
 line6
 line7
+asd
`

	ctrl := gomock.NewController(t)
	executor := mock.NewMockExecutor(ctrl)

	executor.EXPECT().DiffFile(gomock.Any(), "--cached", "--", "1").Return(stagedDiff, nil)
	executor.EXPECT().DiffFile(gomock.Any(), "--", "1").Return(unstagedDiff, nil)

	v := git.NewGit(executor)

	fs := versioncontrol.FileStatus{
		Path:     "1",
		OrigPath: "",
		Kind:     versioncontrol.ChangeModified,
		Staged:   false,
		Partial:  true,
	}

	detail, err := v.GetChangeDetails(context.Background(), fs)
	if err != nil {
		t.Fatalf("GetChangeDetails failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected change details")
	}

	if len(detail.Hunks) != 2 {
		t.Fatalf("expected 2 hunks (1 staged + 1 unstaged), got %d", len(detail.Hunks))
	}

	want := []versioncontrol.HunkDetail{
		{Staged: true, SourceIndex: 0},
		{Staged: false, SourceIndex: 0},
	}

	if d := cmp.Diff(want, detail.Hunks); d != "" {
		t.Errorf("Hunks mismatch (-want +got):\n%s", d)
	}
}

func TestGit_HunkOperations_PartialFile(t *testing.T) {
	t.Parallel()

	partialFS := versioncontrol.FileStatus{
		Path:     "main.go",
		OrigPath: "",
		Kind:     versioncontrol.ChangeModified,
		Staged:   false,
		Partial:  true,
	}

	const stagedDiff = `diff --git a/main.go b/main.go
index 1234567..abcdefg 100644
--- a/main.go
+++ b/main.go
@@ -1,3 +1,4 @@
 package main

+import "fmt"
 func main() {}
`

	const unstagedDiff = `diff --git a/main.go b/main.go
index abcdefg..9876543 100644
--- a/main.go
+++ b/main.go
@@ -10,3 +10,4 @@ func main() {}

 func other() {}
+func added() {}
`

	t.Run("StageHunk uses unstaged diff", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().
			DiffFile(gomock.Any(), "--", "main.go").
			Return(unstagedDiff, nil)
		executor.EXPECT().StageHunk(gomock.Any(), gomock.Any()).Return(nil)

		v := git.NewGit(executor)

		if err := v.StageHunk(context.Background(), partialFS, 0); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("UnstageHunk uses staged diff", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().
			DiffFile(gomock.Any(), "--cached", "--", "main.go").
			Return(stagedDiff, nil)
		executor.EXPECT().UnstageHunk(gomock.Any(), gomock.Any()).Return(nil)

		v := git.NewGit(executor)

		if err := v.UnstageHunk(context.Background(), partialFS, 0); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("DiscardHunk uses unstaged diff", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		executor := mock.NewMockExecutor(ctrl)
		executor.EXPECT().
			DiffFile(gomock.Any(), "--", "main.go").
			Return(unstagedDiff, nil)
		executor.EXPECT().DiscardHunk(gomock.Any(), gomock.Any()).Return(nil)

		v := git.NewGit(executor)

		if err := v.DiscardHunk(context.Background(), partialFS, 0); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
