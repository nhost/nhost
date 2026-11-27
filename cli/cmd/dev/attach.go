package dev

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func CommandAttach() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "attach",
		Aliases: []string{},
		Usage:   "Attach to a running development environment",
		Action:  commandAttach,
	}
}

func commandAttach(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if !term.IsTerminal(int(os.Stdout.Fd())) {
		return errors.New( //nolint:err113
			"nhost attach requires an interactive terminal",
		)
	}

	dc := dockercompose.NewWithWriters(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
		io.Discard, io.Discard, strings.NewReader(""),
	)

	localConfig, err := dc.LocalDevelopmentConfig()
	if err != nil {
		return fmt.Errorf("failed to read local development config: %w", err)
	}

	versions := fetchVersions(ctx, ce, cmd.Root().Version)
	mcp := mcpStatus(ce)

	cfg := attachAppConfig(ce, dc, localConfig, versions, mcp)

	return tui.RunAttach(ctx, cfg) //nolint:wrapcheck
}

func attachAppConfig(
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	localConfig dockercompose.LocalDevelopmentConfig,
	versions map[string]tui.ServiceVersion,
	mcp tui.MCPStatus,
) tui.AppConfig {
	return tui.AppConfig{
		DC:           dc,
		Subdomain:    ce.LocalSubdomain(),
		HTTPPort:     localConfig.HTTPPort,
		UseTLS:       localConfig.UseTLS,
		PostgresPort: localConfig.PostgresPort,
		ProjectName:  ce.ProjectName(),
		Versions:     versions,
		MCP:          mcp,
	}
}
