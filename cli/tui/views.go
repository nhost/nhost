package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

func (m Model) View() string {
	switch m.state {
	case stateStartup:
		return m.viewStartup()
	case stateDashboard:
		return m.viewDashboard()
	case stateRestarting:
		return m.viewRestarting()
	case stateStopping:
		return m.viewStopping()
	default:
		return ""
	}
}

func (m Model) viewStartup() string {
	var b strings.Builder

	b.WriteString(m.viewHeader("starting"))
	b.WriteString("\n")
	b.WriteString(m.viewPhases())

	if len(m.services) > 0 {
		b.WriteString("\n")
		b.WriteString(m.viewServices())
	}

	b.WriteString("\n")
	b.WriteString(viewBusyHelp())

	return b.String()
}

// viewBusyHelp renders the footer shown while startup/restart work is in
// flight. Quitting is disabled during this phase, so only Ctrl+C (a clean
// abort) is offered.
func viewBusyHelp() string {
	return "  " + helpKey.Render("ctrl+c") + " " + helpStyle.Render("cancel")
}

func (m Model) viewDashboard() string {
	var b strings.Builder

	b.WriteString(m.viewHeader(""))
	b.WriteString("\n\n")
	b.WriteString(m.viewSDK())
	b.WriteString("\n")
	b.WriteString(m.viewServices())
	b.WriteString("\n")
	b.WriteString(m.viewLogs())
	b.WriteString("\n")

	if m.searching {
		b.WriteString("  / " + m.searchInput.View())
	} else {
		b.WriteString(m.viewHelp())
	}

	return b.String()
}

func (m Model) viewRestarting() string {
	var b strings.Builder

	b.WriteString(m.viewHeader("restarting"))
	b.WriteString("\n\n")
	b.WriteString(m.viewSDK())
	b.WriteString("\n")
	b.WriteString(m.viewServices())
	b.WriteString("\n  " + m.spinner.View() + " Restarting services...\n")
	b.WriteString("\n")
	b.WriteString(viewBusyHelp())

	return b.String()
}

func (m Model) viewStopping() string {
	return m.viewHeader("") + "\n\n  " +
		m.spinner.View() + " Stopping services...\n"
}

func (m Model) viewHeader(status string) string {
	uptime := formatUptime(time.Since(m.startTime))
	title := headerStyle.Render(" nhost dev")

	name := ""
	if m.config.ProjectName != "" {
		name = " \u00b7 " + m.config.ProjectName
	}

	extra := ""
	if status != "" {
		extra = " \u00b7 " + status
	}

	right := uptimeStyle.Render(uptime)

	left := title + uptimeStyle.Render(name+extra)
	pad := max(1, m.width-lipglossWidth(left)-lipglossWidth(right)-1)

	return left + strings.Repeat(" ", pad) + right
}

func (m Model) viewPhases() string {
	var b strings.Builder

	b.WriteString(sectionTitle.Render("  Setup") + "\n")

	for _, phase := range m.phases {
		b.WriteString(renderPhase(phase, m.spinner.View()))
		b.WriteString("\n")

		if phase.Detail != "" {
			b.WriteString(renderPhaseDetail(phase.Detail))
		}
	}

	return b.String()
}

func renderPhaseDetail(detail string) string {
	var b strings.Builder

	for line := range strings.SplitSeq(strings.TrimRight(detail, "\n"), "\n") {
		b.WriteString("      " + logDim.Render(line) + "\n")
	}

	return b.String()
}

func renderPhase(p Phase, spinView string) string {
	switch p.Status {
	case StatusDone:
		return "    " + phaseCheck + " " + p.Name
	case StatusFailed:
		return "    " + phaseCross + " " + p.Name
	case StatusRunning:
		return "    " + spinView + " " + p.Name
	case StatusSkipped:
		return "    " + phaseSkip + " " +
			phasePending.Render(p.Name+" (skipped)")
	case StatusPending:
		return "      " + phasePending.Render(p.Name)
	}

	return "      " + phasePending.Render(p.Name)
}

func (m Model) viewServices() string {
	var b strings.Builder

	core, infra := m.splitServices()

	b.WriteString(sectionTitle.Render("  Services") + "\n")

	for _, svc := range core {
		b.WriteString(m.renderService(svc))
		b.WriteString("\n")
	}

	if m.config.MCP.Configured {
		b.WriteString("\n")
		b.WriteString(m.viewMCP())
	}

	if len(infra) > 0 {
		b.WriteString("\n")
		b.WriteString(subsectionTitle.Render("  Infrastructure") + "\n")

		for _, svc := range infra {
			b.WriteString(m.renderServiceCompact(svc))
			b.WriteString("\n")
		}
	}

	return b.String()
}

