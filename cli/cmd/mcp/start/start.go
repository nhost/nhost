package start

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
	"github.com/nhost/nhost/cli/mcp/resources"
	"github.com/nhost/nhost/cli/mcp/tools/cloud"
	"github.com/nhost/nhost/cli/mcp/tools/docs"
	"github.com/nhost/nhost/cli/mcp/tools/project"
	"github.com/nhost/nhost/cli/mcp/tools/schemas"
	"github.com/urfave/cli/v3"
)

const (
	flagNhostAuthURL    = "nhost-auth-url"
	flagNhostGraphqlURL = "nhost-graphql-url"
	flagBind            = "bind"
)

const (
	// ServerInstructions
	// this seems to be largely ignored by clients, or at least by cursor.
	// we also need to look into roots and resources as those might be helpful.
	ServerInstructions = `
This is an MCP server to interact with the Nhost Cloud and with Nhost projects.

Important notes to anyone using this MCP server. Do not use this MCP server without
following these instructions:

1. Make sure you are clear on which environment the user wants to operate against.
2. Before attempting to call any tool, always make sure you list resources, roots, and
   resource templates to understand what is available.
3. Apps and projects are the same and while users may talk about projects in Nhost's GraphQL
   api those are referred as apps.
4. If you have an error querying the GraphQL API, please check the schema again. The schema may
   have changed and the query you are using may be invalid.
5. Always follow the instructions provided by each tool. If you need to deviate from these
   instructions, please, confirm with the user before doing so.
`
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "start",
		Usage: "Starts the MCP server",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagNhostAuthURL,
				Usage:    "Nhost auth URL",
				Hidden:   true,
				Value:    "https://otsispdzcwxyqzbfntmj.auth.eu-central-1.nhost.run/v1",
				Category: "Cloud Platform",
				Sources:  cli.EnvVars("NHOST_AUTH_URL"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagNhostGraphqlURL,
				Usage:    "Nhost GraphQL URL",
				Hidden:   true,
				Value:    "https://otsispdzcwxyqzbfntmj.graphql.eu-central-1.nhost.run/v1",
				Category: "Cloud Platform",
				Sources:  cli.EnvVars("NHOST_GRAPHQL_URL"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagBind,
				Usage:    "Bind address in the form $host:$port. If omitted use stdio",
				Required: false,
				Category: "General",
				Sources:  cli.EnvVars("BIND"),
			},
		},
		Action: action,
	}
}

func action(_ context.Context, cmd *cli.Command) error {
	cfg, err := getConfig(cmd)
	if err != nil {
		return err
	}

	ServerInstructions := ServerInstructions
	ServerInstructions += "\n\n"
	ServerInstructions += cfg.Projects.Instructions()
	ServerInstructions += "\n"
	ServerInstructions += resources.Instructions()

	mcpServer := server.NewMCPServer(
		cmd.Root().Name,
		cmd.Root().Version,
		server.WithInstructions(ServerInstructions),
	)

	if err := resources.Register(cfg, mcpServer); err != nil {
		return cli.Exit(fmt.Sprintf("failed to register resources: %s", err), 1)
	}

	if cfg.Cloud != nil {
		if err := registerCloud(
			cmd,
			mcpServer,
			cfg,
			cmd.String(flagNhostAuthURL),
			cmd.String(flagNhostGraphqlURL),
		); err != nil {
			return cli.Exit(fmt.Sprintf("failed to register cloud tools: %s", err), 1)
		}
	}

	if len(cfg.Projects) > 0 {
		if err := registerProjectTool(mcpServer, cfg); err != nil {
			return cli.Exit(fmt.Sprintf("failed to register project tools: %s", err), 1)
		}
	}

	resources := schemas.NewTool(cfg)
	resources.Register(mcpServer)

	docs.NewTool().Register(mcpServer)

	return start(mcpServer, cmd.String(flagBind))
}

func getConfig(cmd *cli.Command) (*config.Config, error) {
	configPath := config.GetConfigPath(cmd)
	if configPath == "" {
		return nil, cli.Exit("config file path is required", 1)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Println("Please, run `nhost mcp config` to configure the service.") //nolint:forbidigo
		return nil, cli.Exit("failed to load config file "+err.Error(), 1)
	}

	return cfg, nil
}

func registerCloud(
	cmd *cli.Command,
	mcpServer *server.MCPServer,
	cfg *config.Config,
	authURL string,
	graphqlURL string,
) error {
	ce := clienv.FromCLI(cmd)

	creds, err := ce.Credentials()
	if err != nil {
		return fmt.Errorf("failed to load credentials: %w", err)
	}

	interceptor, err := auth.WithPAT(
		authURL,
		creds.PersonalAccessToken,
	)
	if err != nil {
		return fmt.Errorf("failed to create PAT interceptor: %w", err)
	}

	cloudTool := cloud.NewTool(
		graphqlURL, cfg.Cloud.EnableMutations, interceptor,
	)

	if err := cloudTool.Register(mcpServer); err != nil {
		return fmt.Errorf("failed to register tools: %w", err)
	}

	return nil
}

func registerProjectTool(
	mcpServer *server.MCPServer,
	cfg *config.Config,
) error {
	projectTool := project.NewTool(cfg)
	if err := projectTool.Register(mcpServer); err != nil {
		return fmt.Errorf("failed to register tool: %w", err)
	}

	return nil
}

func start(
	mcpServer *server.MCPServer,
	bind string,
) error {
	if bind != "" {
		sseServer := server.NewSSEServer(mcpServer, server.WithBaseURL(bind))
		if err := sseServer.Start(bind); err != nil {
			return cli.Exit(fmt.Sprintf("failed to serve tcp: %v", err), 1)
		}
	} else {
		if err := server.ServeStdio(mcpServer); err != nil {
			return cli.Exit(fmt.Sprintf("failed to serve stdio: %v", err), 1)
		}
	}

	return nil
}
