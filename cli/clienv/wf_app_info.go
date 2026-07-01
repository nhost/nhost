package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

func getRemoteAppInfo(
	ctx context.Context,
	ce *CliEnv,
	subdomain string,
) (*graphql.AppSummaryFragment, error) {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get nhost client: %w", err)
	}

	resp, err := cl.GetOrganizationsAndWorkspacesApps(
		ctx,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get workspaces: %w", err)
	}

	for _, workspace := range resp.Workspaces {
		for _, app := range workspace.Apps {
			if app.Subdomain == subdomain {
				return app, nil
			}
		}
	}

	for _, organization := range resp.Organizations {
		for _, app := range organization.Apps {
			if app.Subdomain == subdomain {
				return app, nil
			}
		}
	}

	return nil, fmt.Errorf("failed to find app with subdomain: %s", subdomain) //nolint:err113
}

var ErrNoLinkedProject = errors.New( //nolint:gochecknoglobals
	"no linked project. Run `nhost link` to link a project first",
)

func (ce *CliEnv) GetAppInfo(
	ctx context.Context,
	subdomain string,
) (*graphql.AppSummaryFragment, error) {
	if subdomain != "" {
		return getRemoteAppInfo(ctx, ce, subdomain)
	}

	var project *graphql.AppSummaryFragment
	if err := UnmarshalFile(ce.Path.ProjectFile(), &project, json.Unmarshal); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrNoLinkedProject
		}

		return nil, fmt.Errorf("failed to read project file: %w", err)
	}

	return project, nil
}
