package tui

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/dockercompose"
)

const teardownPollInterval = 1 * time.Second

type teardownTickMsg time.Time

type teardownDoneMsg struct{ err error }

// TeardownModel shows services being stopped with status dots.
type TeardownModel struct {
	services []dockercompose.ServiceStatus
	spinner  spinner.Model
	done     bool
	err      error
	dc       *dockercompose.DockerCompose
	volumes  bool
	width    int
	height   int
	cancel   context.CancelFunc
}

func newTeardownModel(
	dc *dockercompose.DockerCompose,
	volumes bool,
	cancel context.CancelFunc,
) TeardownModel {
	s := spinner.New(
		spinner.WithSpinner(spinner.Dot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(colorCyan)),
	)

	return TeardownModel{
		services: nil,
		spinner:  s,
		done:     false,
		err:      nil,
		dc:       dc,
		volumes:  volumes,
		width:    80, //nolint:mnd
		height:   24, //nolint:mnd
		cancel:   cancel,
	}
}

func (m TeardownModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, teardownTickCmd())
}

func teardownTickCmd() tea.Cmd {
	return tea.Tick(teardownPollInterval, func(t time.Time) tea.Msg {
		return teardownTickMsg(t)
	})
}

func (m TeardownModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleTeardownKey(msg)
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		return m, nil
	case spinner.TickMsg:
		var cmd tea.Cmd

		m.spinner, cmd = m.spinner.Update(msg)

		return m, cmd
	case teardownTickMsg:
		return m, tea.Batch(m.pollServicesCmd(), teardownTickCmd())
	case serviceStatusMsg:
		return m.handleServiceStatus(msg)
	case teardownDoneMsg:
		m.done = true
		m.err = msg.err

		return m, tea.Quit
	}

	return m, nil
}

func (m TeardownModel) handleTeardownKey( //nolint:ireturn
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) {
	if msg.Type == tea.KeyCtrlC || msg.String() == "q" {
		m.cancel()

		return m, tea.Quit
	}

	return m, nil
}

func (m TeardownModel) handleServiceStatus(
	msg serviceStatusMsg,
) (TeardownModel, tea.Cmd) {
	m.services = msg.services
	if len(msg.services) == 0 {
		m.done = true

		return m, tea.Quit
	}

	return m, nil
}

func (m TeardownModel) pollServicesCmd() tea.Cmd {
	dc := m.dc

	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(
			context.Background(), teardownPollInterval,
		)
		defer cancel()

		services, err := dc.PS(ctx)
		if err != nil || services == nil {
			return serviceStatusMsg{services: nil}
		}

		return serviceStatusMsg{services: services}
	}
}

func (m TeardownModel) View() string {
	var b strings.Builder

	b.WriteString(headerStyle.Render(" nhost down"))
	b.WriteString("\n\n")

	if m.done {
		b.WriteString("  " + phaseCheck + " Services stopped\n")

		return b.String()
	}

	b.WriteString("  " + m.spinner.View() + " Stopping services...\n\n")

	for _, svc := range m.services {
		dot := teardownDot(svc)
		name := fmt.Sprintf("%-14s", svc.Service)
		b.WriteString("    " + dot + " " + name + "\n")
	}

	return b.String()
}

func teardownDot(svc dockercompose.ServiceStatus) string {
	if svc.State == "running" {
		return dotHealthy
	}

	return dotWaiting
}

func runTeardownStop(
	ctx context.Context,
	p *tea.Program,
	dc *dockercompose.DockerCompose,
	volumes bool,
) {
	err := dc.Stop(ctx, volumes)
	p.Send(teardownDoneMsg{err: err})
}

// RunTeardown starts the teardown TUI that shows services being stopped.
func RunTeardown(
	ctx context.Context,
	dc *dockercompose.DockerCompose,
	volumes bool,
) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	m := newTeardownModel(dc, volumes, cancel)
	p := tea.NewProgram(m)

	go runTeardownStop(ctx, p, dc, volumes)

	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("teardown TUI error: %w", err)
	}

	if fm, ok := finalModel.(TeardownModel); ok && fm.err != nil {
		return fmt.Errorf("failed to stop services: %w", fm.err)
	}

	return nil
}
