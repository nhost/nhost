package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/image"
	"github.com/nhost/nhost/services/storage/metadata"
	"github.com/nhost/nhost/services/storage/middleware"
	"github.com/nhost/nhost/services/storage/middleware/cdn/fastly"
	"github.com/nhost/nhost/services/storage/migrations"
	"github.com/nhost/nhost/services/storage/storage"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	"github.com/urfave/cli/v3"
)

const (
	flagDebug                    = "debug"
	flagLogFormatTEXT            = "log-format-text"
	flagPublicURL                = "public-url"
	flagAPIRootPrefix            = "api-root-prefix"
	flagBind                     = "bind"
	flagHasuraEndpoint           = "hasura-endpoint"
	flagHasuraMetadata           = "hasura-metadata"
	flagHasuraAdminSecret        = "hasura-graphql-admin-secret" //nolint: gosec
	flagS3Endpoint               = "s3-endpoint"
	flagS3AccessKey              = "s3-access-key"
	flagS3SecretKey              = "s3-secret-key" //nolint: gosec
	flagS3Region                 = "s3-region"
	flagS3Bucket                 = "s3-bucket"
	flagS3RootFolder             = "s3-root-folder"
	flagS3DisableHTTPS           = "s3-disable-https"
	flagPostgresMigrations       = "postgres-migrations"
	flagPostgresMigrationsSource = "postgres-migrations-source"
	flagFastlyService            = "fastly-service"
	flagFastlyKey                = "fastly-key"
	flagCorsAllowOrigins         = "cors-allow-origins"
	flagCorsAllowCredentials     = "cors-allow-credentials" //nolint: gosec
	flagClamavServer             = "clamav-server"
	flagHasuraDBName             = "hasura-db-name"
)

func getCorsMiddleware(
	corsAllowOrigins []string,
	corsAllowCredentials bool,
) gin.HandlerFunc {
	return cors.New(cors.Config{ //nolint:exhaustruct
		AllowOrigins: corsAllowOrigins,
		AllowMethods: []string{"GET", "PUT", "POST", "HEAD", "DELETE"},
		AllowHeaders: []string{
			"Authorization", "Origin", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since",
			"x-hasura-admin-secret", "x-nhost-bucket-id", "x-nhost-file-name", "x-nhost-file-id",
			"x-hasura-role",
		},
		ExposeHeaders: []string{
			"Content-Length", "Content-Type", "Cache-Control", "ETag", "Last-Modified", "X-Error",
		},
		AllowCredentials: corsAllowCredentials,
		MaxAge:           12 * time.Hour, //nolint: mnd
	})
}

func getGin( //nolint:funlen
	bind string,
	publicURL string,
	apiRootPrefix string,
	hasuraAdminSecret string,
	metadataStorage controller.MetadataStorage,
	contentStorage controller.ContentStorage,
	imageTransformer *image.Transformer,
	logger *slog.Logger,
	debug bool,
	corsAllowOrigins []string,
	corsAllowCredentials bool,
	fastlyService string,
	fastlyKey string,
	clamavServer string,
) (*http.Server, error) {
	router := gin.New()

	router.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	if !debug {
		gin.SetMode(gin.ReleaseMode)
	}

	loader := openapi3.NewLoader()

	doc, err := loader.LoadFromData(controller.OpenAPISchema)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI schema: %w", err)
	}

	doc.AddServer(&openapi3.Server{ //nolint:exhaustruct
		URL: apiRootPrefix,
	})

	handlers := []gin.HandlerFunc{
		middleware.Logger(logger),
		getCorsMiddleware(corsAllowOrigins, corsAllowCredentials),
		gin.Recovery(),
	}

	if fastlyService != "" {
		logger.InfoContext(context.Background(), "enabling fastly middleware")
		handlers = append(
			handlers,
			fastly.New(fastlyService, fastlyKey, logger),
		)
	}

	router.Use(handlers...)

	av, err := getAv(clamavServer)
	if err != nil {
		return nil, fmt.Errorf("problem trying to get av: %w", err)
	}

	ctrl := controller.New(
		publicURL,
		apiRootPrefix,
		hasuraAdminSecret,
		metadataStorage,
		contentStorage,
		imageTransformer,
		av,
		logger,
	)

	handler := api.NewStrictHandler(ctrl, []api.StrictMiddlewareFunc{})
	mw := api.MiddlewareFunc(ginmiddleware.OapiRequestValidatorWithOptions(
		doc,
		&ginmiddleware.Options{ //nolint:exhaustruct
			Options: openapi3filter.Options{ //nolint:exhaustruct
				AuthenticationFunc: middleware.AuthenticationFunc(hasuraAdminSecret),
			},
			SilenceServersWarning: true,
		},
	))
	api.RegisterHandlersWithOptions(
		router,
		handler,
		api.GinServerOptions{
			BaseURL:      apiRootPrefix,
			Middlewares:  []api.MiddlewareFunc{mw},
			ErrorHandler: nil,
		},
	)

	server := &http.Server{ //nolint:exhaustruct
		Addr:              bind,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
	}

	return server, nil
}

