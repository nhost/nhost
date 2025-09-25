package dockercredentials

import (
	"github.com/urfave/cli/v2"
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

func actionErase(c *cli.Context) error {
	_, _ = c.App.Writer.Write([]byte("Please, use the nhost CLI to logout\n"))
	return nil
}
