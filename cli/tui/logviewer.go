package tui

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

// LogViewer is a standalone Bubble Tea model for viewing logs interactively.
type LogViewer struct {
	logs        []LogEntry
	logOffset   int
	logFilter   string
	logSearch   string
	searching   bool
	searchInput textinput.Model
	width       int
	height      int
	title       string
	spinner     spinner.Model
	cancel      context.CancelFunc
}

func newLogViewer(title, initialFilter string, cancel context.CancelFunc) LogViewer {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	ti := textinput.New()
	ti.Prompt = ""
	ti.CharLimit = 64 //nolint:mnd
	ti.Width = 40     //nolint:mnd

	return LogViewer{
		logs:        make([]LogEntry, 0, maxLogLines),
		logOffset:   0,
		logFilter:   initialFilter,
		logSearch:   "",
		searching:   false,
		searchInput: ti,
		width:       80, //nolint:mnd
		height:      24, //nolint:mnd
		title:       title,
		spinner:     s,
		cancel:      cancel,
	}
}

func (m LogViewer) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, tickCmd())
}

func (m LogViewer) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.searching {
			return m.handleLogViewerSearchKey(msg)
		}

		return m.handleLogViewerKey(msg)
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		for i := range m.logs {
			m.logs[i].invalidateRender()
			m.logs[i].ensureRendered(m.width)
		}

		return m, nil
	case logBatchMsg:
		before := countLines(filterLogs(m.logs, m.logFilter, m.logSearch))
		m.logs = appendLogBatch(m.logs, msg.entries, m.width)

		if m.logOffset > 0 {
			after := countLines(filterLogs(m.logs, m.logFilter, m.logSearch))
			m.logOffset = min(m.logOffset+(after-before), m.maxLogOffset())
		}

		return m, nil
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	case tickMsg:
		return m, tickCmd()
	}

	return m, nil
}

func (m LogViewer) handleLogViewerKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) { //nolint:ireturn,cyclop
	maxOffset := m.maxLogOffset()

	switch {
	case msg.Type == tea.KeyCtrlC || msg.String() == "q":
		m.cancel()

		return m, tea.Quit
	case msg.String() == "up" || msg.String() == "k":
		if m.logOffset < maxOffset {
			m.logOffset++
		}

		return m, nil
	case msg.String() == "down" || msg.String() == "j":
		if m.logOffset > 0 {
			m.logOffset--
		}

		return m, nil
	case msg.String() == "pgup":
		m.logOffset = min(m.logOffset+m.logViewerHeight(), maxOffset)

		return m, nil
	case msg.String() == "pgdown":
		m.logOffset = max(m.logOffset-m.logViewerHeight(), 0)

		return m, nil
	case msg.String() == "g":
		m.logOffset = maxOffset

		return m, nil
	case msg.String() == "G":
		m.logOffset = 0

		return m, nil
	case msg.String() == "tab":
		m.logFilter = nextLogFilter(logServiceNames(m.logs), m.logFilter)
		m.logOffset = 0

		return m, nil
	case msg.String() == "esc":
		m.logFilter = ""
		m.logSearch = ""
		m.logOffset = 0

		return m, nil
	case msg.String() == "/":
		m.searching = true
		m.searchInput.Reset()
		m.searchInput.Focus()

		return m, textinput.Blink
	}

	return m, nil
}

func (m LogViewer) handleLogViewerSearchKey( //nolint:ireturn
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

func (m LogViewer) filteredLogs() []LogEntry {
	return filterLogs(m.logs, m.logFilter, m.logSearch)
}

func (m LogViewer) maxLogOffset() int {
	total := countLines(m.filteredLogs())
	visible := m.logViewerHeight()

	if total <= visible {
		return 0
	}

	return total - visible
}

func (m LogViewer) View() string {
	var b strings.Builder

	b.WriteString(m.viewLogViewerHeader())
	b.WriteString("\n")
	b.WriteString(m.viewLogViewerLogs())
	b.WriteString("\n")

	if m.searching {
		b.WriteString("  / " + m.searchInput.View())
	} else {
		b.WriteString(m.viewLogViewerHelp())
	}

	return b.String()
}

func (m LogViewer) viewLogViewerHeader() string {
	left := headerStyle.Render(" " + m.title)
	status := " " + m.spinner.View() + " streaming"
	pad := max(1, m.width-lipglossWidth(left)-lipglossWidth(status)-1)

	return left + strings.Repeat(" ", pad) + uptimeStyle.Render(status)
}

func (m LogViewer) viewLogViewerLogs() string {
	var b strings.Builder

	filterLabel := "all"
	if m.logFilter != "" {
		filterLabel = m.logFilter
	}

	title := sectionTitle.Render("  Logs")
	filter := logDim.Render(" \u2500 " + filterLabel)

	if m.logSearch != "" && !m.searching {
		filter += logDim.Render(" \u2500 ") +
			statusStarting.Render("\"/"+m.logSearch+"\"")
	}

	b.WriteString(title + filter + "\n")

	filtered := m.filteredLogs()
	available := m.logViewerHeight()

	if available < 1 {
		return b.String()
	}

	for _, line := range emitLogWindow(filtered, available, m.logOffset) {
		b.WriteString(line + "\n")
	}

	return b.String()
}

func (m LogViewer) logViewerHeight() int {
	// header(2) + logtitle(1) + help(2) + padding(2)
	overhead := 7

	return max(3, m.height-overhead) //nolint:mnd
}

func (m LogViewer) viewLogViewerHelp() string {
	keys := []struct{ key, desc string }{
		{"q", "quit"},
		{"\u2191\u2193", "scroll"},
		{"g/G", "top/bottom"},
		{"tab", "filter"},
		{"/", "search"},
		{"esc", "clear"},
	}

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts,
			helpKey.Render(k.key)+" "+helpStyle.Render(k.desc))
	}

	return "  " + strings.Join(parts, helpStyle.Render(" \u00b7 "))
}

// RunLogViewer starts the interactive log viewer TUI. If filter is non-empty,
// only logs from that service are shown initially (user can clear with esc).
func RunLogViewer(
	ctx context.Context,
	dc *dockercompose.DockerCompose,
	title, filter string,
) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	m := newLogViewer(title, filter, cancel)
	p := tea.NewProgram(m, tea.WithAltScreen())

	go startLogStream(ctx, p, dc)

	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("log viewer TUI error: %w", err)
	}

	if fm, ok := finalModel.(LogViewer); ok && fm.cancel != nil {
		_ = fm // no error to extract
	}

	return nil
}
