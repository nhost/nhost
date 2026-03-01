package tui

import (
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

type commitModel struct {
	visible bool
	message string
	cursor  int
}

func newCommitModel() commitModel {
	return commitModel{
		visible: false,
		message: "",
		cursor:  0,
	}
}

func (m *commitModel) open() {
	m.visible = true
	m.message = ""
	m.cursor = 0
}

func (m *commitModel) close() {
	m.visible = false
	m.message = ""
	m.cursor = 0
}

type commitCancelMsg struct{}

type commitSubmitMsg struct {
	Message string
}

func (m *commitModel) update(msg tea.KeyPressMsg) tea.Cmd {
	switch msg.String() {
	case "esc":
		m.close()

		return func() tea.Msg { return commitCancelMsg{} }

	case "enter":
		return m.submit()

	default:
		m.handleEditKey(msg.String())
	}

	return nil
}

func (m *commitModel) submit() tea.Cmd {
	message := strings.TrimSpace(m.message)
	if message == "" {
		return nil
	}

	m.close()

	return func() tea.Msg { return commitSubmitMsg{Message: message} }
}

func (m *commitModel) handleEditKey(key string) {
	switch key {
	case "backspace":
		m.deleteBack()
	case "delete":
		m.deleteForward()
	case "left":
		m.moveCursorLeft()
	case "right":
		m.moveCursorRight()
	case keyHome, "ctrl+a":
		m.cursor = 0
	case keyEnd, "ctrl+e":
		m.cursor = len([]rune(m.message))
	case "ctrl+u":
		runes := []rune(m.message)
		m.message = string(runes[m.cursor:])
		m.cursor = 0
	default:
		m.insertChar(key)
	}
}

func (m *commitModel) deleteBack() {
	if m.cursor > 0 {
		runes := []rune(m.message)
		m.message = string(runes[:m.cursor-1]) + string(runes[m.cursor:])
		m.cursor--
	}
}

func (m *commitModel) deleteForward() {
	runes := []rune(m.message)
	if m.cursor < len(runes) {
		m.message = string(runes[:m.cursor]) + string(runes[m.cursor+1:])
	}
}

func (m *commitModel) moveCursorLeft() {
	if m.cursor > 0 {
		m.cursor--
	}
}

func (m *commitModel) moveCursorRight() {
	if m.cursor < len([]rune(m.message)) {
		m.cursor++
	}
}

func (m *commitModel) insertChar(key string) {
	runes := []rune(key)
	if len(runes) == 1 && runes[0] >= ' ' {
		msgRunes := []rune(m.message)
		m.message = string(msgRunes[:m.cursor]) + key + string(msgRunes[m.cursor:])
		m.cursor++
	}
}

func (m *commitModel) view(width, height int) string {
	if !m.visible {
		return ""
	}

	promptStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("6"))
	inputStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("15"))

	prompt := promptStyle.Render("Commit message:")

	// render the input with cursor
	runes := []rune(m.message)
	before := string(runes[:m.cursor])
	afterRunes := runes[m.cursor:]

	cursorChar := " "
	after := ""

	if len(afterRunes) > 0 {
		cursorChar = string(afterRunes[0])
		after = string(afterRunes[1:])
	}

	cursorStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("15")).
		Foreground(lipgloss.Color("0"))

	input := inputStyle.Render(before) +
		cursorStyle.Render(cursorChar) +
		inputStyle.Render(after)

	hint := contextStyle().Render("Enter to commit, Esc to cancel")

	content := prompt + "\n\n" + input + "\n\n" + hint

	overlay := commitOverlayStyle().Render(content)

	return lipgloss.Place(width, height,
		lipgloss.Center, lipgloss.Center,
		overlay,
	)
}
