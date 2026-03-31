package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/graphql"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/mcp/auth"
	"github.com/nhost/nhost/services/mcp/tools"
	"github.com/urfave/cli/v3"
)

var ErrGraphqlEndpointRequired = errors.New("graphql-endpoint is required")

const (
	FlagListenAddr           = "listen-addr"
	FlagDebug                = "debug"
	FlagLogFormatTEXT        = "log-format-text"
	FlagGraphqlEndpoint      = "graphql-endpoint"
	FlagMCPInstructions      = "mcp-instructions"
	FlagQueryInstructions    = "query-instructions"
	FlagMutationInstructions = "mutation-instructions"
	FlagSchemaInstructions   = "schema-instructions"
	FlagAuthURL              = "auth-url"
	FlagRealm                = "realm"
	FlagEnforceRole          = "enforce-role"

	shutdownTimeout = 5 * time.Second
)

func Command(version string) *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "mcp",
		Version: version,
		Usage:   "Nhost MCP Service - GraphQL tools over HTTP",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagListenAddr,
				Usage:    "HTTP listen address",
				Value:    ":3000",
				Sources:  cli.EnvVars("MCP_LISTEN_ADDR"),
				Category: "Server",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     FlagDebug,
				Usage:    "Enable debug logging",
				Sources:  cli.EnvVars("MCP_DEBUG"),
				Category: "Server",
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     FlagLogFormatTEXT,
				Usage:    "Format logs in plain text instead of JSON",
				Sources:  cli.EnvVars("MCP_LOG_FORMAT_TEXT"),
				Category: "Server",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagGraphqlEndpoint,
				Usage:    "GraphQL endpoint URL",
				Required: true,
				Sources:  cli.EnvVars("MCP_GRAPHQL_ENDPOINT"),
				Category: "GraphQL",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagMCPInstructions,
				Usage:    "Server-level MCP instructions",
				Sources:  cli.EnvVars("MCP_INSTRUCTIONS"),
				Category: "MCP",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagQueryInstructions,
				Usage:    "Instructions for the graphql-query tool",
				Sources:  cli.EnvVars("MCP_QUERY_INSTRUCTIONS"),
				Category: "MCP",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagMutationInstructions,
				Usage:    "Instructions for the graphql-mutation tool",
				Sources:  cli.EnvVars("MCP_MUTATION_INSTRUCTIONS"),
				Category: "MCP",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagSchemaInstructions,
				Usage:    "Instructions for the get-schema tool",
				Sources:  cli.EnvVars("MCP_SCHEMA_INSTRUCTIONS"),
				Category: "MCP",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagAuthURL,
				Usage:    "OAuth2 authorization server URL (enables authentication)",
				Sources:  cli.EnvVars("MCP_AUTH_URL"),
				Required: true,
				Category: "Auth",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagRealm,
				Usage:    "Realm for WWW-Authenticate header",
				Sources:  cli.EnvVars("MCP_REALM"),
				Category: "Auth",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagEnforceRole,
				Usage:    "Enforce that the JWT's default Hasura role matches this value",
				Sources:  cli.EnvVars("MCP_ENFORCE_ROLE"),
				Category: "Auth",
			},
		},
		Action: action,
	}
}

func BuildServer(
	ctx context.Context,
	logger *slog.Logger,
	cmd *cli.Command,
) (*mcpserver.MCPServer, error) {
	graphqlEndpoint := cmd.String(FlagGraphqlEndpoint)
	if graphqlEndpoint == "" {
		return nil, ErrGraphqlEndpointRequired
	}

	version := ""
	if cmd.Root() != nil {
		version = cmd.Root().Version
	}

	instructions := cmd.String(FlagMCPInstructions)

	schemaSummary, err := fetchSchemaSummary(ctx, graphqlEndpoint)
	if err != nil {
		logger.WarnContext(
			ctx,
			"failed to fetch schema summary for instructions",
			slog.String("error", err.Error()),
		)
	} else {
		if instructions != "" {
			instructions += "\n\n"
		}

		instructions += "## Schema\n\n" + schemaSummary
	}

	opts := []mcpserver.ServerOption{}
	if instructions != "" {
		opts = append(opts, mcpserver.WithInstructions(instructions))
	}

	mcpServer := mcpserver.NewMCPServer("mcp", version, opts...)

	t := tools.NewTool(
		graphqlEndpoint,
		cmd.String(FlagQueryInstructions),
		cmd.String(FlagMutationInstructions),
		cmd.String(FlagSchemaInstructions),
	)
	t.RegisterQuery(mcpServer)
	t.RegisterMutation(mcpServer)
	t.RegisterSchema(mcpServer)

	return mcpServer, nil
}

