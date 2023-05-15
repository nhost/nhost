package user

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "user",
		Aliases: []string{},
		Usage:   "Perform user management operations",
		Subcommands: []*cli.Command{
			CommandLogin(),
		},
	}
}
