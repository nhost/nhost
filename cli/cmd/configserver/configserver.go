package configserver

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nhost/be/services/mimir/graph"
	cors "github.com/rs/cors/wrapper/gin"
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
		},
		Action: serve,
	}
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

func serve(_ context.Context, cmd *cli.Command) error {
	logger := getLogger(cmd.Bool(debugFlag), cmd.Bool(logFormatJSONFlag))
	logger.Info(cmd.Root().Name + " v" + cmd.Root().Version)
	logFlags(logger, cmd)

	configFile := cmd.String(storageLocalConfigPath)
	secretsFile := cmd.String(storageLocalSecretsPath)
	runServices := runServicesFiles(cmd.StringSlice(storageLocalRunServicesPath)...)

	st := NewLocal(configFile, secretsFile, runServices)

	data, err := st.GetApps(configFile, secretsFile, runServices)
	if err != nil {
		return fmt.Errorf("failed to get data from plugin: %w", err)
	}

	plugins := []graph.Plugin{st}

	resolver, err := graph.NewResolver(data, Querier{}, plugins)
	if err != nil {
		return fmt.Errorf("failed to create resolver: %w", err)
	}

	r := graph.SetupRouter(
		"/v1/configserver",
		resolver,
		dummyMiddleware,
		dummyMiddleware2,
		cmd.Bool(enablePlaygroundFlag),
		cmd.Root().Version,
		[]graphql.FieldMiddleware{},
		gin.Recovery(),
		cors.Default(),
	)
	if err := r.Run(cmd.String(bindFlag)); err != nil {
		return fmt.Errorf("failed to run gin: %w", err)
	}

	return nil
}
