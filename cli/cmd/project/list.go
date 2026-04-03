package project

import (
	"context"
	"fmt"
	"os"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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

	if !term.IsTerminal(int(os.Stdout.Fd())) {
		return clienv.Printlist(ce, orgs) //nolint:wrapcheck
	}

	return printListStyled(ce, orgs)
}

func printListStyled(
	ce *clienv.CliEnv,
	orgs *graphql.GetOrganizationsAndWorkspacesApps,
) error {
	bold := lipgloss.NewStyle().Bold(true)
	bullet := lipgloss.NewStyle().Foreground(clienv.ANSIColorGreen).Render("●")
	dim := lipgloss.NewStyle().Foreground(clienv.ANSIColorDim)

	for _, org := range orgs.GetOrganizations() {
		printOrgApps(ce, org.Name, org.Apps, bold, bullet, dim)
	}

	for _, ws := range orgs.GetWorkspaces() {
		printOrgApps(ce, ws.Name+" *", ws.Apps, bold, bullet, dim)
	}

	return nil
}

func printOrgApps(
	ce *clienv.CliEnv,
	name string,
	apps []*graphql.AppSummaryFragment,
	bold lipgloss.Style,
	bullet string,
	dim lipgloss.Style,
) {
	ce.Println("  %s", bold.Render(name))

	for _, app := range apps {
		ce.Println(
			"    %s %-16s %s",
			bullet,
			app.Subdomain,
			dim.Render(fmt.Sprintf("%-14s %s", app.Name, app.Region.Name)),
		)
	}

	ce.Println("")
}
