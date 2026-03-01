package diff_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/lazyreview/diff"
)

func TestParse_StandardDiff(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,3 +1,4 @@",
		" package main",
		" ",
		"-func old() {}",
		"+func new1() {}",
		"+func new2() {}",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	f := files[0]
	if f.Path != "main.go" {
		t.Errorf("expected path main.go, got %s", f.Path)
	}

	if len(f.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(f.Hunks))
	}

	wantHunk := diff.Hunk{
		Header:   "@@ -1,3 +1,4 @@",
		OldStart: 1,
		OldCount: 3,
		NewStart: 1,
		NewCount: 4,
		Lines: []diff.Line{
			{Type: diff.Context, Content: " package main"},
			{Type: diff.Context, Content: " "},
			{Type: diff.Removed, Content: "-func old() {}"},
			{Type: diff.Added, Content: "+func new1() {}"},
			{Type: diff.Added, Content: "+func new2() {}"},
		},
	}

	if d := cmp.Diff(wantHunk, *f.Hunks[0]); d != "" {
		t.Errorf("hunk mismatch (-want +got):\n%s", d)
	}
}

func TestParse_NewFile(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/new.go b/new.go",
		"new file mode 100644",
		"index 0000000..abcdefg",
		"--- /dev/null",
		"+++ b/new.go",
		"@@ -0,0 +1,3 @@",
		"+package main",
		"+",
		"+func hello() {}",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	if files[0].Path != "new.go" {
		t.Errorf("expected path new.go, got %s", files[0].Path)
	}

	if len(files[0].Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(files[0].Hunks))
	}

	wantLines := []diff.Line{
		{Type: diff.Added, Content: "+package main"},
		{Type: diff.Added, Content: "+"},
		{Type: diff.Added, Content: "+func hello() {}"},
	}

	if d := cmp.Diff(wantLines, files[0].Hunks[0].Lines); d != "" {
		t.Errorf("lines mismatch (-want +got):\n%s", d)
	}
}

func TestParse_DeletedFile(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/old.go b/old.go",
		"deleted file mode 100644",
		"index abcdefg..0000000",
		"--- a/old.go",
		"+++ /dev/null",
		"@@ -1,2 +0,0 @@",
		"-package main",
		"-func bye() {}",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	if files[0].Path != "old.go" {
		t.Errorf("expected path old.go, got %s", files[0].Path)
	}

	wantLines := []diff.Line{
		{Type: diff.Removed, Content: "-package main"},
		{Type: diff.Removed, Content: "-func bye() {}"},
	}

	if d := cmp.Diff(wantLines, files[0].Hunks[0].Lines); d != "" {
		t.Errorf("lines mismatch (-want +got):\n%s", d)
	}
}

func TestParse_RenamedFile(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/old_name.go b/new_name.go",
		"similarity index 95%",
		"rename from old_name.go",
		"rename to new_name.go",
		"index 1234567..abcdefg 100644",
		"--- a/old_name.go",
		"+++ b/new_name.go",
		"@@ -1,3 +1,3 @@",
		" package main",
		" ",
		"-func oldName() {}",
		"+func newName() {}",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	// +++ b/ takes precedence over --- a/
	if files[0].Path != "new_name.go" {
		t.Errorf("expected path new_name.go, got %s", files[0].Path)
	}
}

func TestParse_PureRename(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/old_name.go b/new_name.go",
		"similarity index 100%",
		"rename from old_name.go",
		"rename to new_name.go",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file for pure rename, got %d", len(files))
	}

	if files[0].Path != "new_name.go" {
		t.Errorf("expected path new_name.go, got %s", files[0].Path)
	}

	if len(files[0].Hunks) != 0 {
		t.Errorf("expected 0 hunks for pure rename, got %d", len(files[0].Hunks))
	}
}

func TestParse_PureRenameBeforeOtherFile(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/old.go b/new.go",
		"similarity index 100%",
		"rename from old.go",
		"rename to new.go",
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-old",
		"+new",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(files))
	}

	if files[0].Path != "new.go" {
		t.Errorf("expected first file new.go, got %s", files[0].Path)
	}

	if files[1].Path != "main.go" {
		t.Errorf("expected second file main.go, got %s", files[1].Path)
	}
}

