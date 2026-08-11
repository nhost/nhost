package configserver

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"regexp"

	"github.com/99designs/gqlgen/graphql"
	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nhost/be/services/mimir/graph"
	"github.com/nhost/nhost/cli/cmd/configserver/logsapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli/v3"
)

const (
	bindFlag                    = "bind"
	debugFlag                   = "debug"
	logFormatJSONFlag           = "log-format-json"
	enablePlaygroundFlag        = "enable-playground"
	storageLocalConfigPath      = "storage-local-config-path"
	storageLocalSecretsPath     = "storage-local-secrets-path"
	storageLocalRunServicesPath = "storage-local-run-services-path"
	appIDFlag                   = "app-id"
	dockerComposeProjectEnv     = "DOCKER_COMPOSE_PROJECT"
)

// dashboardOriginRe matches the origins where the CLI-instantiated dashboard
// is reachable. The subdomain segment is intentionally restricted to a single
// DNS label (`[^./]+`) — stricter than traefik's `.+` host-regexp — so that
// only the canonical `<sub>.dashboard.local.nhost.run` (and the bare
// `local.dashboard.nhost.run`) form is credentialed-CORS eligible. An optional
// non-standard HTTP(S) port is permitted.
var dashboardOriginRe = regexp.MustCompile(
	`^https?://([^./]+\.dashboard\.local\.nhost\.run|local\.dashboard\.nhost\.run)(:\d+)?$`,
)

func Command() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:   "configserver",
		Usage:  "serve the application",
		Hidden: true,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     bindFlag,
				Usage:    "bind address",
				Value:    ":8088",
				Category: "server",
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     debugFlag,
				Usage:    "enable debug logging",
				Category: "general",
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     logFormatJSONFlag,
				Usage:    "format logs in JSON",
				Category: "general",
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     enablePlaygroundFlag,
				Usage:    "enable graphql playground (under /v1)",
				Category: "server",
				Sources:  cli.EnvVars("ENABLE_PLAYGROUND"),
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     storageLocalConfigPath,
				Usage:    "Path to the local mimir config file",
				Value:    "/tmp/root/nhost/nhost.toml",
				Category: "plugins",
				Sources:  cli.EnvVars("STORAGE_LOCAL_CONFIG_PATH"),
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     storageLocalSecretsPath,
				Usage:    "Path to the local mimir secrets file",
				Value:    "/tmp/root/.secrets",
				Category: "plugins",
				Sources:  cli.EnvVars("STORAGE_LOCAL_SECRETS_PATH"),
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     storageLocalRunServicesPath,
				Usage:    "Path to the local mimir run services files",
				Category: "plugins",
				Sources:  cli.EnvVars("STORAGE_LOCAL_RUN_SERVICES_PATH"),
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     appIDFlag,
				Usage:    "App ID this configserver instance represents",
				Value:    ZeroUUID,
				Category: "server",
				Sources:  cli.EnvVars("NHOST_APP_ID"),
			},
		},
		Action: serve,
	}
}

func corsMiddleware() (gin.HandlerFunc, error) {
	handler, err := oapimw.CORS(oapimw.CORSOptions{
		AllowOriginFunc: dashboardOriginRe.MatchString,
		AllowedOrigins:  nil,
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
			http.MethodHead,
		},
		// AllowedHeaders: nil reflects the client's Access-Control-Request-Headers,
		// which is the equivalent of "*" under credentialed CORS.
		AllowHeadersFunc:                     nil,
		AllowedHeaders:                       nil,
		ExposedHeaders:                       nil,
		AllowCredentials:                     true,
		MaxAge:                               "",
		UnsafeAllowAllOriginsWithCredentials: false,
	})
	if err != nil {
		return nil, fmt.Errorf("building CORS middleware: %w", err)
	}

	return handler, nil
}

func dummyMiddleware(
	ctx context.Context,
	_ any,
	next graphql.Resolver,
) (any, error) {
	return next(ctx)
}

func dummyMiddleware2(
	ctx context.Context,
	_ any,
	next graphql.Resolver,
	_ []string,
) (any, error) {
	return next(ctx)
}

func runServicesFiles(runServices ...string) map[string]string {
	m := make(map[string]string)

	for _, path := range runServices {
		id := uuid.NewString()
		m[id] = path
	}

	return m
}

func setupLogsAPI(
	r *gin.Engine,
	logger logrus.FieldLogger,
	enablePlayground bool,
	version string,
) error {
	dockerClient, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return fmt.Errorf("failed to create docker client: %w", err)
	}

	projectName := os.Getenv(dockerComposeProjectEnv)
	logGatherer := NewDockerLogGatherer(dockerClient, projectName)

	logsResolver := &logsapi.Resolver{
		LogGatherer: logGatherer,
		Logger:      logger,
	}

	logsapi.AddRoutes(r, "/v1/logs", logsResolver, enablePlayground, version)

	return nil
}

func serve(_ context.Context, cmd *cli.Command) error {
	logger := getLogger(cmd.Bool(debugFlag), cmd.Bool(logFormatJSONFlag))
	logger.Info(cmd.Root().Name + " v" + cmd.Root().Version)
	logFlags(logger, cmd)

	configFile := cmd.String(storageLocalConfigPath)
	secretsFile := cmd.String(storageLocalSecretsPath)
	runServices := runServicesFiles(cmd.StringSlice(storageLocalRunServicesPath)...)

	appID := cmd.String(appIDFlag)
	if _, err := uuid.Parse(appID); err != nil {
		return fmt.Errorf("invalid --%s value %q: %w", appIDFlag, appID, err)
	}

	st := NewLocal(appID, configFile, secretsFile, runServices)

	data, err := st.GetApps(configFile, secretsFile, runServices)
	if err != nil {
		return fmt.Errorf("failed to get data from plugin: %w", err)
	}

	plugins := []graph.Plugin{st}

	resolver, err := graph.NewResolver(graph.NewMapStoreFromData(data), nil, Querier{}, plugins)
	if err != nil {
		return fmt.Errorf("failed to create resolver: %w", err)
	}

	corsHandler, err := corsMiddleware()
	if err != nil {
		return err
	}

	r := graph.SetupRouter(
		"/v1/configserver",
		resolver,
		dummyMiddleware,
		dummyMiddleware2,
		cmd.Bool(enablePlaygroundFlag),
		cmd.Root().Version,
		nil,
		gin.Recovery(),
		corsHandler,
	)

	if err := setupLogsAPI(
		r, logger, cmd.Bool(enablePlaygroundFlag), cmd.Root().Version,
	); err != nil {
		return err
	}

	if err := r.Run(cmd.String(bindFlag)); err != nil {
		return fmt.Errorf("failed to run gin: %w", err)
	}

	return nil
}
