package start

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
	"github.com/nhost/nhost/cli/mcp/tools/cloud"
	"github.com/nhost/nhost/cli/mcp/tools/docs"
	"github.com/nhost/nhost/cli/mcp/tools/local"
	"github.com/nhost/nhost/cli/mcp/tools/project"
	"github.com/urfave/cli/v3"
)

const (
	flagConfigFile      = "config-file"
	flagNhostAuthURL    = "nhost-auth-url"
	flagNhostGraphqlURL = "nhost-graphql-url"
	flagBind            = "bind"
)

const (
	// this seems to be largely ignored by clients, or at least by cursor.
	// we also need to look into roots and resources as those might be helpful.
	ServerInstructions = `
		This is an MCP server to interact with Nhost Cloud and with projects running on it and
		also with Nhost local development projects.

		Important notes to anyone using this MCP server. Do not use this MCP server without
		following these instructions:

		1. Make sure you are clear on which environment the user wants to operate against.
		2. Before attempting to call any tool *-graphql-query, always get the schema using the
		   *-get-graphql-schema tool
		3. Apps and projects are the same and while users may talk about projects in the GraphQL
		  api those are referred as apps.
		4. IDs are always UUIDs so if you have anything else (like an app/project name) you may need
		   to first get the ID using the *-graphql-query tool.
		5. If you have an error querying the GraphQL API, please check the schema again. The schema may
		   have changed and the query you are using may be invalid.
	`
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "start",
		Usage: "Starts the MCP server",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfigFile,
				Usage:   "Path to the config file",
				Value:   config.GetConfigPath(),
				Sources: cli.EnvVars("CONFIG_FILE"),
			},
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

func action(ctx context.Context, cmd *cli.Command) error {
	cfg, err := getConfig(cmd)
	if err != nil {
		return err
	}

	mcpServer := server.NewMCPServer(
		cmd.Root().Name,
		cmd.Root().Version,
		server.WithInstructions(ServerInstructions),
	)

	if cfg.Cloud != nil {
		if err := registerCloud(
			mcpServer,
			cfg,
			cmd.String(flagNhostAuthURL),
			cmd.String(flagNhostGraphqlURL),
		); err != nil {
			return cli.Exit(fmt.Sprintf("failed to register cloud tools: %s", err), 1)
		}
	}

	if cfg.Local != nil {
		if err := registerLocal(mcpServer, cfg); err != nil {
			return cli.Exit(fmt.Sprintf("failed to register local tools: %s", err), 1)
		}
	}

	if len(cfg.Projects) > 0 {
		if err := registerProjectTool(mcpServer, cfg); err != nil {
			return cli.Exit(fmt.Sprintf("failed to register project tools: %s", err), 1)
		}
	}

	d, err := docs.NewTool(ctx)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to initialize docs tools: %s", err), 1)
	}

	d.Register(mcpServer)

	return start(mcpServer, cmd.String(flagBind))
}

func getConfig(cmd *cli.Command) (*config.Config, error) {
	configPath := cmd.String(flagConfigFile)
	if configPath == "" {
		return nil, cli.Exit("config file path is required", 1)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Println("Please, run `mcp-nhost config` to configure the service.") //nolint:forbidigo
		return nil, cli.Exit("failed to load config file "+err.Error(), 1)
	}

	return cfg, nil
}

func registerCloud(
	mcpServer *server.MCPServer,
	cfg *config.Config,
	authURL string,
	graphqlURL string,
) error {
	interceptor, err := auth.WithPAT(
		authURL,
		cfg.Cloud.PAT,
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

func registerLocal(
	mcpServer *server.MCPServer,
	cfg *config.Config,
) error {
	interceptor := auth.WithAdminSecret(cfg.Local.AdminSecret)

	localTool := local.NewTool(
		*cfg.Local.GraphqlURL,
		*cfg.Local.ConfigServerURL,
		interceptor,
	)
	if err := localTool.Register(mcpServer); err != nil {
		return fmt.Errorf("failed to register tools: %w", err)
	}

	return nil
}

func registerProjectTool(
	mcpServer *server.MCPServer,
	cfg *config.Config,
) error {
	projectTool, err := project.NewTool(cfg.Projects)
	if err != nil {
		return fmt.Errorf("failed to initialize tool: %w", err)
	}

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
