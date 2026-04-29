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

const flagJSON = "json"

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
	Status   string          `json:"status"`
	Services []statusService `json:"services"`
	SDK      statusSDK       `json:"sdk"`
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

	if cmd.Bool(flagJSON) {
		return printStatusJSON(ce, services)
	}

	printStatusStyled(ce, services)

	return nil
}

func printStatusJSON(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
) error {
	out := buildStatusOutput(ce, services)

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
) statusOutput {
	overall := "stopped"
	if len(services) > 0 {
		overall = "running"
	}

	svcList := make([]statusService, 0, len(services))
	for _, svc := range services {
		svcList = append(svcList, statusService{
			Name:    svc.Service,
			State:   svc.State,
			Health:  svc.Health,
			URL:     serviceURLPlain(ce, svc.Service),
			Version: "",
		})
	}

	return statusOutput{
		Status:   overall,
		Services: svcList,
		SDK: statusSDK{
			Subdomain: ce.LocalSubdomain(),
			Region:    "local",
		},
	}
}

func serviceURLPlain(ce *clienv.CliEnv, name string) string {
	sub := ce.LocalSubdomain()

	switch name {
	case "postgres":
		return fmt.Sprintf("localhost:%d", defaultPostgresPort)
	case "graphql":
		return dockercompose.URL(sub, "graphql", defaultHTTPPort, true)
	case "auth":
		return dockercompose.URL(sub, "auth", defaultHTTPPort, true)
	case "storage":
		return dockercompose.URL(sub, "storage", defaultHTTPPort, true)
	case "functions":
		return dockercompose.URL(sub, "functions", defaultHTTPPort, true)
	case "dashboard":
		return dockercompose.URL(sub, "dashboard", defaultHTTPPort, true)
	case "mailhog":
		return dockercompose.URL(sub, "mailhog", defaultHTTPPort, true)
	default:
		return ""
	}
}

func printStatusStyled(
	ce *clienv.CliEnv,
	services []dockercompose.ServiceStatus,
) {
	if len(services) == 0 {
		ce.Println("No services running")
		return
	}

	bullet := lipgloss.NewStyle().
		Foreground(clienv.ANSIColorGreen).Render("\u25cf")
	dim := lipgloss.NewStyle().Foreground(clienv.ANSIColorGray)

	ce.Println("  %s", dim.Render("Services"))

	for _, svc := range services {
		printStatusService(ce, svc, bullet, dim)
	}

	ce.Println("")
	ce.Println("  %s", dim.Render("SDK"))
	ce.Println("    Subdomain:  %s", ce.LocalSubdomain())
	ce.Println("    Region:     local")
}

func printStatusService(
	ce *clienv.CliEnv,
	svc dockercompose.ServiceStatus,
	bullet string,
	dim lipgloss.Style,
) {
	status := svc.State
	if svc.Health != "" {
		status = svc.Health
	}

	url := serviceURLPlain(ce, svc.Service)
	if url != "" {
		ce.Println("    %s %-14s %-10s %s",
			bullet, svc.Service, status, dim.Render(url))
	} else {
		ce.Println("    %s %-14s %s",
			bullet, svc.Service, status)
	}
}
