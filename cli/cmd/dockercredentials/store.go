package dockercredentials

import (
	"github.com/urfave/cli/v2"
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

func actionStore(c *cli.Context) error {
	_, _ = c.App.Writer.Write([]byte("Please, use the nhost CLI to login\n"))
	return nil
}
