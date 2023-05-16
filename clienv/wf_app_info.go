package clienv

import (
	"encoding/json"

	"github.com/nhost/cli/nhostclient/graphql"
)

func (ce *CliEnv) GetAppInfo() (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	var project *graphql.GetWorkspacesApps_Workspaces_Apps
	if err := UnmarshalFile(ce.Path.ProjectFile(), &project, json.Unmarshal); err != nil {
		ce.Warnln("Failed to find linked project: %v", err)
		ce.Infoln("Please run `nhost project link` to link a project first")
		return nil, err
	}

	return project, nil
}
