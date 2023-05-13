package controller

import (
	"context"

	"github.com/nhost/cli/v2/dockercompose"
	"github.com/nhost/cli/v2/tui"
)

func Logs(
	ctx context.Context,
	p Printer,
	projectName string,
) error {
	dc := dockercompose.New(dockerComposeFilepath, projectName)

	if err := dc.Logs(ctx); err != nil {
		p.Print(tui.Warn("failed to stop Nhost development environment: %s", err))
	}

	return nil
}
