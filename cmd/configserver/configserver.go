package configserver

import (
	"context"
	"fmt"
	"os"

	"github.com/99designs/gqlgen/graphql"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nhost/be/services/mimir/graph"
	"github.com/urfave/cli/v2"
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
				EnvVars:  []string{"ENABLE_PLAYGROUND"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     storageLocalConfigPath,
				Usage:    "Path to the local mimir config file",
				Value:    "/tmp/config.toml",
				Category: "plugins",
				EnvVars:  []string{"STORAGE_LOCAL_CONFIG_PATH"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     storageLocalSecretsPath,
				Usage:    "Path to the local mimir secrets file",
				Value:    "/tmp/secrets.toml",
				Category: "plugins",
				EnvVars:  []string{"STORAGE_LOCAL_SECRETS_PATH"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     storageLocalRunServicesPath,
				Usage:    "Path to the local mimir run services files",
				Category: "plugins",
				EnvVars:  []string{"STORAGE_LOCAL_RUN_SERVICES_PATH"},
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

func runServicesFiles(runServices ...string) (map[string]*os.File, error) {
	m := make(map[string]*os.File)
	for _, path := range runServices {
		id := uuid.NewString()
		f, err := os.OpenFile(path, os.O_RDWR, 0o644) //nolint:gomnd
		if err != nil {
			return nil, fmt.Errorf("failed to open run service file: %w", err)
		}
		m[id] = f
	}

	return m, nil
}

func serve(cCtx *cli.Context) error {
	logger := getLogger(cCtx.Bool(debugFlag), cCtx.Bool(logFormatJSONFlag))
	logger.Info(cCtx.App.Name + " v" + cCtx.App.Version)
	logFlags(logger, cCtx)

	c, err := os.OpenFile(cCtx.String(storageLocalConfigPath), os.O_RDWR, 0o644) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("failed to open config file: %w", err)
	}
	defer c.Close()

	s, err := os.OpenFile(cCtx.String(storageLocalSecretsPath), os.O_RDWR, 0o644) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("failed to open secrets file: %w", err)
	}
	defer s.Close()

	runServices, err := runServicesFiles(cCtx.StringSlice(storageLocalRunServicesPath)...)
	if err != nil {
		return err
	}

	st := NewLocal(c, s, runServices)
	data, err := st.GetApps(c, s, runServices)
	if err != nil {
		return fmt.Errorf("failed to get data from plugin: %w", err)
	}
	plugins := []graph.Plugin{st}

	resolver, err := graph.NewResolver(data, plugins)
	if err != nil {
		return fmt.Errorf("failed to create resolver: %w", err)
	}

	r := graph.SetupRouter(
		"/v1/configserver",
		resolver,
		dummyMiddleware,
		dummyMiddleware,
		cCtx.Bool(enablePlaygroundFlag),
		cCtx.App.Version,
		[]graphql.FieldMiddleware{},
		gin.Recovery(),
		cors.New(cors.Config{ //nolint: exhaustruct
			AllowOrigins:     []string{"https://local.dashboard.nhost.run"},
			AllowMethods:     []string{"GET", "POST"},
			AllowCredentials: true,
		}),
	)
	if err := r.Run(cCtx.String(bindFlag)); err != nil {
		return fmt.Errorf("failed to run gin: %w", err)
	}
	return nil
}
