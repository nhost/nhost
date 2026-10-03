package dev

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
	"gopkg.in/yaml.v3"
)

const devInfoFileName = "dev-urls.txt"

func CommandStatus() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "status",
		Aliases: []string{},
		Usage:   "Show status and URLs for the local development environment",
		Action:  commandStatus,
		Flags:   []cli.Flag{},
	}
}

func commandStatus(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if !clienv.PathExists(ce.Path.NhostToml()) {
		return cli.Exit(
			"no nhost project found, please run `nhost init` or `nhost config pull`",
			1,
		)
	}

	if !clienv.PathExists(ce.Path.DockerCompose()) {
		return cli.Exit("development environment has never been started, please run `nhost up`", 1)
	}

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())
	if err := dc.Wrapper(ctx, "ps", "-a"); err != nil {
		return cli.Exit("failed to read service status: "+err.Error(), 1)
	}

	body, err := os.ReadFile(filepath.Join(ce.Path.DotNhostFolder(), devInfoFileName))
	switch {
	case err == nil:
		fmt.Fprint(os.Stdout, string(body))
	case errors.Is(err, os.ErrNotExist):
		info, infoErr := infoFromCompose(ce.Path.DockerCompose())
		if infoErr != nil {
			return cli.Exit(infoErr.Error(), 1)
		}

		fmt.Fprint(os.Stdout, info)
	default:
		return cli.Exit("failed to read service URLs: "+err.Error(), 1)
	}

	return nil
}

const hasuraAliasSuffix = ".hasura.local.nhost.run"

func infoFromCompose(path string) (string, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read docker compose file: %w", err)
	}

	var file dockercompose.ComposeFile
	if err := yaml.Unmarshal(body, &file); err != nil {
		return "", fmt.Errorf("failed to parse docker compose file: %w", err)
	}

	subdomain, err := subdomainFrom(file.Services["traefik"])
	if err != nil {
		return "", err
	}

	httpPort, err := publishedPort(file.Services["traefik"])
	if err != nil {
		return "", fmt.Errorf("failed to read HTTP port: %w", err)
	}

	postgresPort, err := publishedPort(file.Services["postgres"])
	if err != nil {
		return "", fmt.Errorf("failed to read Postgres port: %w", err)
	}

	return printInfo(
		subdomain,
		httpPort,
		postgresPort,
		tlsEnabled(file.Services),
		runLinksFromCompose(file.Services),
	), nil
}

func subdomainFrom(svc *dockercompose.Service) (string, error) {
	if svc != nil {
		for _, network := range svc.Networks {
			if network == nil {
				continue
			}

			for _, alias := range network.Aliases {
				host, ok := strings.CutSuffix(alias, hasuraAliasSuffix)
				if ok && host != "" && !strings.Contains(host, ".") {
					return host, nil
				}
			}
		}
	}

	return "", errors.New("failed to read subdomain from docker compose file") //nolint:err113
}

func publishedPort(svc *dockercompose.Service) (uint, error) {
	if svc == nil || len(svc.Ports) == 0 {
		return 0, errors.New("service has no published port") //nolint:err113
	}

	port, err := strconv.ParseUint(svc.Ports[0].Published, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse published port: %w", err)
	}

	return uint(port), nil
}

func tlsEnabled(services map[string]*dockercompose.Service) bool {
	for _, svc := range services {
		if svc != nil && svc.Labels["traefik.http.routers.hasura.tls"] == "true" {
			return true
		}
	}

	return false
}

func runLinksFromCompose(services map[string]*dockercompose.Service) []runLink {
	names := make([]string, 0, len(services))
	for name := range services {
		if strings.HasPrefix(name, "run-") {
			names = append(names, name)
		}
	}

	sort.Strings(names)

	links := make([]runLink, 0)

	for _, name := range names {
		svc := services[name]
		if svc == nil {
			continue
		}

		for _, port := range svc.Ports {
			number, err := strconv.ParseUint(port.Published, 10, 64)
			if err != nil || number == 0 || number > math.MaxUint16 {
				continue
			}

			kind := port.Protocol
			if kind == "" {
				kind = "tcp"
			}

			links = append(links, runLink{
				name: strings.TrimPrefix(name, "run-"),
				kind: kind,
				port: uint16(number),
			})
		}
	}

	return links
}
