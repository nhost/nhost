package render_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/tools/ghactivity/internal/activity"
	"github.com/nhost/nhost/tools/ghactivity/internal/render"
)

func TestMarkdownEmpty(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	if err := render.Markdown(&buf, &activity.Report{}); err != nil {
		t.Fatalf("render: %v", err)
	}

	got := buf.String()

	wantHeadings := []string{
		"### 🟢 In progress",
		"### 👀 Moved to waiting for review",
		"### ⏸️ Blocked / waiting on something else",
		"### ✅ Closed / merged",
		"### 🔍 Reviewed / commented",
		"### 🎯 Today's focus",
		"### 📝 Other",
		"### Uncategorized",
	}
	for _, h := range wantHeadings {
		if !strings.Contains(got, h) {
			t.Errorf("missing heading %q in output:\n%s", h, got)
		}
	}
}

func TestMarkdownIncludesHeader(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	if err := render.Markdown(&buf, &activity.Report{
		User:  "meh",
		Since: time.Date(2026, 5, 20, 9, 0, 0, 0, time.UTC),
		Until: time.Date(2026, 5, 20, 17, 0, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("render: %v", err)
	}

	if !strings.HasPrefix(buf.String(), "## 2026-05-20 - meh\n\n") {
		t.Fatalf("expected report header, got:\n%s", buf.String())
	}
}

func TestMarkdownIncludesDateRangeHeader(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	if err := render.Markdown(&buf, &activity.Report{
		User:  "meh",
		Since: time.Date(2026, 4, 25, 11, 0, 0, 0, time.UTC),
		Until: time.Date(2026, 6, 4, 9, 0, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("render: %v", err)
	}

	if !strings.HasPrefix(buf.String(), "## 2026-04-25 to 2026-06-04 - meh\n\n") {
		t.Fatalf("expected report date range header, got:\n%s", buf.String())
	}
}

func TestMarkdownItemsSortedAndFormatted(t *testing.T) {
	t.Parallel()

	r := &activity.Report{
		InProgress: []activity.Item{
			{
				Kind: activity.KindPR, Number: 4321, Title: "first",
				URL: "https://example.com/pr/4321", Repository: "nhost/nhost",
			},
			{
				Kind: activity.KindPR, Number: 4319, Title: "earlier",
				URL: "https://example.com/pr/4319", Repository: "nhost/nhost",
			},
		},
		Reviewed: []activity.Item{
			{
				Kind: activity.KindPR, Number: 12, Title: "a reviewed pr",
				URL: "https://example.com/pr/12", Repository: "nhost/other",
			},
		},
		Uncategorized: []activity.Item{
			{
				Kind: activity.KindIssue, Number: 13, Title: "an issue",
				URL: "https://example.com/issue/13", Repository: "nhost/other",
			},
		},
	}

	var buf bytes.Buffer
	if err := render.Markdown(&buf, r); err != nil {
		t.Fatalf("render: %v", err)
	}

	got := buf.String()
	// Ascending by number within the same repo.
	idxEarlier := strings.Index(got, "[PR #4319]")

	idxFirst := strings.Index(got, "[PR #4321]")
	if idxEarlier == -1 || idxFirst == -1 {
		t.Fatalf("expected both PR entries, got:\n%s", got)
	}

	if idxEarlier > idxFirst {
		t.Errorf("expected PR #4319 before #4321; got:\n%s", got)
	}

	if !strings.Contains(got, "[PR #12](https://example.com/pr/12) a reviewed pr") {
		t.Errorf("expected formatted reviewed PR line, got:\n%s", got)
	}

	if !strings.Contains(got, "[Issue #13](https://example.com/issue/13) an issue") {
		t.Errorf("expected formatted issue line, got:\n%s", got)
	}
}
