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
	nhostdocs "github.com/nhost/nhost/cli/cmd/docs"
	"github.com/nhost/nhost/cli/cmd/mcp"
	"github.com/nhost/nhost/cli/cmd/project"
	"github.com/nhost/nhost/cli/cmd/run"
	"github.com/nhost/nhost/cli/cmd/secrets"
	"github.com/nhost/nhost/cli/cmd/software"
	"github.com/nhost/nhost/cli/cmd/user"
	"github.com/nhost/nhost/internal/lib/clidocs"
	"github.com/urfave/cli/v3"
)

var Version = "0.0.0-dev"

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
			mcp.Command(),
			project.CommandInit(),
			project.CommandList(),
			project.CommandLink(),
			nhostdocs.Command(),
			run.Command(),
			secrets.Command(),
			software.Command(),
			user.CommandLogin(),
			markdownDocs(),
			jsonDocs(),
		},
		Metadata: map[string]any{
			"Author":  "Nhost",
			"LICENSE": "MIT",
		},
		Flags: flags,
	}

	if err := clidocs.ApplyHints(app, agentHints); err != nil {
		log.Fatal(err)
	}

	if err := app.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

func jsonDocs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:   "gen-json-docs",
		Usage:  "Generate a structured JSON description of all CLI commands and flags",
		Hidden: true,
		Action: func(_ context.Context, cmd *cli.Command) error {
			b, err := clidocs.ToJSON(cmd.Root())
			if err != nil {
				return cli.Exit("failed to generate json schema: "+err.Error(), 1)
			}
			fmt.Println(string(b)) //nolint:forbidigo
			return nil
		},
	}
}

func markdownDocs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "gen-docs",
		Usage: "Generate markdown documentation for the CLI",
		Action: func(_ context.Context, cmd *cli.Command) error {
			md, err := clidocs.ToMarkdown(cmd.Root())
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
