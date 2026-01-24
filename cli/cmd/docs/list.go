package docs

import (
	"context"
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
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

	config, err := LoadDocsIndex()
	if err != nil {
		return fmt.Errorf("failed to load docs index: %w", err)
	}

	if cmd.Bool(flagGrouped) {
		return listGrouped(ce, config)
	}

	return listFlat(ce, config)
}

func listFlat(ce *clienv.CliEnv, config *DocsConfig) error {
	paths := GetAllPagePaths(config)
	for _, path := range paths {
		ce.Println("%s", path)
	}

	return nil
}

func listGrouped(ce *clienv.CliEnv, config *DocsConfig) error {
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
			printPagesGrouped(ce, dropdown.Pages, 2)
		}

		ce.Println("")
	}

	return nil
}

func printPagesGrouped(ce *clienv.CliEnv, pages []any, indent int) {
	indentStr := ""
	var indentStrSb76 strings.Builder
	for range indent {
		indentStrSb76.WriteString(" ")
	}
	indentStr += indentStrSb76.String()

	for _, page := range pages {
		switch v := page.(type) {
		case string:
			ce.Println("%s  %s", indentStr, v)
		case map[string]any:
			if groupName, ok := v["group"].(string); ok {
				ce.Println("%s  [%s]", indentStr, groupName)

				if groupPages, ok := v["pages"].([]any); ok {
					printPagesGrouped(ce, groupPages, indent+2)
				}
			}
		}
	}
}