func TestParse_BinaryFile(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/image.png b/image.png",
		"Binary files a/image.png and b/image.png differ",
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-old",
		"+new",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file (binary skipped), got %d", len(files))
	}

	if files[0].Path != "main.go" {
		t.Errorf("expected path main.go, got %s", files[0].Path)
	}
}

func TestParse_EmptyDiff(t *testing.T) {
	t.Parallel()

	files := diff.Parse("")
	if len(files) != 0 {
		t.Errorf("expected 0 files for empty diff, got %d", len(files))
	}
}

func TestParse_MalformedHunkHeader(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ this is not a valid header @@",
		"+some line",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	// Malformed hunk should be skipped
	if len(files[0].Hunks) != 0 {
		t.Errorf("expected 0 hunks (malformed skipped), got %d", len(files[0].Hunks))
	}
}

func TestParse_MultipleFiles(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/a.go b/a.go",
		"index 1234567..abcdefg 100644",
		"--- a/a.go",
		"+++ b/a.go",
		"@@ -1,1 +1,1 @@",
		"-old a",
		"+new a",
		"diff --git a/b.go b/b.go",
		"index 1234567..abcdefg 100644",
		"--- a/b.go",
		"+++ b/b.go",
		"@@ -1,1 +1,1 @@",
		"-old b",
		"+new b",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(files))
	}

	if files[0].Path != "a.go" {
		t.Errorf("expected first file a.go, got %s", files[0].Path)
	}

	if files[1].Path != "b.go" {
		t.Errorf("expected second file b.go, got %s", files[1].Path)
	}
}

func TestParse_MultipleHunks(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,3 +1,3 @@",
		" package main",
		" ",
		"-func a() {}",
		"+func aa() {}",
		"@@ -10,3 +10,3 @@",
		" ",
		"-func b() {}",
		"+func bb() {}",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	if len(files[0].Hunks) != 2 {
		t.Fatalf("expected 2 hunks, got %d", len(files[0].Hunks))
	}

	wantStarts := []int{1, 10}
	gotStarts := []int{files[0].Hunks[0].OldStart, files[0].Hunks[1].OldStart}

	if d := cmp.Diff(wantStarts, gotStarts); d != "" {
		t.Errorf("OldStart mismatch (-want +got):\n%s", d)
	}
}

func TestParse_HunkHeaderWithContext(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -10,3 +10,3 @@ func main() {",
		" ",
		"-old",
		"+new",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	wantHunk := diff.Hunk{
		Header:   "@@ -10,3 +10,3 @@ func main() {",
		OldStart: 10,
		OldCount: 3,
		NewStart: 10,
		NewCount: 3,
		Lines: []diff.Line{
			{Type: diff.Context, Content: " "},
			{Type: diff.Removed, Content: "-old"},
			{Type: diff.Added, Content: "+new"},
		},
	}

	if d := cmp.Diff(wantHunk, *files[0].Hunks[0]); d != "" {
		t.Errorf("hunk mismatch (-want +got):\n%s", d)
	}
}

func TestParse_RawDiffPreserved(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-old",
		"+new",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	if files[0].RawDiff != raw {
		t.Errorf("RawDiff not preserved")
	}
}

func TestHunkPatch_SingleHunk(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,3 +1,3 @@",
		" package main",
		" ",
		"-func old() {}",
		"+func new1() {}",
	}, "\n")

	patch := diff.HunkPatch(raw, 0)
	if patch == "" {
		t.Fatal("expected non-empty patch")
	}

	if !strings.Contains(patch, "diff --git") {
		t.Error("patch should contain file header")
	}

	if !strings.Contains(patch, "@@ -1,3 +1,3 @@") {
		t.Error("patch should contain hunk header")
	}

	if !strings.Contains(patch, "-func old() {}") {
		t.Error("patch should contain hunk content")
	}
}

