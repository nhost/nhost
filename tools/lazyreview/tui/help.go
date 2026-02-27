package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

type HelpModel struct {
	Visible bool
	Mode    AppMode
	Width   int
	Height  int
}

func NewHelpModel(mode AppMode) HelpModel {
	return HelpModel{
		Visible: false,
		Mode:    mode,
		Width:   0,
		Height:  0,
	}
}

func (m *HelpModel) Toggle() {
	m.Visible = !m.Visible
}

type helpEntry struct {
	key  string
	desc string
}

func (m *HelpModel) View() string { //nolint:funlen
	if !m.Visible {
		return ""
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
	}

	switch m.Mode { //nolint:exhaustive
	case ModeGit:
		entries = append(entries,
			helpEntry{"Space, a", "Stage / unstage (file/dir/hunk)"},
			helpEntry{"c", "Commit"},
			helpEntry{"p", "Push"},
			helpEntry{"P", "Force push (--force-with-lease)"},
		)
	default:
		entries = append(entries,
			helpEntry{"Space, a", "Toggle reviewed (file/dir/hunk)"},
		)
	}

	entries = append(entries,
		helpEntry{"r", "Refresh diff"},
		helpEntry{"?", "Close help"},
		helpEntry{"q", "Quit"},
	)

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

	var lines []string

	for _, e := range entries {
		line := fmt.Sprintf("%s %s %s", keyStyle.Render(e.key), sepStyle.Render("│"), e.desc)
		lines = append(lines, line)
	}

	table := strings.Join(lines, "\n")
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
	content := title + "\n\n" + table
	overlay := helpStyle().Render(content)

	return lipgloss.Place(m.Width, m.Height,
		lipgloss.Center, lipgloss.Center,
		overlay,
	)
}
