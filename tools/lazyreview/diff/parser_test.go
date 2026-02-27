package diff_test

import (
	"strings"
	"testing"

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

	h := f.Hunks[0]
	if h.OldStart != 1 || h.OldCount != 3 || h.NewStart != 1 || h.NewCount != 4 {
		t.Errorf("unexpected hunk ranges: old=%d,%d new=%d,%d", h.OldStart, h.OldCount, h.NewStart, h.NewCount)
	}

	if len(h.Lines) != 5 {
		t.Fatalf("expected 5 lines, got %d", len(h.Lines))
	}

	expectations := []struct {
		lineType diff.LineType
		content  string
	}{
		{diff.Context, " package main"},
		{diff.Context, " "},
		{diff.Removed, "-func old() {}"},
		{diff.Added, "+func new1() {}"},
		{diff.Added, "+func new2() {}"},
	}
	for i, exp := range expectations {
		if h.Lines[i].Type != exp.lineType {
			t.Errorf("line %d: expected type %d, got %d", i, exp.lineType, h.Lines[i].Type)
		}
		if h.Lines[i].Content != exp.content {
			t.Errorf("line %d: expected content %q, got %q", i, exp.content, h.Lines[i].Content)
		}
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

	h := files[0].Hunks[0]
	if h.OldStart != 0 || h.OldCount != 0 {
		t.Errorf("new file should have old range 0,0; got %d,%d", h.OldStart, h.OldCount)
	}

	if len(h.Lines) != 3 {
		t.Errorf("expected 3 lines, got %d", len(h.Lines))
	}

	for _, l := range h.Lines {
		if l.Type != diff.Added {
			t.Errorf("all lines in new file should be Added, got %d", l.Type)
		}
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

	// +++ /dev/null doesn't match "+++ b/", so path comes from "--- a/"
	if files[0].Path != "old.go" {
		t.Errorf("expected path old.go, got %s", files[0].Path)
	}

	for _, l := range files[0].Hunks[0].Lines {
		if l.Type != diff.Removed {
			t.Errorf("all lines in deleted file should be Removed, got %d", l.Type)
		}
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

	if files[0].Hunks[0].OldStart != 1 {
		t.Errorf("first hunk OldStart: expected 1, got %d", files[0].Hunks[0].OldStart)
	}

	if files[0].Hunks[1].OldStart != 10 {
		t.Errorf("second hunk OldStart: expected 10, got %d", files[0].Hunks[1].OldStart)
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

	h := files[0].Hunks[0]
	if h.OldStart != 10 || h.OldCount != 3 {
		t.Errorf("expected old range 10,3; got %d,%d", h.OldStart, h.OldCount)
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

	h := files[0].Hunks[0]
	// When count is omitted, it defaults to 1
	if h.OldCount != 1 || h.NewCount != 1 {
		t.Errorf("expected counts of 1 for single-line range; got old=%d new=%d", h.OldCount, h.NewCount)
	}
}
