// Package render turns an activity.Report into the markdown layout used by
// the team's daily stand-up.
package render

import (
	"fmt"
	"io"
	"sort"

	"github.com/nhost/nhost/tools/ghactivity/internal/activity"
)

// Markdown writes the report to w in the team's stand-up format. Link URLs
// are wrapped in angle brackets so that renderers like Slack and GitHub do
// not expand them into rich previews.
func Markdown(w io.Writer, r *activity.Report) error {
	if err := writeHeader(w, r); err != nil {
		return err
	}

	sections := []struct {
		heading string
		items   []activity.Item
	}{
		{"### 🟢 In progress", r.InProgress},
		{"### 👀 Moved to waiting for review", r.ReadyForReview},
		{"### ⏸️ Blocked / waiting on something else", r.Blocked},
		{"### ✅ Closed / merged", r.ClosedOrMerged},
		{"### 🔍 Reviewed / commented", r.Reviewed},
	}

	for i, s := range sections {
		if _, err := fmt.Fprintln(w, s.heading); err != nil {
			return wrap(err)
		}

		if _, err := fmt.Fprintln(w); err != nil {
			return wrap(err)
		}

		if err := writeItems(w, s.items); err != nil {
			return err
		}

		if i < len(sections)-1 {
			if _, err := fmt.Fprintln(w); err != nil {
				return wrap(err)
			}
		}
	}

	const tail = `
### 🎯 Today's focus

What you're planning to work on today (especially anything not yet on the board)

### 📝 Other

Anything not tracked on GitHub, FYIs, heads-ups

### Uncategorized

`
	if _, err := fmt.Fprint(w, tail); err != nil {
		return wrap(err)
	}

	return writeItems(w, r.Uncategorized)
}

func writeHeader(w io.Writer, r *activity.Report) error {
	date := reportDate(r)
	if date == "" && r.User == "" {
		return nil
	}

	title := date
	if r.User != "" {
		if title != "" {
			title += " - "
		}

		title += r.User
	}

	if _, err := fmt.Fprintf(w, "## %s\n\n", title); err != nil {
		return wrap(err)
	}

	return nil
}

func reportDate(r *activity.Report) string {
	if r.Since.IsZero() {
		return ""
	}

	since := r.Since.Format("2006-01-02")
	if r.Until.IsZero() || since == r.Until.Format("2006-01-02") {
		return since
	}

	return since + " to " + r.Until.Format("2006-01-02")
}

func writeItems(w io.Writer, items []activity.Item) error {
	if len(items) == 0 {
		return nil
	}

	sorted := make([]activity.Item, len(items))
	copy(sorted, items)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].Repository != sorted[j].Repository {
			return sorted[i].Repository < sorted[j].Repository
		}

		return sorted[i].Number < sorted[j].Number
	})

	for _, it := range sorted {
		if _, err := fmt.Fprintf(
			w, "- [%s #%d](<%s>) %s\n", it.Kind, it.Number, it.URL, it.Title,
		); err != nil {
			return wrap(err)
		}
	}

	return nil
}

func wrap(err error) error {
	return fmt.Errorf("writing markdown: %w", err)
}
