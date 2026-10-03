package dev

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
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
		return errors.New( //nolint:err113
			"no nhost project found, please run `nhost init` or `nhost config pull`",
		)
	}

	if !clienv.PathExists(ce.Path.DockerCompose()) {
		return errors.New( //nolint:err113
			"development environment has never been started, please run `nhost up`",
		)
	}

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())
	if err := dc.Wrapper(ctx, "ps", "-a"); err != nil {
		return fmt.Errorf("failed to read service status: %w", err)
	}

	body, err := os.ReadFile(filepath.Join(ce.Path.DotNhostFolder(), devInfoFileName))
	if errors.Is(err, os.ErrNotExist) {
		ce.Warnln("service URLs are unavailable until the next `nhost up`")

		return nil
	}

	if err != nil {
		return fmt.Errorf("failed to read service URLs: %w", err)
	}

	fmt.Fprint(os.Stdout, string(body))

	return nil
}
