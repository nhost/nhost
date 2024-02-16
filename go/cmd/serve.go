package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/urfave/cli/v2"
)

const (
	flagAPIPrefix          = "api-prefix"
	flagPort               = "port"
	flagDebug              = "debug"
	flagLogFormatTEXT      = "log-format-text"
	flagTrustedProxies     = "trusted-proxies"
	flagPostgresConnection = "postgres"
	flagNodeServerPath     = "node-server-path"
)

func CommandServe() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "serve",
		Usage: "Serve the application",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagAPIPrefix,
				Usage:    "prefix for all routes",
				Value:    "/v1",
				Category: "server",
				EnvVars:  []string{"AUTH_API_PREFIX"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPort,
				Usage:    "Port to bind to",
				Value:    "4000",
				Category: "server",
				EnvVars:  []string{"AUTH_PORT"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagDebug,
				Usage:    "enable debug logging",
				Category: "general",
				EnvVars:  []string{"DEBUG"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagLogFormatTEXT,
				Usage:    "format logs in plain text",
				Category: "general",
				EnvVars:  []string{"LOG_FORMAT_TEXT"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPostgresConnection,
				Usage:    "Postgres connection string",
				Value:    "postgres://postgres:postgres@localhost:5432/local?sslmode=disable",
				Category: "postgres",
				EnvVars:  []string{"POSTGRES_CONNECTION"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagNodeServerPath,
				Usage:    "Path to the node server",
				Value:    ".",
				Category: "node",
				EnvVars:  []string{"NODE_SERVER_PATH"},
			},
		},
		Action: serve,
	}
}

func getNodeServer(cCtx *cli.Context) *exec.Cmd {
	env := os.Environ()
	found := false
	authPort := strconv.Itoa(cCtx.Int(flagPort) + 1)
	for i, v := range env {
		if strings.HasPrefix(v, "AUTH_PORT=") {
			found = true
			env[i] = "AUTH_PORT=" + authPort
		}
	}
	if !found {
		env = append(env, "AUTH_PORT="+authPort)
	}
	env = append(env, "NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-bundle.crt")
	env = append(env, "PWD="+cCtx.String(flagNodeServerPath))
	env = append(env, "AUTH_VERSION="+cCtx.App.Version)

	cmd := exec.CommandContext(cCtx.Context, "node", "./dist/start.js")
	cmd.Dir = cCtx.String(flagNodeServerPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = env
	return cmd
}

func getGoServer(cCtx *cli.Context, logger *slog.Logger) (*http.Server, error) {
	router := gin.New()

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(api.OpenAPISchema)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI schema: %w", err)
	}
	doc.AddServer(&openapi3.Server{ //nolint:exhaustruct
		URL: cCtx.String(flagAPIPrefix),
	})

	router.Use(
		// ginmiddleware.OapiRequestValidator(doc),
		gin.Recovery(),
		middleware.Logger(logger),
	)

	// auth := &controller.Auth{}
	// handler := api.NewStrictHandler(auth, nil)
	// mw := api.MiddlewareFunc(ginmiddleware.OapiRequestValidator(doc)),

	// api.RegisterHandlersWithOptions(
	// 	router,
	// 	handler,
	// 	api.GinServerOptions{
	// 		BaseURL: cCtx.String(flagAPIPrefix),
	// 		Middlewares: []api.MiddlewareFunc{mw},
	// 		ErrorHandler: nil,
	// 	},
	// )

	nodejsHandler, err := nodejsHandler()
	if err != nil {
		return nil, fmt.Errorf("failed to create nodejs handler: %w", err)
	}
	router.NoRoute(nodejsHandler)

	server := &http.Server{ //nolint:exhaustruct
		Addr:              ":" + cCtx.String(flagPort),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second, //nolint:gomnd
	}

	return server, nil
}

func serve(cCtx *cli.Context) error {
	logger := getLogger(cCtx.Bool(flagDebug), cCtx.Bool(flagLogFormatTEXT))
	logger.Info(cCtx.App.Name + " v" + cCtx.App.Version)
	logFlags(logger, cCtx)

	ctx, cancel := context.WithCancel(cCtx.Context)
	defer cancel()

	nodeServer := getNodeServer(cCtx)
	go func() {
		defer cancel()
		if err := nodeServer.Run(); err != nil {
			logger.Error("node server failed", slog.String("error", err.Error()))
		}
	}()

	server, err := getGoServer(cCtx, logger)
	if err != nil {
		return fmt.Errorf("failed to create server: %w", err)
	}

	go func() {
		defer cancel()
		if err := server.ListenAndServe(); err != nil {
			logger.Error("server failed", slog.String("error", err.Error()))
		}
	}()

	<-ctx.Done()

	logger.Info("shutting down server")
	if err := server.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown server: %w", err)
	}

	return nil
}
