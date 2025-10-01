package deployments

import "github.com/urfave/cli/v3"

const flagSubdomain = "subdomain"

func commonFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagSubdomain,
			Usage:   "Project's subdomain to operate on, defaults to linked project",
			Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
		},
	}
}

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "deployments",
		Aliases: []string{},
		Usage:   "Manage deployments",
		Commands: []*cli.Command{
			CommandList(),
			CommandLogs(),
			CommandNew(),
		},
	}
}
