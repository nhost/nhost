package main

import (
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/cmd/configserver"
	"github.com/nhost/nhost/cli/cmd/deployments"
	"github.com/nhost/nhost/cli/cmd/dev"
	"github.com/nhost/nhost/cli/cmd/dockercredentials"
	"github.com/nhost/nhost/cli/cmd/project"
	"github.com/nhost/nhost/cli/cmd/run"
	"github.com/nhost/nhost/cli/cmd/secrets"
	"github.com/nhost/nhost/cli/cmd/software"
	"github.com/nhost/nhost/cli/cmd/user"
	"github.com/urfave/cli/v2"
)

var Version string

func main() {
	flags, err := clienv.Flags()
	if err != nil {
		panic(err)
	}

	app := &cli.App{ //nolint: exhaustruct
		Name:                 "nhost",
		EnableBashCompletion: true,
		Version:              Version,
		Description:          "Nhost CLI tool",
		Commands: []*cli.Command{
			config.Command(),
			configserver.Command(),
			deployments.Command(),
			dev.Command(),
			dev.CommandUp(),
			dev.CommandDown(),
			dev.CommandLogs(),
			dockercredentials.Command(),
			project.CommandInit(),
			project.CommandList(),
			project.CommandLink(),
			run.Command(),
			secrets.Command(),
			software.Command(),
			user.CommandLogin(),
			{
				Name:   "docs",
				Hidden: true,
				Action: func(ctx *cli.Context) error {
					s, err := ctx.App.ToMarkdown()
					if err != nil {
						return fmt.Errorf("failed to generate docs: %w", err)
					}
					fmt.Println(s) //nolint:forbidigo
					return nil
				},
			},
		},
		Metadata: map[string]any{
			"Author":  "Nhost",
			"LICENSE": "MIT",
		},
		Flags: flags,
	}

	if err := app.Run(os.Args); err != nil {
		var graphqlErr *clientv2.ErrorResponse

		if errors.As(err, &graphqlErr) {
			log.Fatal(graphqlErr.GqlErrors)
		}

		log.Fatal(err)
	}
}