func getMetadataStorage(endpoint string) *metadata.Hasura {
	return metadata.NewHasura(endpoint)
}

func getContentStorage(
	ctx context.Context,
	s3Endpoint, region, s3AccessKey, s3SecretKey, bucket, rootFolder string,
	disableHTTPS bool,
	logger *slog.Logger,
) *storage.S3 {
	var (
		cfg aws.Config
		err error
	)

	if region == "" {
		region = "no-region"
	}

	if s3AccessKey != "" && s3SecretKey != "" {
		logger.InfoContext(ctx, "Using static aws credentials")

		cfg, err = config.LoadDefaultConfig(
			ctx,
			config.WithRegion(region),
			config.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(s3AccessKey, s3SecretKey, ""),
			),
		)
	} else {
		logger.InfoContext(ctx, "Using default configuration for aws credentials")

		cfg, err = config.LoadDefaultConfig(ctx, config.WithRegion(region))
	}

	if err != nil {
		panic(err)
	}

	client := s3.NewFromConfig(
		cfg,
		func(o *s3.Options) {
			o.BaseEndpoint = aws.String(s3Endpoint)
			o.UsePathStyle = true
			o.EndpointOptions.DisableHTTPS = disableHTTPS
		},
	)
	st := storage.NewS3(client, bucket, rootFolder, s3Endpoint, logger)

	return st
}

func applyMigrations(
	ctx context.Context,
	postgresMigrations bool,
	postgresSource string,
	hasuraMetadata bool,
	hasuraEndpoint string,
	hasuraSecret string,
	hasuraDBName string,
	logger *slog.Logger,
) error {
	if postgresMigrations {
		logger.InfoContext(ctx, "applying postgres migrations")

		if err := migrations.ApplyPostgresMigration(postgresSource); err != nil {
			return fmt.Errorf("problem applying postgres migrations: %w", err)
		}
	}

	if hasuraMetadata {
		logger.InfoContext(ctx, "applying hasura metadata")

		if err := migrations.ApplyHasuraMetadata(
			ctx, hasuraEndpoint, hasuraSecret, hasuraDBName,
		); err != nil {
			return fmt.Errorf("problem applying hasura metadata: %w", err)
		}
	}

	return nil
}

