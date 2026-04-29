package project

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

const flagJSON = "json"

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List remote apps",
		Action:  commandList,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagJSON,
				Usage: "Output as JSON",
			},
		},
	}
}

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	return List(ctx, ce, cmd.Bool(flagJSON))
}

func List(ctx context.Context, ce *clienv.CliEnv, jsonOutput bool) error {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	orgs, err := cl.GetOrganizationsAndWorkspacesApps(ctx)
	if err != nil {
		return fmt.Errorf("failed to get workspaces: %w", err)
	}

	if jsonOutput {
		return printListJSON(orgs)
	}

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return printListStyled(ce, orgs)
	}

	return clienv.Printlist(ce, orgs) //nolint:wrapcheck
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

type projectJSON struct {
	Name         string `json:"name"`
	Subdomain    string `json:"subdomain"`
	Organization string `json:"organization"`
	Region       string `json:"region"`
}

func collectProjects(
	orgs *graphql.GetOrganizationsAndWorkspacesApps,
) []projectJSON {
	var projects []projectJSON

	for _, org := range orgs.GetOrganizations() {
		for _, app := range org.Apps {
			projects = append(projects, projectJSON{
				Name:         app.Name,
				Subdomain:    app.Subdomain,
				Organization: org.Name,
				Region:       app.Region.Name,
			})
		}
	}

	for _, ws := range orgs.GetWorkspaces() {
		for _, app := range ws.Apps {
			projects = append(projects, projectJSON{
				Name:         app.Name,
				Subdomain:    app.Subdomain,
				Organization: ws.Name,
				Region:       app.Region.Name,
			})
		}
	}

	return projects
}

func printListJSON(
	orgs *graphql.GetOrganizationsAndWorkspacesApps,
) error {
	projects := collectProjects(orgs)

	if err := json.NewEncoder(os.Stdout).Encode(projects); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}
