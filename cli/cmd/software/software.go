package software

import "github.com/urfave/cli/v3"

const (
	devVersion = "dev"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "sw",
		Aliases: []string{},
		Usage:   "Perform software management operations",
		Commands: []*cli.Command{
			CommandUninstall(),
			CommandUpgrade(),
			CommandVersion(),
		},
	}
}
