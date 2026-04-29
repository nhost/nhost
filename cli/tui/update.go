package tui

import (
	"context"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.searching {
			return m.handleSearchKey(msg)
		}

		return m.handleKey(msg)
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		return m, nil
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	case tickMsg:
		return m, tickCmd()
	default:
		return m.handleDataMsg(msg)
	}
}

func (m Model) handleDataMsg(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn,cyclop
	switch msg := msg.(type) {
	case phaseStartMsg:
		m.phases = append(m.phases, Phase{
			Name: msg.name, Status: StatusRunning, Err: nil, Detail: "",
		})
	case phaseEndMsg:
		if idx := m.lastRunning(); idx >= 0 {
			m.phases[idx].Status = StatusDone
			m.phases[idx].Detail = msg.detail
		}
	case phaseFailMsg:
		if idx := m.lastRunning(); idx >= 0 {
			m.phases[idx].Status = StatusFailed
			m.phases[idx].Err = msg.err
		}
	case phaseSkipMsg:
		m.phases = append(m.phases, Phase{
			Name: msg.name, Status: StatusSkipped, Err: nil,
		})
	case serviceStatusMsg:
		m.services = msg.services
	case logLineMsg:
		m.logs = appendLog(m.logs, msg)
	case completeMsg:
		m.state = stateDashboard
	case restartDoneMsg:
		m.state = stateDashboard
	case stoppedMsg:
		return m, tea.Quit
	case errMsg:
		m.err = msg.err

		return m, tea.Quit
	}

	return m, nil
}

func (m Model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) { //nolint:ireturn,cyclop
	switch {
	case msg.Type == tea.KeyCtrlC || msg.String() == "q":
		if m.state == stateStopping {
			return m, nil
		}

		m.cancel()

		return m, tea.Quit

	case msg.String() == "r":
		if m.state != stateDashboard {
			return m, nil
		}

		m.state = stateRestarting

		return m, m.restartCmd()

	case msg.String() == "d":
		if m.state != stateDashboard {
			return m, nil
		}

		m.state = stateStopping
		m.cancel()

		return m, m.stopCmd()

	case msg.String() == "up" || msg.String() == "k":
		m.logOffset++

		return m, nil

	case msg.String() == "down" || msg.String() == "j":
		if m.logOffset > 0 {
			m.logOffset--
		}

		return m, nil

	case msg.String() == "tab":
		m.logFilter = m.nextFilter()
		m.logOffset = 0

		return m, nil

	case msg.String() == "esc":
		m.logFilter = ""
		m.logSearch = ""
		m.logOffset = 0

		return m, nil

	case msg.String() == "/":
		if m.state != stateDashboard {
			return m, nil
		}

		m.searching = true
		m.searchInput.Reset()
		m.searchInput.Focus()

		return m, textinput.Blink
	}

	return m, nil
}

func (m Model) handleSearchKey( //nolint:ireturn
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEnter:
		m.logSearch = m.searchInput.Value()
		m.searching = false
		m.logOffset = 0

		return m, nil
	case tea.KeyEsc:
		m.searching = false
		m.logSearch = ""
		m.logOffset = 0

		return m, nil
	default:
		var cmd tea.Cmd

		m.searchInput, cmd = m.searchInput.Update(msg)
		m.logSearch = m.searchInput.Value()
		m.logOffset = 0

		return m, cmd
	}
}

func appendLog(logs []LogEntry, msg logLineMsg) []LogEntry {
	logs = append(logs, LogEntry{
		Service: msg.service,
		Text:    msg.text,
	})
	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}

	return logs
}

func (m Model) nextFilter() string {
	names := m.serviceNames()
	if len(names) == 0 {
		return ""
	}

	if m.logFilter == "" {
		return names[0]
	}

	for i, name := range names {
		if name == m.logFilter && i+1 < len(names) {
			return names[i+1]
		}
	}

	return ""
}

func (m Model) serviceNames() []string {
	names := make([]string, 0, len(m.services))
	for _, s := range m.services {
		names = append(names, s.Service)
	}

	return names
}

func (m Model) lastRunning() int {
	for i := len(m.phases) - 1; i >= 0; i-- {
		if m.phases[i].Status == StatusRunning {
			return i
		}
	}

	return -1
}

func (m Model) restartCmd() tea.Cmd {
	dc := m.config.DC

	return func() tea.Msg {
		ctx := context.Background()

		err := dc.Wrapper(ctx, "restart")

		return restartDoneMsg{err: err}
	}
}

func (m Model) stopCmd() tea.Cmd {
	return func() tea.Msg {
		return stoppedMsg{err: nil}
	}
}
