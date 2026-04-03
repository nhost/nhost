package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type Step struct {
	Name string
	Fn   func() error
}

type stepDoneMsg struct {
	index int
	err   error
}

type stepsModel struct {
	steps   []Step
	spinner spinner.Model
	current int
	err     error
}

func newStepsModel(steps []Step) stepsModel {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	return stepsModel{
		steps:   steps,
		spinner: s,
		current: 0,
		err:     nil,
	}
}

func (m stepsModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.runStep(0))
}

func (m stepsModel) runStep(index int) tea.Cmd {
	fn := m.steps[index].Fn

	return func() tea.Msg {
		return stepDoneMsg{index: index, err: fn()}
	}
}

func (m stepsModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.Type == tea.KeyCtrlC {
			m.err = ErrInterrupted

			return m, tea.Quit
		}
	case stepDoneMsg:
		return m.handleStepDone(msg)
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	}

	return m, nil
}

func (m stepsModel) handleStepDone( //nolint:ireturn
	msg stepDoneMsg,
) (tea.Model, tea.Cmd) {
	if msg.err != nil {
		m.err = msg.err

		return m, tea.Quit
	}

	m.current = msg.index + 1

	if m.current >= len(m.steps) {
		return m, tea.Quit
	}

	return m, m.runStep(m.current)
}

func (m stepsModel) View() string {
	var b strings.Builder

	for i, step := range m.steps {
		b.WriteString(renderStepLine(step, i, m.current, m.err, m.spinner.View()))
		b.WriteString("\n")
	}

	return b.String()
}

func renderStepLine(
	step Step, index, current int, finalErr error, spinView string,
) string {
	switch {
	case index < current:
		return "  " + phaseCheck + " " + step.Name
	case index == current && finalErr != nil:
		return "  " + phaseCross + " " + step.Name
	case index == current:
		return "  " + spinView + " " + step.Name
	default:
		return "    " + phasePending.Render(step.Name)
	}
}

func RunSteps(steps []Step) error {
	m := newStepsModel(steps)

	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("steps TUI error: %w", err)
	}

	if fm, ok := finalModel.(stepsModel); ok && fm.err != nil {
		return fm.err
	}

	return nil
}
