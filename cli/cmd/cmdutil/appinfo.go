package cmdutil

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/tui"
	"golang.org/x/term"
)

// GetAppInfoOrLink wraps GetAppInfo and triggers interactive project
// linking when no project is linked and a TTY is available.
func GetAppInfoOrLink(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain string,
) (*graphql.AppSummaryFragment, error) {
	proj, err := ce.GetAppInfo(ctx, subdomain)
	if err == nil {
		return proj, nil
	}

	if !errors.Is(err, clienv.ErrNoLinkedProject) {
		return nil, err
	}

	if !term.IsTerminal(int(os.Stdout.Fd())) {
		return nil, err
	}

	return linkInteractive(ctx, ce)
}

func linkInteractive(
	ctx context.Context,
	ce *clienv.CliEnv,
) (*graphql.AppSummaryFragment, error) {
	apps, _, err := ce.FetchApps(ctx)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	sort.Slice(apps, func(i, j int) bool {
		if apps[i].Org != apps[j].Org {
			return apps[i].Org < apps[j].Org
		}

		return apps[i].App.Name < apps[j].App.Name
	})

	items := buildPickerItems(apps)

	idx, err := tui.RunPicker("Link to project", items)
	if err != nil {
		return nil, clienv.ErrNoLinkedProject
	}

	if err := ce.SaveLink(apps[idx].App); err != nil {
		return nil, err
	}

	return apps[idx].App, nil
}

func buildPickerItems(apps []clienv.AppEntry) []tui.PickerItem {
	items := make([]tui.PickerItem, len(apps))
	for i, entry := range apps {
		items[i] = tui.PickerItem{
			Label: entry.Org + " / " + entry.App.Name,
			Desc: fmt.Sprintf(
				"%s \u00b7 %s",
				entry.App.Subdomain, entry.App.Region.Name,
			),
			Value:    entry.App,
			Selected: false,
		}
	}

	return items
}
