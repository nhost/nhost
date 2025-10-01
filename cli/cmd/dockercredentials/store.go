package dockercredentials

import (
	"context"

	"github.com/urfave/cli/v3"
)

func CommandStore() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "store",
		Aliases: []string{},
		Hidden:  true,
		Usage:   "This action doesn't do anything",
		Action:  actionStore,
	}
}

func actionStore(ctx context.Context, cmd *cli.Command) error {
	_, _ = cmd.Root().Writer.Write([]byte("Please, use the nhost CLI to login\n"))
	return nil
}
