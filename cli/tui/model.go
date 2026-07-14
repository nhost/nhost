package tui

import (
	"context"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

const (
	maxLogLines    = 1000
	pollInterval   = 2 * time.Second
	uptimeInterval = 1 * time.Second
	logBatchEvery  = 50 * time.Millisecond
	logBatchMax    = 200
)

type appState int

const (
	stateStartup appState = iota
	stateDashboard
	stateRestarting
	stateStopping
)

// Messages.
type (
	phaseStartMsg    struct{ name string }
	phaseEndMsg      struct{ detail string }
	phaseFailMsg     struct{ err error }
	phaseSkipMsg     struct{ name string }
	completeMsg      struct{ info string }
	errMsg           struct{ err error }
	serviceStatusMsg struct{ services []dockercompose.ServiceStatus }
	logBatchMsg      struct{ entries []LogEntry }
	tickMsg          time.Time
	stoppedMsg       struct{ err error }
	restartDoneMsg   struct{ err error }
)

type ServiceVersion struct {
	Current     string
	Recommended string
	OK          bool
}

type MCPStatus struct {
	Configured bool
	Projects   []string
}

type AppConfig struct {
	DC           *dockercompose.DockerCompose
	Subdomain    string
	HTTPPort     uint
	UseTLS       bool
	PostgresPort uint
	ProjectName  string
	Versions     map[string]ServiceVersion
	MCP          MCPStatus
}

type LogEntry struct {
	Service string
	Text    string

	// cached rendering for the current terminal width; invalidated on resize
	lines []string
	width int
}

type Model struct {
	state   appState
	phases  []Phase
	spinner spinner.Model

	services    []dockercompose.ServiceStatus
	logs        []LogEntry
	logOffset   int
	logFilter   string
	logSearch   string
	searching   bool
	searchInput textinput.Model

	config    AppConfig
	startTime time.Time
	width     int
	height    int

	err    error
	ctx    context.Context //nolint:containedctx // Bubble Tea commands need the app context after construction.
	cancel context.CancelFunc
}

func newModel(ctx context.Context, cfg AppConfig, cancel context.CancelFunc) Model {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	ti := textinput.New()
	ti.Placeholder = "search..."
	ti.CharLimit = 100

	return Model{
		state:       stateStartup,
		phases:      make([]Phase, 0),
		spinner:     s,
		services:    nil,
		logs:        make([]LogEntry, 0, maxLogLines),
		logOffset:   0,
		logFilter:   "",
		logSearch:   "",
		searching:   false,
		searchInput: ti,
		config:      cfg,
		startTime:   time.Now(),
		width:       80, //nolint:mnd
		height:      24, //nolint:mnd
		err:         nil,
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, tickCmd())
}

func tickCmd() tea.Cmd {
	return tea.Tick(uptimeInterval, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}