func TestHunkPatch_SecondHunk(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,3 +1,3 @@",
		" package main",
		" ",
		"-func a() {}",
		"+func aa() {}",
		"@@ -10,3 +10,3 @@",
		" ",
		"-func b() {}",
		"+func bb() {}",
	}, "\n")

	patch := diff.HunkPatch(raw, 1)
	if patch == "" {
		t.Fatal("expected non-empty patch")
	}

	if !strings.Contains(patch, "diff --git") {
		t.Error("patch should contain file header")
	}

	if !strings.Contains(patch, "@@ -10,3 +10,3 @@") {
		t.Error("patch should contain second hunk header")
	}

	if strings.Contains(patch, "@@ -1,3 +1,3 @@") {
		t.Error("patch should not contain first hunk header")
	}

	if !strings.Contains(patch, "-func b() {}") {
		t.Error("patch should contain second hunk content")
	}

	if strings.Contains(patch, "-func a() {}") {
		t.Error("patch should not contain first hunk content")
	}
}

func TestHunkPatch_OutOfRange(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-old",
		"+new",
	}, "\n")

	patch := diff.HunkPatch(raw, 5)
	if patch != "" {
		t.Errorf("expected empty patch for out of range index, got %q", patch)
	}
}

func TestParse_ModeOnlyChange(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/script.sh b/script.sh",
		"old mode 100644",
		"new mode 100755",
	}, "\n")

	files := diff.Parse(raw)

	// Mode-only changes have no --- / +++ lines so the path stays empty
	// and the file is not included in the output.
	if len(files) != 0 {
		t.Errorf("expected 0 files for mode-only change, got %d", len(files))
	}
}

func TestParse_NoNewlineMarker(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,2 @@",
		"-old line",
		"+new line",
		`\ No newline at end of file`,
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	wantLines := []diff.Line{
		{Type: diff.Removed, Content: "-old line"},
		{Type: diff.Added, Content: "+new line"},
		{Type: diff.Context, Content: `\ No newline at end of file`},
	}

	if d := cmp.Diff(wantLines, files[0].Hunks[0].Lines); d != "" {
		t.Errorf("lines mismatch (-want +got):\n%s", d)
	}
}

func TestHunkPatch_NegativeIndex(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-old",
		"+new",
	}, "\n")

	patch := diff.HunkPatch(raw, -1)
	if patch != "" {
		t.Errorf("expected empty patch for negative index, got %q", patch)
	}
}

func TestHunkPatch_ThirdHunk(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,1 +1,1 @@",
		"-first",
		"+first_new",
		"@@ -10,1 +10,1 @@",
		"-second",
		"+second_new",
		"@@ -20,1 +20,1 @@",
		"-third",
		"+third_new",
	}, "\n")

	patch := diff.HunkPatch(raw, 2)
	if patch == "" {
		t.Fatal("expected non-empty patch for third hunk")
	}

	if !strings.Contains(patch, "@@ -20,1 +20,1 @@") {
		t.Error("patch should contain third hunk header")
	}

	if !strings.Contains(patch, "-third") {
		t.Error("patch should contain third hunk content")
	}

	if strings.Contains(patch, "-first") || strings.Contains(patch, "-second") {
		t.Error("patch should not contain other hunks' content")
	}
}

func TestParse_SingleLineRange(t *testing.T) {
	t.Parallel()

	raw := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1234567..abcdefg 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -5 +5 @@",
		"-old",
		"+new",
	}, "\n")

	files := diff.Parse(raw)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	wantHunk := diff.Hunk{
		Header:   "@@ -5 +5 @@",
		OldStart: 5,
		OldCount: 1,
		NewStart: 5,
		NewCount: 1,
		Lines: []diff.Line{
			{Type: diff.Removed, Content: "-old"},
			{Type: diff.Added, Content: "+new"},
		},
	}

	if d := cmp.Diff(wantHunk, *files[0].Hunks[0]); d != "" {
		t.Errorf("hunk mismatch (-want +got):\n%s", d)
	}
}
