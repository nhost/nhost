package dev

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
)

const (
	flagJSON = "json"

	healthHealthy  = "healthy"
	statusDegraded = "degraded"
	statusRunning  = "running"
	statusStopped  = "stopped"
)

func CommandStatus() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "status",
		Aliases: []string{},
		Usage:   "Show status of the local development environment",
		Action:  commandStatus,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagJSON,
				Usage: "Output as JSON",
			},
		},
	}
}

type statusOutput struct {
	Status         string          `json:"status"`
	SDK            statusSDK       `json:"sdk"`
	Services       []statusService `json:"services"`
	Infrastructure []statusService `json:"infrastructure"`
}

type statusService struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	Health  string `json:"health,omitempty"`
	URL     string `json:"url,omitempty"`
	Version string `json:"version,omitempty"`
}

type statusSDK struct {
	Subdomain string `json:"subdomain"`
	Region    string `json:"region"`
}

func commandStatus(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	dc := dockercompose.New(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
	)

	services, err := dc.PS(ctx)
	if err != nil {
		return fmt.Errorf("failed to get service status: %w", err)
	}

	localConfig, err := dc.LocalDevelopmentConfig()
	if err != nil {
		return fmt.Errorf("failed to read local development config: %w", err)
	}

	if cmd.Bool(flagJSON) {
		return printStatusJSON(ce, services, localConfig)
	}

	printStatusStyled(ce, services, localConfig)

	return nil
}

func printStatusJSON(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
	localConfig dockercompose.LocalDevelopmentConfig,
) error {
	out := buildStatusOutput(ce, services, localConfig)

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")

	if err := enc.Encode(out); err != nil {
		return fmt.Errorf("failed to encode status: %w", err)
	}

	return nil
}

func buildStatusOutput(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
	localConfig dockercompose.LocalDevelopmentConfig,
) statusOutput {
	overall := overallStatus(services)

	core, infra := dockercompose.GroupServices(services)

	return statusOutput{
		Status: overall,
		SDK: statusSDK{
			Subdomain: ce.LocalSubdomain(),
			Region:    "local",
		},
		Services:       toStatusServices(ce, core, localConfig),
		Infrastructure: toStatusServices(ce, infra, localConfig),
	}
}

func overallStatus(services []dockercompose.ServiceStatus) string {
	running := 0
	stopped := 0

	for _, svc := range services {
		if isServiceRunning(svc) {
			running++
			continue
		}

		stopped++
	}

	switch {
	case running == 0:
		return statusStopped
	case stopped == 0:
		return statusRunning
	default:
		return statusDegraded
	}
}

func isServiceRunning(svc dockercompose.ServiceStatus) bool {
	return svc.State == statusRunning || svc.Health == healthHealthy
}

func toStatusServices(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
	localConfig dockercompose.LocalDevelopmentConfig,
) []statusService {
	out := make([]statusService, 0, len(services))
	for _, svc := range services {
		out = append(out, statusService{
			Name:    svc.Service,
			State:   svc.State,
			Health:  svc.Health,
			URL:     serviceURLPlain(ce, svc.Service, localConfig),
			Version: "",
		})
	}

	return out
}

func serviceURLPlain(
	ce *clienv.CliEnv,
	name string,
	localConfig dockercompose.LocalDevelopmentConfig,
) string {
	return dockercompose.LocalServiceURL(
		ce.LocalSubdomain(),
		name,
		localConfig.HTTPPort,
		localConfig.PostgresPort,
		localConfig.UseTLS,
	)
}

func printStatusStyled(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
	localConfig dockercompose.LocalDevelopmentConfig,
) {
	if len(services) == 0 {
		ce.Println("No services running")
		return
	}

	bullet := lipgloss.NewStyle().
		Foreground(clienv.ANSIColorGreen).Render("\u25cf")
	dim := lipgloss.NewStyle().Foreground(clienv.ANSIColorGray)

	ce.Println("  %s", dim.Render("SDK"))
	ce.Println("    Subdomain:  %s", ce.LocalSubdomain())
	ce.Println("    Region:     local")
	ce.Println("")

	core, infra := dockercompose.GroupServices(services)

	ce.Println("  %s", dim.Render("Services"))

	for _, svc := range core {
		printStatusService(ce, svc, bullet, dim, localConfig)
	}

	if len(infra) > 0 {
		ce.Println("")
		ce.Println("  %s", dim.Render("Infrastructure"))

		for _, svc := range infra {
			printStatusService(ce, svc, bullet, dim, localConfig)
		}
	}
}

func printStatusService(
	ce *clienv.CliEnv,
	svc dockercompose.ServiceStatus,
	bullet string,
	dim lipgloss.Style,
	localConfig dockercompose.LocalDevelopmentConfig,
) {
	status := svc.State
	if svc.Health != "" {
		status = svc.Health
	}

	url := serviceURLPlain(ce, svc.Service, localConfig)
	if url != "" {
		ce.Println("    %s %-14s %-10s %s",
			bullet, svc.Service, status, dim.Render(url))
	} else {
		ce.Println("    %s %-14s %s",
			bullet, svc.Service, status)
	}
}
