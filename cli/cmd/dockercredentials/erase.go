package dockercredentials

import (
	"context"

	"github.com/urfave/cli/v3"
)

func CommandErase() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "erase",
		Aliases: []string{},
		Hidden:  true,
		Usage:   "This action doesn't do anything",
		Action:  actionErase,
	}
}

func actionErase(ctx context.Context, cmd *cli.Command) error {
	_, _ = cmd.Root().Writer.Write([]byte("Please, use the nhost CLI to logout\n"))
	return nil
}
