package tui

import (
	"context"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

const (
	maxLogLines    = 1000
	logStreamTail  = 100
	pollInterval   = 2 * time.Second
	uptimeInterval = 1 * time.Second
)

type appState int

const (
	stateStartup appState = iota
	stateDashboard
	stateStopping
)

// Messages.
type (
	phaseStartMsg    struct{ name string }
	phaseEndMsg      struct{}
	phaseFailMsg     struct{ err error }
	phaseSkipMsg     struct{ name string }
	completeMsg      struct{ info string }
	errMsg           struct{ err error }
	serviceStatusMsg struct{ services []dockercompose.ServiceStatus }
	logLineMsg       struct{ service, text string }
	tickMsg          time.Time
	stoppedMsg       struct{ err error }
)

type AppConfig struct {
	DC           *dockercompose.DockerCompose
	Subdomain    string
	HTTPPort     uint
	UseTLS       bool
	PostgresPort uint
	ProjectName  string
}

type LogEntry struct {
	Service string
	Text    string
}

type Model struct {
	state   appState
	phases  []Phase
	spinner spinner.Model

	services  []dockercompose.ServiceStatus
	logs      []LogEntry
	logOffset int
	logFilter string

	config    AppConfig
	startTime time.Time
	width     int
	height    int

	err    error
	cancel context.CancelFunc
}

func newModel(cfg AppConfig, cancel context.CancelFunc) Model {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	return Model{
		state:     stateStartup,
		phases:    make([]Phase, 0),
		spinner:   s,
		services:  nil,
		logs:      make([]LogEntry, 0, maxLogLines),
		logOffset: 0,
		logFilter: "",
		config:    cfg,
		startTime: time.Now(),
		width:     80, //nolint:mnd
		height:    24, //nolint:mnd
		err:       nil,
		cancel:    cancel,
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
