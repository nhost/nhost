package tui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type spinnerDoneMsg struct{ err error }

// SpinnerModel wraps a spinner with a message and a background task.
type SpinnerModel struct {
	spinner spinner.Model
	message string
	done    bool
	err     error
	fn      func() error
}

func newSpinnerModel(message string, fn func() error) SpinnerModel {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	return SpinnerModel{
		spinner: s,
		message: message,
		done:    false,
		err:     nil,
		fn:      fn,
	}
}

func (m SpinnerModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.runTask())
}

func (m SpinnerModel) runTask() tea.Cmd {
	fn := m.fn

	return func() tea.Msg {
		return spinnerDoneMsg{err: fn()}
	}
}

func (m SpinnerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.Type == tea.KeyCtrlC {
			return m, tea.Quit
		}
	case spinnerDoneMsg:
		m.done = true
		m.err = msg.err

		return m, tea.Quit
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	}

	return m, nil
}

func (m SpinnerModel) View() string {
	if m.done {
		if m.err != nil {
			return "  " + phaseCross + " " + m.message + "\n"
		}

		return "  " + phaseCheck + " " + m.message + "\n"
	}

	return "  " + m.spinner.View() + " " + m.message + "\n"
}

// RunWithSpinner shows a spinner while fn runs, then shows a check or cross.
func RunWithSpinner(message string, fn func() error) error {
	m := newSpinnerModel(message, fn)

	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("spinner TUI error: %w", err)
	}

	if fm, ok := finalModel.(SpinnerModel); ok && fm.err != nil {
		return fm.err
	}

	return nil
}
