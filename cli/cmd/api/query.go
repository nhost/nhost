package api

import (
	"context"
	"fmt"

	"github.com/urfave/cli/v3"
)

const (
	flagVariables     = "variables"
	flagWithMutations = "with-mutations"
)

func CommandQuery() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name: "query",
		Usage: "Send a query, or a mutation with --with-mutations, to the Nhost Cloud API " +
			"and print its data as JSON",
		ArgsUsage: "<document>",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagVariables,
				Usage: "GraphQL variables as one JSON object",
				Value: "{}",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagWithMutations,
				Usage: "Allow mutations; they run as-is with your permissions",
			},
		},
		Action: commandQuery,
	}
}

func commandQuery(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 1 {
		return fmt.Errorf("%w: expected one GraphQL document", errInvalidArgs)
	}

	variables, err := parseVariables(cmd.String(flagVariables))
	if err != nil {
		return fmt.Errorf("failed to parse variables: %w", err)
	}

	mutations := []string{}
	if cmd.Bool(flagWithMutations) {
		mutations = []string{"*"}
	}

	return execute(
		ctx, cmd, cmd.Args().First(), variables, []string{"*"}, mutations,
		"nhost api query sends mutations only with --with-mutations. "+
			"Subscriptions are not supported.",
	)
}
