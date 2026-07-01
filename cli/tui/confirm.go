package tui

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type confirmModel struct {
	message   string
	confirmed bool
	done      bool
}

func (m confirmModel) Init() tea.Cmd {
	return nil
}

func (m confirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	km, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch km.String() {
	case "y", "Y":
		m.confirmed = true
		m.done = true

		return m, tea.Quit
	case "n", "N", "esc":
		m.confirmed = false
		m.done = true

		return m, tea.Quit
	case "enter":
		// enter without prior input means default (No)
		m.confirmed = false
		m.done = true

		return m, tea.Quit
	case "ctrl+c":
		m.confirmed = false
		m.done = true

		return m, tea.Quit
	}

	return m, nil
}

func (m confirmModel) View() string {
	warnIcon := lipgloss.NewStyle().Foreground(colorYellow).Render("\u26a0")
	hint := lipgloss.NewStyle().Foreground(colorGray).Render("(y/N)")

	return fmt.Sprintf("\n  %s %s\n  Continue? %s ", warnIcon, m.message, hint)
}

var ErrConfirmCancelled = fmt.Errorf("confirmation cancelled") //nolint:err113,gochecknoglobals

func RunConfirm(message string) (bool, error) {
	m := confirmModel{
		message:   message,
		confirmed: false,
		done:      false,
	}

	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return false, fmt.Errorf("confirm error: %w", err)
	}

	fm, ok := finalModel.(confirmModel)
	if !ok {
		return false, ErrConfirmCancelled
	}

	return fm.confirmed, nil
}
