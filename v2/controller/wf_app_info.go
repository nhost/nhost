package controller

import (
	"context"
	"encoding/json"

	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func GetAppInfo(
	ctx context.Context, p Printer, cl NhostClient, fs *system.PathStructure,
) (*graphql.GetWorkspacesApps_Workspaces_Apps, error) {
	var project *graphql.GetWorkspacesApps_Workspaces_Apps
	if err := UnmarshalFile(fs.ProjectFile(), &project, json.Unmarshal); err != nil {
		p.Println(tui.Warn("Failed to find linked project: %v", err))
		p.Println(tui.Info("Please link a project"))
		project, err = Link(ctx, p, cl, fs)
		if err != nil {
			return nil, err
		}
	}

	return project, nil
}
