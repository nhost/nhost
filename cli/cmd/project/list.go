package project

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List remote apps",
		Action:  commandList,
		Flags:   []cli.Flag{},
	}
}

func commandList(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)
	return List(cCtx.Context, ce)
}

func List(ctx context.Context, ce *clienv.CliEnv) error {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	orgs, err := cl.GetOrganizationsAndWorkspacesApps(ctx)
	if err != nil {
		return fmt.Errorf("failed to get workspaces: %w", err)
	}

	return clienv.Printlist(ce, orgs) //nolint:wrapcheck
}
