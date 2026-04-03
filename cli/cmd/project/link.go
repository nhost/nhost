package project

import (
	"context"
	"fmt"
	"os"
	"sort"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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

func commandLink(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	if term.IsTerminal(int(os.Stdout.Fd())) {
		return commandLinkInteractive(ctx, ce)
	}

	_, err := ce.Link(ctx)

	return err //nolint:wrapcheck
}

func commandLinkInteractive(
	ctx context.Context,
	ce *clienv.CliEnv,
) error {
	apps, _, err := ce.FetchApps(ctx)
	if err != nil {
		return err //nolint:wrapcheck
	}

	sort.Slice(apps, func(i, j int) bool {
		if apps[i].Org != apps[j].Org {
			return apps[i].Org < apps[j].Org
		}

		return apps[i].App.Name < apps[j].App.Name
	})

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

	idx, err := tui.RunPicker("Link to project", items)
	if err != nil {
		return nil //nolint:nilerr
	}

	return ce.SaveLink(apps[idx].App)
}
