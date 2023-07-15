package main

import (
	"errors"
	"log"
	"os"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/cmd/config"
	"github.com/nhost/cli/cmd/dev"
	"github.com/nhost/cli/cmd/dockercredentials"
	"github.com/nhost/cli/cmd/project"
	"github.com/nhost/cli/cmd/secrets"
	"github.com/nhost/cli/cmd/software"
	"github.com/nhost/cli/cmd/user"
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
			dev.Command(),
			dev.CommandUp(),
			dev.CommandDown(),
			dev.CommandLogs(),
			dockercredentials.Command(),
			project.CommandInit(),
			project.CommandList(),
			project.CommandLink(),
			secrets.Command(),
			software.Command(),
			user.CommandLogin(),
		},
		Metadata: map[string]any{
			"Author":  "Nhost",
			"LICENSE": "MIT",
		},
		Flags: flags,
	}

	if err := app.Run(os.Args); err != nil {
		var graphqlErr *clientv2.ErrorResponse

		switch {
		case errors.As(err, &graphqlErr):
			log.Fatal(graphqlErr.GqlErrors)
		case err != nil:
			log.Fatal(err)
		}
	}
}
