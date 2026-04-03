package dev

import (
	"context"
	"errors"
	"os"

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

	dc := dockercompose.New(
		ce.Path.WorkingDir(),
		ce.Path.DockerCompose(),
		ce.ProjectName(),
	)

	cfg := tui.AppConfig{
		DC:           dc,
		Subdomain:    ce.LocalSubdomain(),
		HTTPPort:     defaultHTTPPort,
		UseTLS:       true,
		PostgresPort: defaultPostgresPort,
		ProjectName:  ce.ProjectName(),
	}

	return tui.RunAttach(ctx, cfg) //nolint:wrapcheck
}
