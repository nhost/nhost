package secrets

import "github.com/urfave/cli/v2"

const flagSubdomain = "subdomain"

func commonFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagSubdomain,
			Usage:   "Project's subdomain to operate on, defaults to linked project",
			EnvVars: []string{"NHOST_SUBDOMAIN"},
		},
	}
}

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "secrets",
		Aliases: []string{},
		Usage:   "Manage secrets",
		Subcommands: []*cli.Command{
			CommandCreate(),
			CommandDelete(),
			CommandList(),
			CommandUpdate(),
		},
	}
}
