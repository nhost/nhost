package tui

import (
	"bufio"
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

// LogViewer is a standalone Bubble Tea model for viewing logs interactively.
type LogViewer struct {
	logs      []LogEntry
	logOffset int
	logFilter string
	width     int
	height    int
	title     string
	spinner   spinner.Model
	cancel    context.CancelFunc
}

func newLogViewer(title string, cancel context.CancelFunc) LogViewer {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	return LogViewer{
		logs:      make([]LogEntry, 0, maxLogLines),
		logOffset: 0,
		logFilter: "",
		width:     80, //nolint:mnd
		height:    24, //nolint:mnd
		title:     title,
		spinner:   s,
		cancel:    cancel,
	}
}

func (m LogViewer) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m LogViewer) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleLogViewerKey(msg)
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		return m, nil
	case logLineMsg:
		m.logs = appendLog(m.logs, msg)

		return m, nil
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	}

	return m, nil
}

func (m LogViewer) handleLogViewerKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch {
	case msg.Type == tea.KeyCtrlC || msg.String() == "q":
		m.cancel()

		return m, tea.Quit
	case msg.String() == "up" || msg.String() == "k":
		m.logOffset++

		return m, nil
	case msg.String() == "down" || msg.String() == "j":
		if m.logOffset > 0 {
			m.logOffset--
		}

		return m, nil
	case msg.String() == "tab":
		m.logFilter = logViewerNextFilter(m.logs, m.logFilter)
		m.logOffset = 0

		return m, nil
	case msg.String() == "esc":
		m.logFilter = ""
		m.logOffset = 0

		return m, nil
	}

	return m, nil
}

func (m LogViewer) View() string {
	var b strings.Builder

	b.WriteString(m.viewLogViewerHeader())
	b.WriteString("\n")
	b.WriteString(m.viewLogViewerLogs())
	b.WriteString("\n")
	b.WriteString(m.viewLogViewerHelp())

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
	b.WriteString(title + filter + "\n")

	filtered := logViewerFiltered(m.logs, m.logFilter)
	available := m.logViewerHeight()

	if available < 1 {
		return b.String()
	}

	start, end := logWindow(len(filtered), available, m.logOffset)

	for i := start; i < end; i++ {
		entry := filtered[i]
		svc := logService.Render(entry.Service)
		b.WriteString("    " + svc + " " + logSep + " " + entry.Text + "\n")
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
		{"tab", "filter"},
		{"esc", "clear"},
	}

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts,
			helpKey.Render(k.key)+" "+helpStyle.Render(k.desc))
	}

	return "  " + strings.Join(parts, helpStyle.Render(" \u00b7 "))
}

func logViewerFiltered(logs []LogEntry, filter string) []LogEntry {
	if filter == "" {
		return logs
	}

	filtered := make([]LogEntry, 0, len(logs))

	for _, entry := range logs {
		if entry.Service == filter {
			filtered = append(filtered, entry)
		}
	}

	return filtered
}

func logViewerNextFilter(logs []LogEntry, current string) string {
	names := logViewerServiceNames(logs)
	if len(names) == 0 {
		return ""
	}

	if current == "" {
		return names[0]
	}

	for i, name := range names {
		if name == current && i+1 < len(names) {
			return names[i+1]
		}
	}

	return ""
}

func logViewerServiceNames(logs []LogEntry) []string {
	seen := make(map[string]bool)
	names := make([]string, 0)

	for _, entry := range logs {
		if !seen[entry.Service] {
			seen[entry.Service] = true
			names = append(names, entry.Service)
		}
	}

	return names
}

func startLogViewerStream(
	ctx context.Context,
	p *tea.Program,
	dc *dockercompose.DockerCompose,
) {
	reader, err := dc.LogStream(ctx, logStreamTail)
	if err != nil {
		return
	}
	defer reader.Close()

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return
		}

		service, text := parseLogLine(scanner.Text())
		p.Send(logLineMsg{service: service, text: text})
	}
}

// RunLogViewer starts the interactive log viewer TUI.
func RunLogViewer(
	ctx context.Context,
	dc *dockercompose.DockerCompose,
	title string,
) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	m := newLogViewer(title, cancel)
	p := tea.NewProgram(m, tea.WithAltScreen())

	go startLogViewerStream(ctx, p, dc)

	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("log viewer TUI error: %w", err)
	}

	if fm, ok := finalModel.(LogViewer); ok && fm.cancel != nil {
		_ = fm // no error to extract
	}

	return nil
}
