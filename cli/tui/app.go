package tui

import (
	"bufio"
	"context"
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/nhost/nhost/cli/dockercompose"
)

type UpFunc func(reporter ProgressReporter) error

type Reporter struct {
	p *tea.Program
}

func NewReporter(p *tea.Program) *Reporter {
	return &Reporter{p: p}
}

func (r *Reporter) StartPhase(name string) {
	r.p.Send(phaseStartMsg{name: name})
}

func (r *Reporter) EndPhase() {
	r.p.Send(phaseEndMsg{})
}

func (r *Reporter) FailPhase(err error) {
	r.p.Send(phaseFailMsg{err: err})
}

func (r *Reporter) SkipPhase(name string) {
	r.p.Send(phaseSkipMsg{name: name})
}

func (r *Reporter) Complete(info string) {
	r.p.Send(completeMsg{info: info})
}

func RunApp(
	ctx context.Context,
	cfg AppConfig,
	upFn UpFunc,
) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	m := newModel(cfg, cancel)
	p := tea.NewProgram(m, tea.WithAltScreen())

	reporter := NewReporter(p)

	go runStartup(ctx, p, cfg, reporter, upFn)
	go pollServices(ctx, p, cfg.DC)

	return runProgram(p)
}

func RunAttach(ctx context.Context, cfg AppConfig) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	m := newModel(cfg, cancel)
	m.state = stateDashboard

	p := tea.NewProgram(m, tea.WithAltScreen())

	go pollServices(ctx, p, cfg.DC)
	go startLogStream(ctx, p, cfg.DC)

	return runProgram(p)
}

func runProgram(p *tea.Program) error {
	finalModel, err := p.Run()
	if err != nil {
		return fmt.Errorf("TUI error: %w", err)
	}

	if fm, ok := finalModel.(Model); ok && fm.err != nil {
		return fm.err
	}

	return nil
}

func runStartup(
	ctx context.Context,
	p *tea.Program,
	cfg AppConfig,
	reporter *Reporter,
	upFn UpFunc,
) {
	if err := upFn(reporter); err != nil {
		if ctx.Err() != nil {
			return
		}

		p.Send(errMsg{err: err})

		return
	}

	reporter.Complete("")
	startLogStream(ctx, p, cfg.DC)
}

func pollServices(
	ctx context.Context,
	p *tea.Program,
	dc *dockercompose.DockerCompose,
) {
	pollOnce(ctx, p, dc)

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pollOnce(ctx, p, dc)
		}
	}
}

func pollOnce(
	ctx context.Context,
	p *tea.Program,
	dc *dockercompose.DockerCompose,
) {
	services, err := dc.PS(ctx)
	if err != nil || services == nil {
		return
	}

	p.Send(serviceStatusMsg{services: services})
}

func startLogStream(
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

func parseLogLine(line string) (string, string) {
	// docker compose logs format: "service-N  | log text"
	parts := strings.SplitN(line, " | ", 2) //nolint:mnd
	if len(parts) != 2 {                    //nolint:mnd
		return "unknown", line
	}

	service := strings.TrimSpace(parts[0])
	// strip the "-1" suffix from container name
	if idx := strings.LastIndex(service, "-"); idx > 0 {
		suffix := service[idx+1:]
		isDigit := true

		for _, c := range suffix {
			if c < '0' || c > '9' {
				isDigit = false

				break
			}
		}

		if isDigit {
			service = service[:idx]
		}
	}

	return service, parts[1]
}
