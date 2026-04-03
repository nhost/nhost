package clienv

import (
	"errors"
	"fmt"

	"github.com/charmbracelet/huh"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

type projectEntry struct {
	app     *graphql.AppSummaryFragment
	orgName string
}

func (ce *CliEnv) selectProjectInteractive(
	orgs *graphql.GetOrganizationsAndWorkspacesApps,
) (*graphql.AppSummaryFragment, error) {
	options, entries := buildProjectOptions(orgs)

	if len(options) == 0 {
		return nil, errors.New("no apps found") //nolint:err113
	}

	selected, err := ce.promptProjectSelection(options)
	if err != nil {
		return nil, err
	}

	entry := entries[selected]

	confirmed, err := ce.ConfirmPrompt(
		fmt.Sprintf("Link to %s / %s (%s) in %s?",
			entry.orgName, entry.app.Name, entry.app.Subdomain, entry.app.Region.Name),
		true,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to confirm project: %w", err)
	}

	if !confirmed {
		return nil, errors.New("linking cancelled") //nolint:err113
	}

	return entry.app, nil
}

func buildProjectOptions(
	orgs *graphql.GetOrganizationsAndWorkspacesApps,
) ([]huh.Option[int], []projectEntry) {
	options := make([]huh.Option[int], 0)
	entries := make([]projectEntry, 0)

	idx := 0

	for _, org := range orgs.GetOrganizations() {
		for _, app := range org.Apps {
			entries = append(entries, projectEntry{app: app, orgName: org.Name})
			label := fmt.Sprintf("%s / %s (%s) [%s]",
				org.Name, app.Name, app.Subdomain, app.Region.Name)
			options = append(options, huh.NewOption(label, idx))
			idx++
		}
	}

	for _, ws := range orgs.GetWorkspaces() {
		for _, app := range ws.Apps {
			entries = append(entries, projectEntry{app: app, orgName: ws.Name + "*"})
			label := fmt.Sprintf("%s* / %s (%s) [%s]",
				ws.Name, app.Name, app.Subdomain, app.Region.Name)
			options = append(options, huh.NewOption(label, idx))
			idx++
		}
	}

	return options, entries
}

func (ce *CliEnv) promptProjectSelection(options []huh.Option[int]) (int, error) {
	var selected int

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[int]().
				Title("Select project to link").
				Options(options...).
				Value(&selected),
		),
	)

	if err := ce.RunForm(form); err != nil {
		return 0, fmt.Errorf("failed to select project: %w", err)
	}

	return selected, nil
}
