package storage

import "github.com/urfave/cli/v3"

func CommandSeed() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "seed",
		Aliases: []string{},
		Usage:   "Manage storage seed snapshots",
		Commands: []*cli.Command{
			CommandCreate(),
			CommandApply(),
		},
	}
}
