package project

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/v2/nhostclient/graphql"
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
	ce := clienv.New(cCtx)

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:gomnd
		return fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	return Link(cCtx.Context, ce)
}

func getApp(
	workspaces []*graphql.GetWorkspacesApps_Workspaces,
	idx string,
) (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	x := 1
	var app *graphql.GetWorkspacesApps_Workspaces_Apps
OUTER:
	for _, ws := range workspaces {
		for _, a := range ws.GetApps() {
			if fmt.Sprintf("%d", x) == idx {
				a := a
				app = a
				break OUTER
			}
			x++
		}
	}

	if app == nil {
		return nil, fmt.Errorf("invalid input") //nolint:goerr113
	}

	return app, nil
}

func confirmApp(ce *clienv.CliEnv, app *graphql.GetWorkspacesApps_Workspaces_Apps) error {
	ce.PromptMessage("Enter project subdomain to confirm: ")
	confirm, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if confirm != app.Subdomain {
		return fmt.Errorf("input doesn't match the subdomain") //nolint:goerr113
	}

	return nil
}

func Link(
	ctx context.Context, ce *clienv.CliEnv,
) error {
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

	if len(workspaces.GetWorkspaces()) == 0 {
		return fmt.Errorf("no workspaces found") //nolint:goerr113
	}

	if err := printlist(ce, workspaces.GetWorkspaces()); err != nil {
		return err
	}

	ce.PromptMessage("Select # the workspace to link: ")
	idx, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read workspace: %w", err)
	}

	app, err := getApp(workspaces.GetWorkspaces(), idx)
	if err != nil {
		return err
	}

	if err := confirmApp(ce, app); err != nil {
		return err
	}

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:gomnd
		return fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	if err := clienv.MarshalFile(app, ce.Path.ProjectFile(), json.Marshal); err != nil {
		return fmt.Errorf("failed to marshal project information: %w", err)
	}

	return nil
}