func fetchSchemaSummary(
	ctx context.Context,
	graphqlEndpoint string,
) (string, error) {
	var introspection graphql.ResponseIntrospection
	if err := graphql.Query(
		ctx,
		graphqlEndpoint,
		graphql.IntrospectionQuery,
		nil,
		&introspection,
		[]string{"*"},
		nil,
	); err != nil {
		return "", fmt.Errorf("introspection query failed: %w", err)
	}

	return graphql.SummarizeSchema(introspection), nil
}

func action(ctx context.Context, cmd *cli.Command) error {
	logger := getLogger(cmd.Bool(FlagDebug), cmd.Bool(FlagLogFormatTEXT))

	logFlags(ctx, logger, cmd)

	mcpServer, err := BuildServer(ctx, logger, cmd)
	if err != nil {
		return fmt.Errorf("failed to build server: %w", err)
	}

	listenAddr := cmd.String(FlagListenAddr)

	router, err := buildRouter(ctx, cmd, mcpServer, logger)
	if err != nil {
		return fmt.Errorf("failed to build router: %w", err)
	}

	return serve(ctx, logger, listenAddr, router)
}

func buildRouter(
	ctx context.Context,
	cmd *cli.Command,
	mcpServer *mcpserver.MCPServer,
	logger *slog.Logger,
) (*gin.Engine, error) {
	mcpHTTP := mcpserver.NewStreamableHTTPServer(
		mcpServer,
		mcpserver.WithHTTPContextFunc(tools.AuthorizationToContext),
	)

	router := gin.New()
	router.Use(
		gin.Recovery(),
		middleware.Logger(logger), //nolint:contextcheck
	)

	mcpHandler := gin.WrapH(mcpHTTP)

	a, err := auth.New(
		ctx,
		cmd.String(FlagAuthURL),
		cmd.String(FlagRealm),
		cmd.String(FlagEnforceRole),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize auth: %w", err)
	}

	router.GET(
		"/.well-known/oauth-protected-resource",
		a.ProtectedResourceHandler(),
	)
	router.GET(
		"/.well-known/oauth-authorization-server",
		a.AuthorizationServerHandler(),
	)

	authMiddleware := a.Middleware() //nolint:contextcheck
	router.POST("/", authMiddleware, mcpHandler)
	router.GET("/", authMiddleware, mcpHandler)
	router.DELETE("/", authMiddleware, mcpHandler)

	return router, nil
}

func serve(
	ctx context.Context,
	logger *slog.Logger,
	listenAddr string,
	handler http.Handler,
) error {
	const readHeaderTimeout = 10 * time.Second

	httpSrv := &http.Server{ //nolint:exhaustruct
		Addr:              listenAddr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
	}

	ctx, cancel := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	errCh := make(chan error, 1)

	go func() {
		errCh <- httpSrv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-ctx.Done():
		logger.InfoContext(ctx, "shutting down mcp service")

		shutdownCtx, shutdownCancel := context.WithTimeout(
			context.Background(), shutdownTimeout,
		)
		defer shutdownCancel()

		if err := httpSrv.Shutdown(shutdownCtx); err != nil { //nolint:contextcheck
			return fmt.Errorf("failed to shutdown server: %w", err)
		}

		return nil
	}
}
