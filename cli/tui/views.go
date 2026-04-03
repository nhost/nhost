package tui

import (
	"fmt"
	"sort"
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

	return b.String()
}

func (m Model) viewDashboard() string {
	var b strings.Builder

	b.WriteString(m.viewHeader(""))
	b.WriteString("\n")
	b.WriteString(m.viewServices())
	b.WriteString("\n")
	b.WriteString(m.viewLogs())
	b.WriteString("\n")
	b.WriteString(m.viewHelp())

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

//nolint:mnd
var corePriority = map[string]int{ //nolint:gochecknoglobals
	"postgres":  1,
	"graphql":   2,
	"auth":      3,
	"storage":   4,
	"functions": 5,
	"ai":        6,
	"dashboard": 7,
	"mailhog":   8,
}

var infraServices = map[string]bool{ //nolint:gochecknoglobals
	"console":      true,
	"configserver": true,
	"minio":        true,
	"traefik":      true,
}

func (m Model) viewServices() string {
	var b strings.Builder

	core, infra := m.splitServices()

	b.WriteString(sectionTitle.Render("  Services") + "\n")

	for _, svc := range core {
		b.WriteString(m.renderService(svc))
		b.WriteString("\n")
	}

	b.WriteString(m.viewSDK())

	if len(infra) > 0 {
		b.WriteString(subsectionTitle.Render("  Infrastructure") + "\n")

		for _, svc := range infra {
			b.WriteString(m.renderServiceCompact(svc))
			b.WriteString("\n")
		}
	}

	return b.String()
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
	var core, infra []dockercompose.ServiceStatus

	for _, svc := range m.services {
		if infraServices[svc.Service] {
			infra = append(infra, svc)
		} else {
			core = append(core, svc)
		}
	}

	sort.Slice(core, func(i, j int) bool {
		return corePriority[core[i].Service] < corePriority[core[j].Service]
	})

	return core, infra
}

func (m Model) renderServiceCompact(
	svc dockercompose.ServiceStatus,
) string {
	dot, status := serviceIndicator(svc)

	return fmt.Sprintf("    %s %s %s",
		dot, logDim.Render(fmt.Sprintf("%-14s", svc.Service)), status)
}

func (m Model) renderService(svc dockercompose.ServiceStatus) string {
	dot, status := serviceIndicator(svc)
	name := fmt.Sprintf("%-14s", svc.Service)
	statusStr := fmt.Sprintf("%-12s", status)
	svcURL := m.serviceURL(svc.Service)

	if svcURL != "" {
		return fmt.Sprintf("    %s %s %s %s",
			dot, name, statusStr, urlStyle.Render(svcURL))
	}

	return fmt.Sprintf("    %s %s %s", dot, name, statusStr)
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
	sub := m.config.Subdomain
	port := m.config.HTTPPort
	tls := m.config.UseTLS

	switch name {
	case "postgres":
		return fmt.Sprintf(
			"localhost:%d", m.config.PostgresPort)
	case "graphql":
		return dockercompose.URL(sub, "graphql", port, tls)
	case "auth":
		return dockercompose.URL(sub, "auth", port, tls)
	case "storage":
		return dockercompose.URL(sub, "storage", port, tls)
	case "functions":
		return dockercompose.URL(sub, "functions", port, tls)
	case "dashboard":
		return dockercompose.URL(sub, "dashboard", port, tls)
	case "hasura":
		return dockercompose.URL(sub, "hasura", port, tls)
	case "mailhog":
		return dockercompose.URL(sub, "mailhog", port, tls)
	default:
		return ""
	}
}

func (m Model) viewLogs() string {
	var b strings.Builder

	filterLabel := "all"
	if m.logFilter != "" {
		filterLabel = m.logFilter
	}

	title := sectionTitle.Render("  Logs")
	filter := logDim.Render(" \u2500 " + filterLabel)
	b.WriteString(title + filter + "\n")

	filtered := m.filteredLogs()
	available := m.logViewHeight()

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

func (m Model) filteredLogs() []LogEntry {
	if m.logFilter == "" {
		return m.logs
	}

	filtered := make([]LogEntry, 0, len(m.logs))

	for _, entry := range m.logs {
		if entry.Service == m.logFilter {
			filtered = append(filtered, entry)
		}
	}

	return filtered
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
		{"d", "down"},
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
