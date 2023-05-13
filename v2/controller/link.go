package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

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

func confirmApp(app *graphql.GetWorkspacesApps_Workspaces_Apps, p Printer) error {
	p.Print(tui.PromptMessage("Enter project subdomain to confirm: "))
	confirm, err := tui.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if confirm != app.Subdomain {
		return fmt.Errorf("input doesn't match the subdomain") //nolint:goerr113
	}

	return nil
}

func Link(
	ctx context.Context, p Printer, cl NhostClient, fs *system.PathStructure,
) (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	session, err := LoadSession(ctx, p, cl, fs)
	if err != nil {
		return nil, fmt.Errorf("failed to load session: %w", err)
	}

	workspaces, err := cl.GetWorkspacesApps(
		ctx,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get workspaces: %w", err)
	}

	if len(workspaces.GetWorkspaces()) == 0 {
		return nil, fmt.Errorf("no workspaces found") //nolint:goerr113
	}

	if err := list(p, workspaces.GetWorkspaces()); err != nil {
		return nil, err
	}

	p.Print(tui.PromptMessage("Select # the workspace to link: "))
	idx, err := tui.PromptInput(false)
	if err != nil {
		return nil, fmt.Errorf("failed to read workspace: %w", err)
	}

	app, err := getApp(workspaces.GetWorkspaces(), idx)
	if err != nil {
		return nil, err
	}

	if err := confirmApp(app, p); err != nil {
		return nil, err
	}

	if err := os.MkdirAll(fs.DotNhostFolder(), 0o755); err != nil { //nolint:gomnd
		return nil, fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	if err := MarshalFile(app, fs.ProjectFile(), json.Marshal); err != nil {
		return nil, fmt.Errorf("failed to marshal project information: %w", err)
	}

	return app, nil
}
