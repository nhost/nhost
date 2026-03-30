package start

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/config"
	"github.com/nhost/nhost/cli/mcp/resources"
	"github.com/nhost/nhost/cli/mcp/tools/cloud"
	"github.com/nhost/nhost/cli/mcp/tools/docs"
	"github.com/nhost/nhost/cli/mcp/tools/project"
	"github.com/nhost/nhost/cli/mcp/tools/schemas"
	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

const (
	flagNhostGraphqlURL = "nhost-graphql-url"
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
				Name:     flagNhostGraphqlURL,
				Usage:    "Nhost GraphQL URL",
				Hidden:   true,
				Value:    "https://otsispdzcwxyqzbfntmj.graphql.eu-central-1.nhost.run/v1",
				Category: "Cloud Platform",
				Sources:  cli.EnvVars("NHOST_GRAPHQL_URL"),
			},
		},
		Action: action,
	}
}

// BuildServer creates and configures an MCP server from the parsed CLI command.
func BuildServer(ctx context.Context, cmd *cli.Command) (*server.MCPServer, error) {
	cfg, err := getConfig(cmd)
	if err != nil {
		return nil, err
	}

	serverInstructions := ServerInstructions
	serverInstructions += "\n\n"
	serverInstructions += cfg.Projects.Instructions()
	serverInstructions += "\n"
	serverInstructions += resources.Instructions()

	mcpServer := server.NewMCPServer(
		cmd.Root().Name,
		cmd.Root().Version,
		server.WithInstructions(serverInstructions),
	)

	if err := resources.Register(cfg, mcpServer); err != nil {
		return nil, fmt.Errorf("failed to register resources: %w", err)
	}

	if cfg.Cloud != nil {
		if err := registerCloud(
			ctx,
			cmd,
			mcpServer,
			cfg,
			cmd.String(flagNhostGraphqlURL),
		); err != nil {
			return nil, fmt.Errorf("failed to register cloud tools: %w", err)
		}
	}

	if len(cfg.Projects) > 0 {
		if err := registerProjectTool(mcpServer, cfg); err != nil {
			return nil, fmt.Errorf("failed to register project tools: %w", err)
		}
	}

	schemasTool := schemas.NewTool(cfg)
	schemasTool.Register(mcpServer)

	docs.NewTool().Register(mcpServer)

	return mcpServer, nil
}

func action(ctx context.Context, cmd *cli.Command) error {
	mcpServer, err := BuildServer(ctx, cmd)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to build server: %v", err), 1)
	}

	if err := server.ServeStdio(mcpServer); err != nil {
		return cli.Exit(fmt.Sprintf("failed to serve stdio: %v", err), 1)
	}

	return nil
}

func getConfig(cmd *cli.Command) (*config.Config, error) {
	configPath := config.GetConfigPath(cmd)
	if configPath == "" {
		return nil, cli.Exit("config file path is required", 1)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return config.DefaultConfig(), nil
		}

		fmt.Println("Please, run `nhost mcp config` to configure the service.") //nolint:forbidigo

		return nil, cli.Exit("failed to load config file "+err.Error(), 1)
	}

	return cfg, nil
}

func buildInterceptor(
	ctx context.Context,
	ce *clienv.CliEnv,
) (func(ctx context.Context, req *http.Request) error, error) {
	if pat := ce.PAT(); pat != "" {
		cl, err := ce.NewAuthClient()
		if err != nil {
			return nil, fmt.Errorf("failed to create auth client: %w", err)
		}

		return nhostclient.WithPAT(cl, pat), nil
	}

	creds, err := ce.Credentials()
	if err != nil {
		return nil, fmt.Errorf("failed to load credentials: %w", err)
	}

	metadata, err := ce.FetchOAuth2Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	return nhostclient.WithOAuth2RefreshToken(
		auth.NewRotatingTokenSource(
			ctx,
			metadata.TokenEndpoint,
			ce.OAuth2ClientID(),
			creds.RefreshToken,
		),
	), nil
}

func registerCloud(
	ctx context.Context,
	cmd *cli.Command,
	mcpServer *server.MCPServer,
	cfg *config.Config,
	graphqlURL string,
) error {
	ce := clienv.FromCLI(cmd)

	interceptor, err := buildInterceptor(ctx, ce)
	if err != nil {
		return err
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
