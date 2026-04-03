package clienv

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

func (ce *CliEnv) RunModel(model tea.Model) (tea.Model, error) { //nolint:ireturn
	p := tea.NewProgram(
		model,
		tea.WithInput(ce.stdin),
		tea.WithOutput(ce.stderr),
	)

	result, err := p.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to run TUI: %w", err)
	}

	return result, nil
}

func (ce *CliEnv) RunForm(form *huh.Form) error {
	if err := form.Run(); err != nil {
		return fmt.Errorf("failed to run form: %w", err)
	}

	return nil
}

func (ce *CliEnv) ConfirmPrompt(message string, defaultVal bool) (bool, error) {
	if ce.interactive {
		var confirmed bool

		form := huh.NewForm(
			huh.NewGroup(
				huh.NewConfirm().
					Title(message).
					Value(&confirmed).
					Affirmative("Yes").
					Negative("No"),
			),
		)

		if err := ce.RunForm(form); err != nil {
			return false, err
		}

		return confirmed, nil
	}

	suffix := " [y/N] "
	if defaultVal {
		suffix = " [Y/n] "
	}

	ce.PromptMessage("%s", message+suffix)

	resp, err := ce.PromptInput(false)
	if err != nil {
		return false, err
	}

	resp = strings.ToLower(strings.TrimSpace(resp))

	switch resp {
	case "y", "yes":
		return true, nil
	case "n", "no":
		return false, nil
	case "":
		return defaultVal, nil
	default:
		return false, nil
	}
}

func (ce *CliEnv) TextPrompt(message string, hidden bool) (string, error) {
	if ce.interactive {
		var value string

		input := huh.NewInput().
			Title(message).
			Value(&value)

		if hidden {
			input = input.EchoMode(huh.EchoModePassword)
		}

		form := huh.NewForm(
			huh.NewGroup(input),
		)

		if err := ce.RunForm(form); err != nil {
			return "", err
		}

		return value, nil
	}

	ce.PromptMessage("%s: ", message)

	return ce.PromptInput(hidden)
}

type spinnerDoneMsg struct {
	err error
}

type spinnerModel struct {
	spinner spinner.Model
	message string
	done    bool
	err     error
	fn      func() error
}

func newSpinnerModel(message string, fn func() error) spinnerModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(ANSIColorCyan)

	return spinnerModel{
		spinner: s,
		message: message,
		fn:      fn,
		done:    false,
		err:     nil,
	}
}

func (m spinnerModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		func() tea.Msg {
			return spinnerDoneMsg{err: m.fn()}
		},
	)
}

func (m spinnerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case spinnerDoneMsg:
		m.done = true
		m.err = msg.err

		return m, tea.Quit
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}

	return m, nil
}

func (m spinnerModel) View() string {
	if m.done {
		return ""
	}

	return m.spinner.View() + " " + m.message + "\n"
}

func (ce *CliEnv) Spinner(message string, fn func() error) error {
	if !ce.interactive {
		ce.Infoln("%s", message)

		return fn()
	}

	model := newSpinnerModel(message, fn)

	result, err := ce.RunModel(model)
	if err != nil {
		return fmt.Errorf("spinner failed: %w", err)
	}

	if m, ok := result.(spinnerModel); ok && m.err != nil {
		return m.err
	}

	return nil
}
