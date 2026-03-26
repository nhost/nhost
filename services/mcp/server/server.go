package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/tools"
	"github.com/urfave/cli/v3"
)

var ErrGraphqlEndpointRequired = errors.New("graphql-endpoint is required")

const (
	FlagListenAddr         = "listen-addr"
	FlagGraphqlEndpoint    = "graphql-endpoint"
	FlagMCPInstructions    = "mcp-instructions"
	FlagQueryInstructions  = "query-instructions"
	FlagSchemaInstructions = "schema-instructions"

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
				Name:     FlagSchemaInstructions,
				Usage:    "Instructions for the get-schema tool",
				Sources:  cli.EnvVars("MCP_SCHEMA_INSTRUCTIONS"),
				Category: "MCP",
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
		cmd.String(FlagSchemaInstructions),
	)
	t.RegisterQuery(mcpServer)
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
	httpServer := mcpserver.NewStreamableHTTPServer(mcpServer)

	logger.InfoContext(
		ctx, "starting mcp service",
		slog.String("version", cmd.Root().Version),
		slog.String("addr", listenAddr),
		slog.String("graphql-endpoint", cmd.String(FlagGraphqlEndpoint)),
	)

	ctx, cancel := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	errCh := make(chan error, 1)

	go func() {
		errCh <- httpServer.Start(listenAddr)
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

		if err := httpServer.Shutdown(shutdownCtx); err != nil { //nolint:contextcheck
			return fmt.Errorf("failed to shutdown server: %w", err)
		}

		return nil
	}
}
