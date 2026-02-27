package tui

import "github.com/charmbracelet/lipgloss"

type HelpModel struct {
	Visible bool
	Width   int
	Height  int
}

func NewHelpModel() HelpModel {
	return HelpModel{
		Visible: false,
	}
}

func (m *HelpModel) Toggle() {
	m.Visible = !m.Visible
}

func (m *HelpModel) View() string {
	if !m.Visible {
		return ""
	}

	content := titleStyle().Render("Key Bindings") + "\n\n" +
		"j/k, ↑/↓     Navigate files / scroll diff\n" +
		"J/K          Jump to next/prev hunk\n" +
		"Tab          Switch panel focus\n" +
		"Enter, l     Focus diff panel\n" +
		"Space        Toggle hunk reviewed\n" +
		"a            Toggle file reviewed\n" +
		"?            Close help\n" +
		"q            Quit"

	overlay := helpStyle().Render(content)

	return lipgloss.Place(m.Width, m.Height,
		lipgloss.Center, lipgloss.Center,
		overlay,
	)
}
