package docs

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/pkg/docssearch"
	"github.com/urfave/cli/v3"
)

const flagRaw = "raw"

func CommandShow() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "show",
		Aliases: []string{"view"},
		Usage:   "Display contents of a documentation page",
		Action:  commandShow,
		Arguments: []cli.Argument{
			&cli.StringArgs{ //nolint:exhaustruct
				Name:      "page",
				UsageText: "<page-path>",
				Min:       1,
				Max:       1,
			},
		},
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagRaw,
				Usage: "Show raw MDX content including frontmatter",
			},
		},
	}
}

func commandShow(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	pagePath := cmd.StringArgs("page")[0]
	showRaw := cmd.Bool(flagRaw)

	content, err := docssearch.ReadPageBytes(pagePath)
	if err != nil {
		return fmt.Errorf("%w\nTry running 'nhost docs list' to see available pages", err)
	}

	if showRaw {
		ce.Println("%s", string(content))
	} else {
		_, body := docssearch.ParseFrontmatter(content)
		ce.Println("%s", body)
	}

	return nil
}
