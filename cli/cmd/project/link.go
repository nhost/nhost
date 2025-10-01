package project

import (
	"context"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func CommandLink() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "link",
		Aliases: []string{},
		Usage:   "Link local app to a remote one",
		Action:  commandLink,
		Flags:   []cli.Flag{},
	}
}

func commandLink(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	_, err := ce.Link(ctx)

	return err //nolint:wrapcheck
}
