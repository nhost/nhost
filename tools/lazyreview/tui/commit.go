package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type CommitModel struct {
	Visible bool
	Message string
	Cursor  int
}

func NewCommitModel() CommitModel {
	return CommitModel{
		Visible: false,
		Message: "",
		Cursor:  0,
	}
}

func (m *CommitModel) Open() {
	m.Visible = true
	m.Message = ""
	m.Cursor = 0
}

func (m *CommitModel) Close() {
	m.Visible = false
	m.Message = ""
	m.Cursor = 0
}

type commitCancelMsg struct{}

type commitSubmitMsg struct {
	Message string
}

func (m *CommitModel) Update(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "esc":
		m.Close()

		return func() tea.Msg { return commitCancelMsg{} }

	case "enter":
		return m.submit()

	default:
		m.handleEditKey(msg.String())
	}

	return nil
}

func (m *CommitModel) submit() tea.Cmd {
	message := strings.TrimSpace(m.Message)
	if message == "" {
		return nil
	}

	m.Close()

	return func() tea.Msg { return commitSubmitMsg{Message: message} }
}

func (m *CommitModel) handleEditKey(key string) {
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
		m.Cursor = 0
	case keyEnd, "ctrl+e":
		m.Cursor = len([]rune(m.Message))
	case "ctrl+u":
		runes := []rune(m.Message)
		m.Message = string(runes[m.Cursor:])
		m.Cursor = 0
	default:
		m.insertChar(key)
	}
}

func (m *CommitModel) deleteBack() {
	if m.Cursor > 0 {
		runes := []rune(m.Message)
		m.Message = string(runes[:m.Cursor-1]) + string(runes[m.Cursor:])
		m.Cursor--
	}
}

func (m *CommitModel) deleteForward() {
	runes := []rune(m.Message)
	if m.Cursor < len(runes) {
		m.Message = string(runes[:m.Cursor]) + string(runes[m.Cursor+1:])
	}
}

func (m *CommitModel) moveCursorLeft() {
	if m.Cursor > 0 {
		m.Cursor--
	}
}

func (m *CommitModel) moveCursorRight() {
	if m.Cursor < len([]rune(m.Message)) {
		m.Cursor++
	}
}

func (m *CommitModel) insertChar(key string) {
	runes := []rune(key)
	if len(runes) == 1 && runes[0] >= ' ' {
		msgRunes := []rune(m.Message)
		m.Message = string(msgRunes[:m.Cursor]) + key + string(msgRunes[m.Cursor:])
		m.Cursor++
	}
}

func (m *CommitModel) View(width, height int) string {
	if !m.Visible {
		return ""
	}

	promptStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("6"))
	inputStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("15"))

	prompt := promptStyle.Render("Commit message:")

	// render the input with cursor
	runes := []rune(m.Message)
	before := string(runes[:m.Cursor])
	afterRunes := runes[m.Cursor:]

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
