package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/nhost/cli/nhostclient/graphql"
)

func printlist(ce *CliEnv, workspaces []*graphql.GetWorkspacesApps_Workspaces) error {
	if len(workspaces) == 0 {
		return errors.New("no workspaces found") //nolint:goerr113
	}

	num := Column{
		Header: "#",
		Rows:   make([]string, 0),
	}
	subdomain := Column{
		Header: "Subdomain",
		Rows:   make([]string, 0),
	}
	project := Column{
		Header: "Project",
		Rows:   make([]string, 0),
	}
	workspace := Column{
		Header: "Workspace",
		Rows:   make([]string, 0),
	}
	region := Column{
		Header: "Region",
		Rows:   make([]string, 0),
	}

	for _, ws := range workspaces {
		for _, app := range ws.Apps {
			num.Rows = append(num.Rows, strconv.Itoa(len(num.Rows)+1))
			subdomain.Rows = append(subdomain.Rows, app.Subdomain)
			project.Rows = append(project.Rows, app.Name)
			workspace.Rows = append(workspace.Rows, ws.Name)
			region.Rows = append(region.Rows, app.Region.Name)
		}
	}

	ce.Println(Table(num, subdomain, project, workspace, region))

	return nil
}

func confirmApp(ce *CliEnv, app *graphql.GetWorkspacesApps_Workspaces_Apps) error {
	ce.PromptMessage("Enter project subdomain to confirm: ")
	confirm, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if confirm != app.Subdomain {
		return errors.New("input doesn't match the subdomain") //nolint:goerr113
	}

	return nil
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
			if strconv.Itoa(x) == idx {
				a := a
				app = a
				break OUTER
			}
			x++
		}
	}

	if app == nil {
		return nil, errors.New("invalid input") //nolint:goerr113
	}

	return app, nil
}

func (ce *CliEnv) Link(ctx context.Context) (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get nhost client: %w", err)
	}
	workspaces, err := cl.GetWorkspacesApps(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get workspaces: %w", err)
	}

	if len(workspaces.GetWorkspaces()) == 0 {
		return nil, errors.New("no workspaces found") //nolint:goerr113
	}

	if err := printlist(ce, workspaces.GetWorkspaces()); err != nil {
		return nil, err
	}

	ce.PromptMessage("Select the workspace # to link: ")
	idx, err := ce.PromptInput(false)
	if err != nil {
		return nil, fmt.Errorf("failed to read workspace: %w", err)
	}

	app, err := getApp(workspaces.GetWorkspaces(), idx)
	if err != nil {
		return nil, err
	}

	if err := confirmApp(ce, app); err != nil {
		return nil, err
	}

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:mnd
		return nil, fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	if err := MarshalFile(app, ce.Path.ProjectFile(), json.Marshal); err != nil {
		return nil, fmt.Errorf("failed to marshal project information: %w", err)
	}

	return app, nil
}
