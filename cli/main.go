package main

import (
	"context"
	"fmt"
	"log"
	"os"

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
	docs "github.com/urfave/cli-docs/v3"
	"github.com/urfave/cli/v3"
)

var Version string

func main() {
	flags, err := clienv.Flags()
	if err != nil {
		panic(err)
	}

	app := &cli.Command{ //nolint: exhaustruct
		Name:                  "nhost",
		EnableShellCompletion: true,
		Version:               Version,
		Description:           "Nhost CLI tool",
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
			markdownDocs(),
		},
		Metadata: map[string]any{
			"Author":  "Nhost",
			"LICENSE": "MIT",
		},
		Flags: flags,
	}

	if err := app.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

func markdownDocs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "docs",
		Usage: "Generate markdown documentation for the CLI",
		Action: func(_ context.Context, cmd *cli.Command) error {
			md, err := docs.ToMarkdown(cmd.Root())
			if err != nil {
				return cli.Exit("failed to generate markdown documentation: "+err.Error(), 1)
			}

			fmt.Println("---")                        //nolint:forbidigo
			fmt.Println("title: Nhost CLI Reference") //nolint:forbidigo
			fmt.Println("icon: terminal")             //nolint:forbidigo
			fmt.Println("---")                        //nolint:forbidigo
			fmt.Println()                             //nolint:forbidigo
			fmt.Println(md)                           //nolint:forbidigo

			return nil
		},
	}
}