func CommandServe() *cli.Command { //nolint:funlen
	return &cli.Command{ //nolint:exhaustruct
		Name:  "serve",
		Usage: "Start storage server",
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagDebug,
				Usage:    "enable debug messages",
				Category: "general",
				Sources:  cli.EnvVars("DEBUG"),
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagLogFormatTEXT,
				Usage:    "format logs in plain text",
				Category: "general",
				Value:    false,
				Sources:  cli.EnvVars("LOG_FORMAT_TEXT"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagPublicURL,
				Usage:    "public URL of the service",
				Value:    "http://localhost:8000",
				Category: "server",
				Sources:  cli.EnvVars("PUBLIC_URL"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagAPIRootPrefix,
				Usage:    "API root prefix",
				Value:    "/v1",
				Category: "server",
				Sources:  cli.EnvVars("API_ROOT_PREFIX"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagBind,
				Usage:    "bind the service to this address",
				Value:    ":8000",
				Category: "server",
				Sources:  cli.EnvVars("BIND"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagHasuraEndpoint,
				Usage:    "Use this endpoint when connecting using graphql as metadata storage",
				Category: "hasura",
				Sources:  cli.EnvVars("HASURA_ENDPOINT"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagHasuraMetadata,
				Usage:    "Apply Hasura's metadata",
				Category: "hasura",
				Sources:  cli.EnvVars("HASURA_METADATA"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagHasuraAdminSecret,
				Usage:    "Hasura admin secret",
				Category: "hasura",
				Sources: cli.EnvVars(
					"HASURA_GRAPHQL_ADMIN_SECRET",
					"HASURA_GRAPHQL_ADMIN_SECRET",
				),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagHasuraDBName,
				Usage:    "Hasura database name",
				Value:    "default",
				Category: "hasura",
				Sources:  cli.EnvVars("HASURA_DB_NAME"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3Endpoint,
				Usage:    "S3 Endpoint",
				Category: "s3",
				Sources:  cli.EnvVars("S3_ENDPOINT"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3AccessKey,
				Usage:    "S3 Access key",
				Category: "s3",
				Sources:  cli.EnvVars("S3_ACCESS_KEY"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3SecretKey,
				Usage:    "S3 Secret key",
				Category: "s3",
				Sources:  cli.EnvVars("S3_SECRET_KEY"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3Region,
				Usage:    "S3 region",
				Value:    "no-region",
				Category: "s3",
				Sources:  cli.EnvVars("S3_REGION"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3Bucket,
				Usage:    "S3 bucket",
				Category: "s3",
				Sources:  cli.EnvVars("S3_BUCKET"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagS3RootFolder,
				Usage:    "All buckets will be created inside this root",
				Category: "s3",
				Sources:  cli.EnvVars("S3_ROOT_FOLDER"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagS3DisableHTTPS,
				Usage:    "Disable HTTPS for S3",
				Category: "s3",
				Sources:  cli.EnvVars("S3_DISABLE_HTTPS"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagPostgresMigrations,
				Usage:    "Apply Postgres migrations",
				Category: "postgres",
				Sources:  cli.EnvVars("POSTGRES_MIGRATIONS"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagPostgresMigrationsSource,
				Usage:    "postgres connection, i.e. postgres://user@pass:localhost:5432/mydb",
				Category: "postgres",
				Required: true,
				Sources:  cli.EnvVars("POSTGRES_MIGRATIONS_SOURCE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagFastlyService,
				Usage:    "Enable Fastly middleware and enable automated purges",
				Category: "cdn",
				Sources:  cli.EnvVars("FASTLY_SERVICE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagFastlyKey,
				Usage:    "Fastly CDN Key to authenticate purges",
				Category: "cdn",
				Sources:  cli.EnvVars("FASTLY_KEY"),
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:     flagCorsAllowOrigins,
				Usage:    "CORS allow origins",
				Value:    []string{"*"},
				Category: "cors",
				Sources:  cli.EnvVars("CORS_ALLOW_ORIGINS"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagCorsAllowCredentials,
				Usage:    "CORS allow credentials",
				Category: "cors",
				Sources:  cli.EnvVars("CORS_ALLOW_CREDENTIALS"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagClamavServer,
				Usage:    "If set, use ClamAV to scan files. Example: tcp://clamavd:3310",
				Category: "antivirus",
				Sources:  cli.EnvVars("CLAMAV_SERVER"),
			},
		},
		Action: serve,
	}
}

func serve(ctx context.Context, cmd *cli.Command) error { //nolint:funlen
	logger := getLogger(cmd.Bool(flagDebug), cmd.Bool(flagLogFormatTEXT))
	logger.InfoContext(ctx, cmd.Root().Name+" v"+cmd.Root().Version)
	logFlags(ctx, logger, cmd)

	imageTransformer := image.NewTransformer()
	defer imageTransformer.Shutdown()

	servCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	contentStorage := getContentStorage(
		servCtx,
		cmd.String(flagS3Endpoint),
		cmd.String(flagS3Region),
		cmd.String(flagS3AccessKey),
		cmd.String(flagS3SecretKey),
		cmd.String(flagS3Bucket),
		cmd.String(flagS3RootFolder),
		cmd.Bool(flagS3DisableHTTPS),
		logger,
	)

	if err := applyMigrations(
		ctx,
		cmd.Bool(flagPostgresMigrations),
		cmd.String(flagPostgresMigrationsSource),
		cmd.Bool(flagHasuraMetadata),
		cmd.String(flagHasuraEndpoint),
		cmd.String(flagHasuraAdminSecret),
		cmd.String(flagHasuraDBName),
		logger,
	); err != nil {
		return err
	}

	metadataStorage := getMetadataStorage(
		cmd.String(flagHasuraEndpoint) + "/graphql",
	)

	server, err := getGin( //nolint: contextcheck
		cmd.String(flagBind),
		cmd.String(flagPublicURL),
		cmd.String(flagAPIRootPrefix),
		cmd.String(flagHasuraAdminSecret),
		metadataStorage,
		contentStorage,
		imageTransformer,
		logger,
		cmd.Bool(flagDebug),
		cmd.StringSlice(flagCorsAllowOrigins),
		cmd.Bool(flagCorsAllowCredentials),
		cmd.String(flagFastlyService),
		cmd.String(flagFastlyKey),
		cmd.String(flagClamavServer),
	)
	if err != nil {
		return err
	}

	go func() {
		defer cancel()

		logger.InfoContext(servCtx, "starting server")

		if err := server.ListenAndServe(); err != nil {
			logger.ErrorContext(servCtx, "server failed", slog.String("error", err.Error()))
		}
	}()

	<-servCtx.Done()

	logger.InfoContext(ctx, "shutting down server")

	if err := server.Shutdown(ctx); err != nil {
		logger.ErrorContext(ctx, "problem shutting down server", slog.String("error", err.Error()))
	}

	return nil
}
