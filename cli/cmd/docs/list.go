package docs

import (
	"context"
	"sort"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/pkg/docssearch"
	"github.com/urfave/cli/v3"
)

const flagGrouped = "grouped"

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{"ls"},
		Usage:   "List all documentation pages",
		Action:  commandList,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagGrouped,
				Usage: "Show pages organized by section",
			},
		},
	}
}

func commandList(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if cmd.Bool(flagGrouped) {
		return listGrouped(ce)
	}

	return listFlat(ce)
}

func listFlat(ce *clienv.CliEnv) error {
	pages := docssearch.GetAllPagesWithInfo()
	for _, page := range pages {
		title := page.Title
		if title == "" {
			title = page.Path
		}

		if page.Description != "" {
			ce.Println("[%s](%s) - %s", page.Path, title, page.Description)
		} else {
			ce.Println("[%s](%s)", page.Path, title)
		}
	}

	return nil
}

func listGrouped(ce *clienv.CliEnv) error {
	pages := docssearch.GetAllPagesWithInfo()

	// Group pages by top-level section
	sections := make(map[string][]docssearch.PageInfo)

	for _, page := range pages {
		parts := strings.SplitN(strings.TrimPrefix(page.Path, "/"), "/", 2) //nolint:mnd
		section := parts[0]
		sections[section] = append(sections[section], page)
	}

	// Sort section names
	sectionNames := make([]string, 0, len(sections))
	for name := range sections {
		sectionNames = append(sectionNames, name)
	}

	sort.Strings(sectionNames)

	for _, section := range sectionNames {
		ce.Println("## %s", section)
		ce.Println("")

		for _, page := range sections[section] {
			title := page.Title
			if title == "" {
				title = page.Path
			}

			if page.Description != "" {
				ce.Println("  [%s](%s) - %s", page.Path, title, page.Description)
			} else {
				ce.Println("  [%s](%s)", page.Path, title)
			}
		}

		ce.Println("")
	}

	return nil
}
