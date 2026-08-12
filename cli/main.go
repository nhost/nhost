package main

import (
	"context"
	"fmt"
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
	"github.com/nhost/nhost/cli/cmd/schema"
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
			dev.CommandAttach(),
			dev.CommandStatus(),
			dockercredentials.Command(),
			mcp.Command(),
			project.CommandInit(),
			project.CommandList(),
			project.CommandLink(),
			nhostdocs.Command(),
			run.Command(),
			schema.Command(),
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
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// docsIntro is the lead paragraph for the generated CLI reference, rendered
// before the Usage section. %s is the root command's name.
const docsIntro = "The `%s` CLI is the primary tool for developing, " +
	"deploying, and managing Nhost projects. It lets you run your backend locally, " +
	"manage configuration and infrastructure as code, link and deploy projects to " +
	"Nhost Cloud, and provide AI assistants with access to your project through the " +
	"built-in MCP server.\n\n" +
	"New here? Head over to [Quickstart](/getting-started/local-development/cli) for CLI installation."

func markdownDocs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "gen-docs",
		Usage: "Generate markdown documentation for the CLI",
		Action: func(_ context.Context, cmd *cli.Command) error {
			intro := fmt.Sprintf(docsIntro, cmd.Root().Name)

			md, err := clidocs.ToMarkdown(cmd.Root(), intro)
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