func (m Model) viewMCP() string {
	projects := strings.Join(m.config.MCP.Projects, ", ")
	if projects == "" {
		projects = "no projects"
	}

	return subsectionTitle.Render(fmt.Sprintf(
		"  MCP  configured \u00b7 projects: %s \u00b7 use `nhost mcp start`",
		projects,
	)) + "\n"
}

func (m Model) viewSDK() string {
	return subsectionTitle.Render(fmt.Sprintf(
		"  SDK  subdomain: %s  region: local",
		m.config.Subdomain,
	)) + "\n"
}

func (m Model) splitServices() (
	[]dockercompose.ServiceStatus,
	[]dockercompose.ServiceStatus,
) {
	return dockercompose.GroupServices(m.services)
}

func (m Model) renderServiceCompact(
	svc dockercompose.ServiceStatus,
) string {
	dot, status := serviceIndicator(svc)
	name := padRight(logDim.Render(svc.Service), colName)
	stat := padRight(status, colStatus)
	ver := padRight("", colVersion)
	svcURL := m.serviceURL(svc.Service)

	line := fmt.Sprintf("    %s %s %s %s", dot, name, stat, ver)

	if svcURL != "" {
		line += " " + urlStyle.Render(svcURL)
	}

	return line
}

const (
	colName    = 14
	colStatus  = 10
	colVersion = 20
)

func (m Model) renderService(svc dockercompose.ServiceStatus) string {
	dot, status := serviceIndicator(svc)
	name := padRight(svc.Service, colName)
	stat := padRight(status, colStatus)
	ver := m.renderVersion(svc.Service)
	svcURL := m.serviceURL(svc.Service)

	line := fmt.Sprintf("    %s %s %s %s", dot, name, stat, ver)

	if svcURL != "" {
		line += " " + urlStyle.Render(svcURL)
	}

	return line
}

func (m Model) renderVersion(service string) string {
	v, ok := m.config.Versions[service]
	if !ok {
		return padRight("", colVersion)
	}

	if v.OK {
		return padRight(logDim.Render(v.Current), colVersion)
	}

	return padRight(
		statusStarting.Render(v.Current+" \u2192 "+v.Recommended),
		colVersion,
	)
}

func padRight(s string, width int) string {
	visible := lipgloss.Width(s)
	if visible >= width {
		return s
	}

	return s + strings.Repeat(" ", width-visible)
}

func serviceIndicator(
	svc dockercompose.ServiceStatus,
) (string, string) {
	switch {
	case svc.Health == "healthy":
		return dotHealthy, statusHealthy.Render("healthy")
	case svc.Health == "starting":
		return dotStarting, statusStarting.Render("starting")
	case svc.Health == "unhealthy":
		return dotFailed, statusFailed.Render("unhealthy")
	case svc.State == "running":
		return dotHealthy, statusHealthy.Render("running")
	case svc.State == "exited":
		return dotFailed, statusFailed.Render("exited")
	case svc.State == "created":
		return dotWaiting, statusWaiting.Render("created")
	default:
		return dotWaiting, statusWaiting.Render(svc.State)
	}
}

func (m Model) serviceURL(name string) string {
	return dockercompose.LocalServiceURL(
		m.config.Subdomain,
		name,
		m.config.HTTPPort,
		m.config.PostgresPort,
		m.config.UseTLS,
	)
}

func (m Model) viewLogs() string {
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
	available := m.logViewHeight()

	if available < 1 {
		return b.String()
	}

	for _, line := range emitLogWindow(filtered, available, m.logOffset) {
		b.WriteString(line + "\n")
	}

	return b.String()
}

func (m Model) maxLogOffset() int {
	filtered := m.filteredLogs()
	total := countLines(filtered)
	visible := m.logViewHeight()

	if total <= visible {
		return 0
	}

	return total - visible
}

// renderEntryLines wraps and prefixes a single entry's text into one or more
// display lines for the given terminal width.
func renderEntryLines(termWidth int, service, text string) []string {
	prefixWidth := 4 + colName + 1 + 1 + 1      // "    " + svc + " " + sep + " "
	wrapWidth := max(termWidth-prefixWidth, 20) //nolint:mnd

	svc := logService.Render(service)
	wrapped := wrapText(text, wrapWidth)
	out := make([]string, 0, len(wrapped))

	for j, line := range wrapped {
		if j == 0 {
			out = append(out, "    "+svc+" "+logSep+" "+line)
		} else {
			out = append(out,
				"    "+padRight("", colName)+" "+logSep+" "+line)
		}
	}

	return out
}

