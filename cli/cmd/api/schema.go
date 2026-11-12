package api

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/urfave/cli/v3"
)

func CommandSchema() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:   "schema",
		Usage:  "Print the Nhost Cloud schema as introspection JSON",
		Action: commandSchema,
	}
}

func commandSchema(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 0 {
		return fmt.Errorf("%w: schema takes none", errInvalidArgs)
	}

	return execute(ctx, cmd, graphql.IntrospectionQuery, nil, []string{"*"}, nil, "")
}
