package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"os"

	"github.com/nhost/cli/nhostclient/graphql"
)

func (ce *CliEnv) GetAppInfo(
	ctx context.Context,
) (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	var project *graphql.GetWorkspacesApps_Workspaces_Apps
	if err := UnmarshalFile(ce.Path.ProjectFile(), &project, json.Unmarshal); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			project, err = ce.Link(ctx)
			if err != nil {
				return nil, err
			}
		} else {
			ce.Warnln("Failed to find linked project: %v", err)
			ce.Infoln("Please run `nhost project link` to link a project first")
			return nil, err
		}
	}

	return project, nil
}
