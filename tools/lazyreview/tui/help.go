package tui

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
)

type helpModel struct {
	visible   bool
	isGitMode bool
	width     int
	height    int
}

func newHelpModel(isGitMode bool) helpModel {
	return helpModel{
		visible:   false,
		isGitMode: isGitMode,
		width:     0,
		height:    0,
	}
}

func (m *helpModel) toggle() {
	m.visible = !m.visible
}

type helpEntry struct {
	key  string
	desc string
}

func (m *helpModel) render() string {
	if !m.visible {
		return ""
	}

	entries := m.buildEntries()
	table := m.renderTable(entries)
	overlay := helpStyle().Render(table)

	return lipgloss.Place(m.width, m.height,
		lipgloss.Center, lipgloss.Center,
		overlay,
	)
}

func (m *helpModel) buildEntries() []helpEntry {
	stageVerb := "Toggle reviewed"
	if m.isGitMode {
		stageVerb = "Stage / unstage"
	}

	entries := []helpEntry{
		{"1", "Review mode"},
		{"2", "Git mode"},
		{"j/k, ↑/↓", "Navigate tree / navigate hunks"},
		{"J/K", "Scroll diff up/down"},
		{"g/G", "Go to top / bottom"},
		{"h/←", "Collapse dir / go to parent"},
		{"l/→, Enter", "Expand dir / focus diff"},
		{"Tab", "Switch panel focus"},
		{"Space, a", stageVerb + " (file/dir/hunk)"},
	}

	if m.isGitMode {
		entries = append(entries, helpEntry{"d", "Discard changes (file/dir/hunk)"})
		entries = append(entries, helpEntry{"c", "Commit"})
		entries = append(entries, helpEntry{"p", "Push"})
		entries = append(entries, helpEntry{"P", "Force push (--force-with-lease)"})
	}

	entries = append(entries,
		helpEntry{"r", "Refresh diff"},
		helpEntry{"?", "Close help"},
		helpEntry{"q", "Quit"},
	)

	return entries
}

func (m *helpModel) renderTable(entries []helpEntry) string {
	keyWidth := 0

	for _, e := range entries {
		if w := lipgloss.Width(e.key); w > keyWidth {
			keyWidth = w
		}
	}

	keyStyle := lipgloss.NewStyle().
		Width(keyWidth).
		Align(lipgloss.Right).
		Foreground(lipgloss.Color("6")).
		Bold(true)
	sepStyle := contextStyle()

	lines := make([]string, 0, len(entries))

	for _, e := range entries {
		line := fmt.Sprintf("%s %s %s", keyStyle.Render(e.key), sepStyle.Render("│"), e.desc)
		lines = append(lines, line)
	}

	tableStr := strings.Join(lines, "\n")
	tableWidth := lipgloss.Width(lines[0])

	for _, l := range lines[1:] {
		if w := lipgloss.Width(l); w > tableWidth {
			tableWidth = w
		}
	}

	title := lipgloss.NewStyle().
		Width(tableWidth).
		Align(lipgloss.Center).
		Render(titleStyle().Render("Key Bindings"))

	return title + "\n\n" + tableStr
}
