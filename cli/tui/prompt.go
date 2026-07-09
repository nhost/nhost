package tui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type promptModel struct {
	label        string
	input        textinput.Model
	defaultValue string
	submitted    bool
	cancelled    bool
}

func newPromptModel(label, defaultValue string) promptModel {
	ti := textinput.New()
	ti.Placeholder = defaultValue
	ti.Focus()

	return promptModel{
		label:        label,
		input:        ti,
		defaultValue: defaultValue,
		submitted:    false,
		cancelled:    false,
	}
}

func (m promptModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m promptModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	if km, ok := msg.(tea.KeyMsg); ok {
		return m.handlePromptKey(km)
	}

	var cmd tea.Cmd

	m.input, cmd = m.input.Update(msg)

	return m, cmd
}

func (m promptModel) handlePromptKey( //nolint:ireturn
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) {
	switch msg.Type { //nolint:exhaustive
	case tea.KeyEnter:
		m.submitted = true

		return m, tea.Quit
	case tea.KeyCtrlC, tea.KeyEsc:
		m.cancelled = true

		return m, tea.Quit
	default:
		var cmd tea.Cmd

		m.input, cmd = m.input.Update(msg)

		return m, cmd
	}
}

func (m promptModel) View() string {
	return fmt.Sprintf(
		"\n  %s %s\n  %s\n",
		sectionTitle.Render(m.label),
		helpStyle.Render("("+m.defaultValue+")"),
		m.input.View(),
	)
}

func (m promptModel) Value() string {
	v := m.input.Value()
	if v == "" {
		return m.defaultValue
	}

	return v
}

// RunPrompt shows a text input prompt and returns the entered value.
// If the user presses enter without typing, defaultValue is returned.
func RunPrompt(label, defaultValue string) (string, error) {
	m := newPromptModel(label, defaultValue)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return "", fmt.Errorf("prompt error: %w", err)
	}

	fm, ok := finalModel.(promptModel)
	if !ok || fm.cancelled {
		return "", ErrPickerCancelled
	}

	return fm.Value(), nil
}
