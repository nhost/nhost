package project

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
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

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	return List(ctx, ce)
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
