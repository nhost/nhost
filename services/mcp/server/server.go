package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/auth"
	"github.com/nhost/nhost/services/mcp/tools"
	"github.com/urfave/cli/v3"
)

var ErrGraphqlEndpointRequired = errors.New("graphql-endpoint is required")

const (
	FlagListenAddr           = "listen-addr"
	FlagGraphqlEndpoint      = "graphql-endpoint"
	FlagMCPInstructions      = "mcp-instructions"
	FlagQueryInstructions    = "query-instructions"
	FlagMutationInstructions = "mutation-instructions"
	FlagSchemaInstructions   = "schema-instructions"
	FlagAuthURL              = "auth-url"
	FlagRealm                = "realm"
	FlagScopes               = "scopes"

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
				Category: "Auth",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagRealm,
				Usage:    "Realm for WWW-Authenticate header",
				Sources:  cli.EnvVars("MCP_REALM"),
				Category: "Auth",
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:     FlagScopes,
				Usage:    "OAuth2 scopes required by this resource (e.g. openid, graphql)",
				Sources:  cli.EnvVars("MCP_SCOPES"),
				Value:    []string{"openid", "graphql"},
				Category: "Auth",
			},
		},
		Action: action,
	}
}

func BuildServer(cmd *cli.Command) (*mcpserver.MCPServer, error) {
	graphqlEndpoint := cmd.String(FlagGraphqlEndpoint)
	if graphqlEndpoint == "" {
		return nil, ErrGraphqlEndpointRequired
	}

	version := ""
	if cmd.Root() != nil {
		version = cmd.Root().Version
	}

	opts := []mcpserver.ServerOption{}
	if instructions := cmd.String(FlagMCPInstructions); instructions != "" {
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

func action(ctx context.Context, cmd *cli.Command) error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{ //nolint:exhaustruct
		Level: slog.LevelInfo,
	}))

	mcpServer, err := BuildServer(cmd)
	if err != nil {
		return fmt.Errorf("failed to build server: %w", err)
	}

	listenAddr := cmd.String(FlagListenAddr)

	httpHandler, err := buildHTTPHandler(ctx, cmd, mcpServer)
	if err != nil {
		return fmt.Errorf("failed to build HTTP handler: %w", err)
	}

	httpHandler = loggingMiddleware(logger)(httpHandler)

	logger.InfoContext(
		ctx, "starting mcp service",
		slog.String("version", cmd.Root().Version),
		slog.String("addr", listenAddr),
		slog.String("graphql-endpoint", cmd.String(FlagGraphqlEndpoint)),
		slog.String("auth-url", cmd.String(FlagAuthURL)),
	)

	return serve(ctx, logger, listenAddr, httpHandler)
}

func buildHTTPHandler(
	ctx context.Context,
	cmd *cli.Command,
	mcpServer *mcpserver.MCPServer,
) (http.Handler, error) {
	mcpHTTP := mcpserver.NewStreamableHTTPServer(
		mcpServer,
		mcpserver.WithHTTPContextFunc(tools.AuthorizationToContext),
		mcpserver.WithEndpointPath("/"),
	)
	authURL := cmd.String(FlagAuthURL)

	if authURL == "" {
		return mcpHTTP, nil
	}

	a, err := auth.New(ctx, authURL, cmd.String(FlagRealm), cmd.StringSlice(FlagScopes))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize auth: %w", err)
	}

	mux := http.NewServeMux()
	mux.Handle(
		"/.well-known/oauth-protected-resource",
		a.ProtectedResourceHandler(),
	)
	mux.Handle(
		"/.well-known/oauth-authorization-server",
		a.AuthorizationServerHandler(),
	)
	mux.Handle("/", a.Middleware(mcpHTTP))

	return mux, nil
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
