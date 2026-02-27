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

func (m *CommitModel) Update(msg tea.KeyMsg) tea.Cmd { //nolint:cyclop
	switch msg.String() {
	case "esc":
		m.Close()

		return func() tea.Msg { return commitCancelMsg{} }

	case "enter":
		message := strings.TrimSpace(m.Message)
		if message == "" {
			return nil
		}

		m.Close()

		return func() tea.Msg { return commitSubmitMsg{Message: message} }

	case "backspace":
		if m.Cursor > 0 {
			m.Message = m.Message[:m.Cursor-1] + m.Message[m.Cursor:]
			m.Cursor--
		}

	case "delete":
		if m.Cursor < len(m.Message) {
			m.Message = m.Message[:m.Cursor] + m.Message[m.Cursor+1:]
		}

	case "left":
		if m.Cursor > 0 {
			m.Cursor--
		}

	case "right":
		if m.Cursor < len(m.Message) {
			m.Cursor++
		}

	case "home", "ctrl+a":
		m.Cursor = 0

	case "end", "ctrl+e":
		m.Cursor = len(m.Message)

	case "ctrl+u":
		m.Message = m.Message[m.Cursor:]
		m.Cursor = 0

	default:
		// ignore control sequences, only accept printable runes
		r := msg.String()
		if len(r) == 1 && r[0] >= ' ' {
			m.Message = m.Message[:m.Cursor] + r + m.Message[m.Cursor:]
			m.Cursor++
		}
	}

	return nil
}

func (m *CommitModel) View(width, height int) string {
	if !m.Visible {
		return ""
	}

	promptStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("6"))
	inputStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("15"))

	prompt := promptStyle.Render("Commit message:")

	// render the input with cursor
	before := m.Message[:m.Cursor]
	after := m.Message[m.Cursor:]

	cursorChar := " "
	if len(after) > 0 {
		cursorChar = string(after[0])
		after = after[1:]
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
