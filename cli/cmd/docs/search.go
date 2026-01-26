package docs

import (
	"context"
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/pkg/docssearch"
	"github.com/urfave/cli/v3"
)

const (
	flagLimit    = "limit"
	defaultLimit = 5
)

func CommandSearch() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "search",
		Aliases: []string{"s", "find"},
		Usage:   "Search documentation pages",
		Action:  commandSearch,
		Arguments: []cli.Argument{
			&cli.StringArgs{ //nolint:exhaustruct
				Name:      "query",
				Min:       1,
				UsageText: "<query>",
				Max:       -1,
			},
		},
		Flags: []cli.Flag{
			&cli.IntFlag{ //nolint:exhaustruct
				Name:    flagLimit,
				Aliases: []string{"n"},
				Usage:   "Maximum number of results to return",
				Value:   defaultLimit,
			},
		},
	}
}

func commandSearch(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	query := strings.Join(cmd.StringArgs("query"), " ")
	limit := cmd.Int(flagLimit)

	results, err := docssearch.Search(query, limit, true)
	if err != nil {
		return fmt.Errorf("search failed: %w", err)
	}

	if results.Total == 0 {
		ce.Println("No results found for: %s", query)
		return nil
	}

	ce.Println("Found %d results for: %s\n", results.Total, query)

	for i, hit := range results.Results {
		ce.Println("%d. %s", i+1, hit.Path)

		if hit.Title != "" {
			ce.Println("   Title: %s", hit.Title)
		}

		ce.Println("   Score: %.2f", hit.Score)

		if len(hit.Fragments) > 0 {
			ce.Println("   ---")

			for _, fragment := range hit.Fragments {
				for line := range strings.SplitSeq(fragment, "\n") {
					if strings.TrimSpace(line) != "" {
						ce.Println("   %s", line)
					}
				}
			}
		}

		ce.Println("")
	}

	return nil
}
