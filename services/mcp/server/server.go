package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	mcpserver "github.com/mark3labs/mcp-go/server"
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
	FlagBrowserHTMLPath      = "browser-html-path"

	shutdownTimeout = 5 * time.Second
)

func Command(version string) *cli.Command { //nolint:funlen
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
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     FlagBrowserHTMLPath,
				Usage:    "Path to an HTML file to serve when a browser visits the service URL",
				Sources:  cli.EnvVars("MCP_BROWSER_HTML_PATH"),
				Category: "Server",
			},
		},
		Action: action,
	}
}

func BuildServer(
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

func action(ctx context.Context, cmd *cli.Command) error {
	logger := getLogger(cmd.Bool(FlagDebug), cmd.Bool(FlagLogFormatTEXT))

	logFlags(ctx, logger, cmd)

	mcpServer, err := BuildServer(cmd)
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

	browserMiddleware, err := browserRedirectMiddleware(
		cmd.String(FlagBrowserHTMLPath),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize browser middleware: %w", err)
	}

	router.POST("/", authMiddleware, mcpHandler)
	router.GET("/", browserMiddleware, authMiddleware, mcpHandler)
	router.DELETE("/", authMiddleware, mcpHandler)

	return router, nil
}

const defaultBrowserHTML = `<!DOCTYPE html>
<html>
<head><title>Nhost MCP Service</title></head>
<body>
<h1>Nhost MCP Service</h1>
<p>This is an MCP (Model Context Protocol) endpoint designed for AI assistants, not for browsers.</p>
<p>To use this service, connect an MCP-compatible client with proper authentication.</p>
</body>
</html>`

// IsBrowserRequest returns true if the request appears to come from a web
// browser rather than an MCP client. It checks for GET requests whose Accept
// header contains "text/html".
func IsBrowserRequest(r *http.Request) bool {
	if r.Method != http.MethodGet {
		return false
	}

	accept := r.Header.Get("Accept")

	return strings.Contains(accept, "text/html")
}

func browserRedirectMiddleware(htmlPath string) (gin.HandlerFunc, error) {
	var body []byte

	if htmlPath != "" {
		content, err := os.ReadFile(htmlPath)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to read browser HTML file %s: %w",
				htmlPath,
				err,
			)
		}

		body = content
	} else {
		body = []byte(defaultBrowserHTML)
	}

	return func(c *gin.Context) {
		if IsBrowserRequest(c.Request) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", body)
			c.Abort()

			return
		}

		c.Next()
	}, nil
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
