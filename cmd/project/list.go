package project

import (
	"context"
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "Lst remote apps",
		Action:  commandList,
		Flags:   []cli.Flag{},
	}
}

func commandList(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)
	return List(cCtx.Context, ce)
}

func printlist(ce *clienv.CliEnv, workspaces []*graphql.GetWorkspacesApps_Workspaces) error {
	if len(workspaces) == 0 {
		return fmt.Errorf("no workspaces found") //nolint:goerr113
	}

	num := clienv.Column{
		Header: "#",
		Rows:   make([]string, 0),
	}
	subdomain := clienv.Column{
		Header: "Subdomain",
		Rows:   make([]string, 0),
	}
	project := clienv.Column{
		Header: "Project",
		Rows:   make([]string, 0),
	}
	workspace := clienv.Column{
		Header: "Workspace",
		Rows:   make([]string, 0),
	}
	region := clienv.Column{
		Header: "Region",
		Rows:   make([]string, 0),
	}

	for _, ws := range workspaces {
		for _, app := range ws.Apps {
			num.Rows = append(num.Rows, fmt.Sprintf("%d", len(num.Rows)+1))
			subdomain.Rows = append(subdomain.Rows, app.Subdomain)
			project.Rows = append(project.Rows, app.Name)
			workspace.Rows = append(workspace.Rows, ws.Name)
			region.Rows = append(region.Rows, app.Region.AwsName)
		}
	}

	ce.Println(clienv.Table(num, subdomain, project, workspace, region))

	return nil
}

func List(ctx context.Context, ce *clienv.CliEnv) error {
	session, err := ce.LoadSession(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	cl := ce.GetNhostClient()
	workspaces, err := cl.GetWorkspacesApps(
		ctx,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get workspaces: %w", err)
	}

	return printlist(ce, workspaces.Workspaces)
}
