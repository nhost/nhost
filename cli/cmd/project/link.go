package project

import (
	"fmt"
	"os"

	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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

func commandLink(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	_, err := ce.Link(cCtx.Context)

	return err //nolint:wrapcheck
}