// ensureRendered fills in the entry's cached lines for the given width.
// No-op if the cache is already valid.
func (e *LogEntry) ensureRendered(termWidth int) {
	if e.width == termWidth && e.lines != nil {
		return
	}

	e.width = termWidth
	e.lines = renderEntryLines(termWidth, e.Service, e.Text)
}

// invalidateRender drops the cached lines so the next ensureRendered re-wraps.
func (e *LogEntry) invalidateRender() {
	e.lines = nil
	e.width = 0
}

// countLines sums cached line counts across entries.
func countLines(entries []LogEntry) int {
	total := 0
	for i := range entries {
		total += len(entries[i].lines)
	}

	return total
}

// emitLogWindow returns the rendered lines for the visible window only.
// Walks entries in order, accumulating line counts, and only copies lines
// whose flat index falls in [start, end), where the window is determined
// by total line count and the user's scroll offset.
func emitLogWindow(entries []LogEntry, available, offset int) []string {
	total := countLines(entries)
	if total == 0 || available < 1 {
		return nil
	}

	start, end := logWindow(total, available, offset)

	out := make([]string, 0, end-start)

	cumulative := 0
	for i := range entries {
		entryLen := len(entries[i].lines)
		entryEnd := cumulative + entryLen

		if entryEnd <= start {
			cumulative = entryEnd

			continue
		}

		if cumulative >= end {
			break
		}

		from := 0
		if cumulative < start {
			from = start - cumulative
		}

		to := entryLen
		if entryEnd > end {
			to = end - cumulative
		}

		out = append(out, entries[i].lines[from:to]...)
		cumulative = entryEnd
	}

	return out
}

func wrapText(s string, width int) []string {
	if width <= 0 {
		return []string{s}
	}

	wrapped := lipgloss.NewStyle().Width(width).Render(s)

	return strings.Split(wrapped, "\n")
}

func (m Model) filteredLogs() []LogEntry {
	return filterLogs(m.logs, m.logFilter, m.logSearch)
}

// filterLogs returns the subset of logs matching the given service filter
// and free-text search. An empty filter or search disables that check.
func filterLogs(logs []LogEntry, filter, search string) []LogEntry {
	if filter == "" && search == "" {
		return logs
	}

	filtered := make([]LogEntry, 0, len(logs))
	lowerSearch := strings.ToLower(search)

	for _, entry := range logs {
		if filter != "" && entry.Service != filter {
			continue
		}

		if lowerSearch != "" &&
			!strings.Contains(strings.ToLower(entry.Text), lowerSearch) &&
			!strings.Contains(strings.ToLower(entry.Service), lowerSearch) {
			continue
		}

		filtered = append(filtered, entry)
	}

	return filtered
}

// logServiceNames extracts unique service names from log entries in arrival
// order.
func logServiceNames(logs []LogEntry) []string {
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

// nextLogFilter cycles to the next service in `names`. An empty current
// jumps to the first; an exhausted list returns "" (no filter).
func nextLogFilter(names []string, current string) string {
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

func (m Model) logViewHeight() int {
	// header(2) + services title(1) + core + infra header(1) + infra + sdk(1)
	// + logtitle(1) + help(2) + padding(2)
	_, infra := m.splitServices()
	infraLines := len(infra)

	if infraLines > 0 {
		infraLines++ // "Infrastructure" header
	}

	overhead := 2 + 1 + len(m.services) - len(infra) + infraLines + 1 + 1 + 2 + 2 //nolint:mnd

	return max(3, m.height-overhead) //nolint:mnd
}

func logWindow(total, visible, offset int) (int, int) {
	if total <= visible {
		return 0, total
	}

	end := min(total, max(visible, total-offset))
	start := max(0, end-visible)

	return start, end
}

func (m Model) viewHelp() string {
	keys := []struct{ key, desc string }{
		{"q", "quit"},
		{"r", "restart"},
		{"d", "down"},
		{"\u2191\u2193", "scroll"},
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

func formatUptime(d time.Duration) string {
	switch {
	case d < time.Minute:
		return fmt.Sprintf("\u2191%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf(
			"\u2191%dm%02ds",
			int(d.Minutes()), int(d.Seconds())%60, //nolint:mnd
		)
	default:
		return fmt.Sprintf(
			"\u2191%dh%02dm",
			int(d.Hours()), int(d.Minutes())%60, //nolint:mnd
		)
	}
}

func lipglossWidth(s string) int {
	return lipgloss.Width(s)
}
