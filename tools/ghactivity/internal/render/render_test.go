package render_test

import (
	"bytes"
	"strings"
	"testing"

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
		Uncategorized: []activity.Item{
			{
				Kind: activity.KindIssue, Number: 12, Title: "an issue",
				URL: "https://example.com/issue/12", Repository: "nhost/other",
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

	if !strings.Contains(got, "[Issue #12](https://example.com/issue/12) an issue") {
		t.Errorf("expected formatted issue line, got:\n%s", got)
	}
}
