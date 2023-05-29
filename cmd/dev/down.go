package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/dockercompose"
	"github.com/urfave/cli/v2"
)

func CommandDown() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "down",
		Aliases: []string{},
		Usage:   "Stop local development environment",
		Action:  commandDown,
		Flags:   []cli.Flag{},
	}
}

func commandDown(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	dc := dockercompose.New(ce.Path.DockerCompose(), ce.ProjectName())

	if err := dc.Stop(cCtx.Context); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)
	}

	return nil
}
