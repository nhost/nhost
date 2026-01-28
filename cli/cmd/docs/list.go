package docs

import (
	"context"
	"fmt"
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
				Usage: "Show pages organized by tab and section",
			},
		},
	}
}

func commandList(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	config, err := docssearch.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load docs index: %w", err)
	}

	if cmd.Bool(flagGrouped) {
		return listGrouped(ce, config)
	}

	return listFlat(ce, config)
}

func listFlat(ce *clienv.CliEnv, config *docssearch.Config) error {
	pages := docssearch.GetAllPagesWithInfo(config)
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

func listGrouped(ce *clienv.CliEnv, config *docssearch.Config) error {
	for _, tab := range config.Navigation.Tabs {
		if tab.Href != "" {
			continue
		}

		ce.Println("## %s", tab.Tab)
		ce.Println("")

		if len(tab.Pages) > 0 {
			printPagesGrouped(ce, tab.Pages, 0)
		}

		for _, dropdown := range tab.Dropdowns {
			ce.Println("  ### %s", dropdown.Dropdown)
			printPagesGrouped(ce, dropdown.Pages, 2) //nolint:mnd
		}

		ce.Println("")
	}

	return nil
}

func printPagesGrouped(ce *clienv.CliEnv, pages []any, indent int) {
	indentStr := strings.Repeat(" ", indent)

	for _, page := range pages {
		switch v := page.(type) {
		case string:
			printSinglePageGrouped(ce, v, indentStr)
		case map[string]any:
			printGroupGrouped(ce, v, indentStr, indent)
		}
	}
}

func printSinglePageGrouped(ce *clienv.CliEnv, path, indentStr string) {
	if docssearch.IsDeprecatedPath(path) {
		return
	}

	info := docssearch.GetPageInfo(path)
	title := info.Title

	if title == "" {
		title = path
	}

	if info.Description != "" {
		ce.Println("%s  [%s](%s) - %s", indentStr, path, title, info.Description)
	} else {
		ce.Println("%s  [%s](%s)", indentStr, path, title)
	}
}

func printGroupGrouped(ce *clienv.CliEnv, v map[string]any, indentStr string, indent int) {
	groupName, ok := v["group"].(string)
	if !ok {
		return
	}

	if strings.Contains(strings.ToLower(groupName), "deprecated") {
		return
	}

	ce.Println("%s  [%s]", indentStr, groupName)

	if groupPages, ok := v["pages"].([]any); ok {
		printPagesGrouped(ce, groupPages, indent+2) //nolint:mnd
	}
}
