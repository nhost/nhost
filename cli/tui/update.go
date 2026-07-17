package tui

import (
	"context"
	"slices"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

const (
	keyDown = "down"
	keyEsc  = "esc"
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

		for i := range m.logs {
			m.logs[i].invalidateRender()
			m.logs[i].ensureRendered(m.width)
		}

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

func (m Model) handleDataMsg(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
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
			Name: msg.name, Status: StatusSkipped, Err: nil, Detail: "",
		})
	case serviceStatusMsg:
		m.services = msg.services
	case logBatchMsg:
		before := countLines(m.filteredLogs())
		m.logs = appendLogBatch(m.logs, msg.entries, m.width)

		if m.logOffset > 0 {
			after := countLines(m.filteredLogs())
			m.logOffset = min(m.logOffset+(after-before), m.maxLogOffset())
		}
	case completeMsg, restartDoneMsg:
		// Ignore a late completion once an abort/teardown is under way, so it
		// can't flip us back to the dashboard mid-shutdown.
		if m.state != stateStopping {
			m.state = stateDashboard
		}
	case stoppedMsg:
		m.err = msg.err
		m.cancel()

		return m, tea.Quit
	case errMsg:
		m.err = msg.err

		return m, tea.Quit
	}

	return m, nil
}

func (m Model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) { //nolint:ireturn,cyclop,funlen
	switch {
	case msg.Type == tea.KeyCtrlC:
		return m.handleInterrupt()

	case msg.String() == "q":
		// Detaching only makes sense once the environment is up. While
		// startup/restart/teardown work is in flight, quitting would abandon
		// it mid-run and leave containers half-created, so ignore "q" and let
		// Ctrl+C be the escape hatch.
		if m.state != stateDashboard {
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

		return m, m.stopCmd()

	case msg.String() == "up" || msg.String() == "k":
		if m.logOffset < m.maxLogOffset() {
			m.logOffset++
		}

		return m, nil

	case msg.String() == keyDown || msg.String() == "j":
		if m.logOffset > 0 {
			m.logOffset--
		}

		return m, nil

	case msg.String() == "pgup":
		m.logOffset = min(m.logOffset+m.logViewHeight(), m.maxLogOffset())

		return m, nil

	case msg.String() == "pgdown":
		m.logOffset = max(m.logOffset-m.logViewHeight(), 0)

		return m, nil

	case msg.String() == "g":
		m.logOffset = m.maxLogOffset()

		return m, nil

	case msg.String() == "G":
		m.logOffset = 0

		return m, nil

	case msg.String() == "tab":
		m.logFilter = m.nextFilter()
		m.logOffset = 0

		return m, nil

	case msg.String() == keyEsc:
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

// handleInterrupt handles Ctrl+C. While startup/restart work is in flight it
// aborts cleanly: the running operation is cancelled (so docker compose stops)
// and whatever was half-created is torn down before the TUI exits. Once the
// environment is up, Ctrl+C detaches like "q".
func (m Model) handleInterrupt() (tea.Model, tea.Cmd) { //nolint:ireturn
	switch m.state { //nolint:exhaustive
	case stateStopping:
		// Teardown already running; ignore further interrupts.
		return m, nil
	case stateStartup, stateRestarting:
		m.cancel()
		m.state = stateStopping

		return m, m.abortCmd()
	default:
		// Dashboard: detach and leave the environment running.
		m.cancel()

		return m, tea.Quit
	}
}

func (m Model) abortCmd() tea.Cmd {
	dc := m.config.DC

	return func() tea.Msg {
		// The in-flight context was just cancelled, so use a fresh one to tear
		// down the partially-started environment.
		ctx, cancel := context.WithTimeout(context.Background(), stopTimeout)
		defer cancel()

		return stoppedMsg{err: dc.Stop(ctx, false)}
	}
}

func (m Model) handleSearchKey( //nolint:ireturn
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) {
	switch msg.Type { //nolint:exhaustive
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

func appendLogBatch(logs []LogEntry, entries []LogEntry, width int) []LogEntry {
	for _, e := range entries {
		logs = append(logs, e)
		logs[len(logs)-1].ensureRendered(width)
	}

	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}

	return logs
}

func (m Model) nextFilter() string {
	return nextLogFilter(m.serviceNames(), m.logFilter)
}

func (m Model) serviceNames() []string {
	names := make([]string, 0, len(m.services))
	for _, s := range m.services {
		names = append(names, s.Service)
	}

	return names
}

func (m Model) lastRunning() int {
	for i, v := range slices.Backward(m.phases) {
		if v.Status == StatusRunning {
			return i
		}
	}

	return -1
}

func (m Model) restartCmd() tea.Cmd {
	ctx := m.ctx
	dc := m.config.DC

	return func() tea.Msg {
		err := dc.Wrapper(ctx, "restart")

		return restartDoneMsg{err: err}
	}
}

func (m Model) stopCmd() tea.Cmd {
	ctx := m.ctx
	dc := m.config.DC

	return func() tea.Msg {
		err := dc.Stop(ctx, false)

		return stoppedMsg{err: err}
	}
}
