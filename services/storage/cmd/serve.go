package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	_ "net/http/pprof" //nolint:gosec
	"runtime"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/cshum/vipsgen/vips"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/image"
	"github.com/nhost/nhost/services/storage/metadata"
	"github.com/nhost/nhost/services/storage/middleware"
	"github.com/nhost/nhost/services/storage/middleware/cdn/cdncachecontrol"
	"github.com/nhost/nhost/services/storage/middleware/cdn/fastly"
	"github.com/nhost/nhost/services/storage/middleware/securityheaders"
	"github.com/nhost/nhost/services/storage/migrations"
	"github.com/nhost/nhost/services/storage/storage"
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
	flagCDNCacheControl          = "cdn-cache-control"
	flagPprofBind                = "pprof-bind"
	flagImageTransformerWorkers  = "image-transformer-workers"
	flagImageTransformerMaxDim   = "image-transformer-max-dimension"
	flagImageTransformerMaxBlur  = "image-transformer-max-blur-sigma"
)

func corsOptions(allowedOrigins []string, allowCredentials bool) oapimw.CORSOptions {
	return oapimw.CORSOptions{
		AllowOriginFunc:  nil,
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "PUT", "POST", "HEAD", "DELETE"},
		AllowHeadersFunc: nil,
		AllowedHeaders: []string{
			"Authorization",
			"Origin",
			"if-match",
			"if-none-match",
			"if-modified-since",
			"if-unmodified-since",
			"x-hasura-admin-secret",
			"x-nhost-bucket-id",
			"x-nhost-file-name",
			"x-nhost-file-id",
			"x-hasura-role",
		},
		ExposedHeaders: []string{
			"Content-Length",
			"Content-Type",
			"Cache-Control",
			"CDN-Cache-Control",
			"ETag",
			"Last-Modified",
			"X-Error",
		},
		AllowCredentials: allowCredentials,
		// Conditionally required: the shared CORS middleware is fail-closed and
		// rejects allow-all origins combined with credentials, so without this
		// flag NewRouter would error at startup for any deployment that runs the
		// default ["*"] origins together with credentials. Because
		// both AllowedOrigins and AllowCredentials are config-driven here,
		// deployments with explicit origins are unaffected; the flag only
		// preserves boot for the legacy allow-all + credentials combination.
		// Replace with explicit allowed origins in a follow-up migration.
		UnsafeAllowAllOriginsWithCredentials: true,
		MaxAge:                               "86400",
	}
}

func configureMiddleware(opts Options, router *gin.Engine, logger *slog.Logger) {
	// Always set standard security headers on every response. Not behind a flag.
	router.Use(securityheaders.New())

	if opts.CDNCacheControl {
		logger.InfoContext(context.Background(), "enabling cdn-cache-control middleware")
		router.Use(cdncachecontrol.New())
	}

	if opts.FastlyService != "" {
		logger.InfoContext(context.Background(), "enabling fastly middleware")
		router.Use(fastly.New(opts.FastlyService, opts.FastlyKey, logger))
	}
}

func getHandler(
	opts Options,
	metadataStorage controller.MetadataStorage,
	contentStorage controller.ContentStorage,
	imageTransformer *image.Transformer,
	logger *slog.Logger,
) (http.Handler, error) {
	av, err := getAv(opts.ClamavServer)
	if err != nil {
		return nil, fmt.Errorf("problem trying to get av: %w", err)
	}

	ctrl := controller.New(
		opts.PublicURL,
		opts.APIRootPrefix,
		opts.HasuraAdminSecret,
		metadataStorage,
		contentStorage,
		imageTransformer,
		av,
		logger,
	)

	handler := api.NewStrictHandler(ctrl, []api.StrictMiddlewareFunc{})

	swagger, err := api.GetSpec()
	if err != nil {
		return nil, fmt.Errorf("loading OpenAPI schema: %w", err)
	}

	router, mw, err := oapi.NewRouter(
		swagger,
		opts.APIRootPrefix,
		middleware.AuthenticationFunc(opts.HasuraAdminSecret),
		corsOptions(opts.CORSAllowOrigins, opts.CORSAllowCredentials),
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create router: %w", err)
	}

	router.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	configureMiddleware(opts, router, logger)

	api.RegisterHandlersWithOptions(
		router,
		handler,
		api.GinServerOptions{
			BaseURL:      opts.APIRootPrefix,
			Middlewares:  []api.MiddlewareFunc{mw},
			ErrorHandler: oapi.RecordError,
		},
	)

	return router, nil
}

func getMetadataStorage(endpoint string) *metadata.Hasura {
	return metadata.NewHasura(endpoint)
}

func getContentStorage(
	ctx context.Context, opts Options, logger *slog.Logger,
) (*storage.S3, error) {
	var (
		cfg aws.Config
		err error
	)

	region := opts.S3Region
	if region == "" {
		region = "no-region"
	}

	if opts.S3AccessKey != "" && opts.S3SecretKey != "" {
		logger.InfoContext(ctx, "Using static aws credentials")

		cfg, err = config.LoadDefaultConfig(
			ctx,
			config.WithRegion(region),
			config.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(opts.S3AccessKey, opts.S3SecretKey, ""),
			),
		)
	} else {
		logger.InfoContext(ctx, "Using default configuration for aws credentials")

		cfg, err = config.LoadDefaultConfig(ctx, config.WithRegion(region))
	}

	if err != nil {
		return nil, fmt.Errorf("loading S3 configuration: %w", err)
	}

	client := s3.NewFromConfig(
		cfg,
		func(o *s3.Options) {
			o.BaseEndpoint = aws.String(opts.S3Endpoint)
			o.UsePathStyle = true
			o.EndpointOptions.DisableHTTPS = opts.S3DisableHTTPS
		},
	)

	return storage.NewS3(client, opts.S3Bucket, opts.S3RootFolder, opts.S3Endpoint, logger), nil
}

func applyMigrations(ctx context.Context, opts Options, logger *slog.Logger) error {
	if opts.ApplyPostgresMigrations {
		logger.InfoContext(ctx, "applying postgres migrations")

		if err := migrations.ApplyPostgresMigration(opts.PostgresMigrationsSource); err != nil {
			return fmt.Errorf("problem applying postgres migrations: %w", err)
		}
	}

	if opts.ApplyHasuraMetadata {
		logger.InfoContext(ctx, "applying hasura metadata")

		if err := migrations.ApplyHasuraMetadata(
			ctx, opts.HasuraEndpoint, opts.HasuraAdminSecret, opts.HasuraDBName, logger,
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
				Sources:  cli.EnvVars("HASURA_GRAPHQL_ADMIN_SECRET"),
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
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:     flagCDNCacheControl,
				Usage:    "Enable CDN-Cache-Control header middleware",
				Category: "cdn",
				Sources:  cli.EnvVars("CDN_CACHE_CONTROL"),
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
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagPprofBind,
				Usage:    "If set, bind pprof and vips debug endpoints to this address. Example: :6060",
				Category: "debug",
				Sources:  cli.EnvVars("BIND_PPROF"),
			},
			&cli.IntFlag{ //nolint:exhaustruct
				Name:     flagImageTransformerWorkers,
				Usage:    "number of concurrent image transformation workers (0 = 2 * GOMAXPROCS)",
				Value:    0,
				Category: "server",
				Sources:  cli.EnvVars("IMAGE_TRANSFORMER_WORKERS"),
			},
			&cli.IntFlag{ //nolint:exhaustruct
				Name: flagImageTransformerMaxDim,
				Usage: "maximum width or height, in pixels, an image may be " +
					"resized to; bounds libvips memory use per request",
				Value:    image.DefaultMaxImageDimension,
				Category: "server",
				Sources:  cli.EnvVars("IMAGE_TRANSFORMER_MAX_DIMENSION"),
			},
			&cli.FloatFlag{ //nolint:exhaustruct
				Name:     flagImageTransformerMaxBlur,
				Usage:    "maximum Gaussian blur sigma that may be applied to an image",
				Value:    image.DefaultMaxBlurSigma,
				Category: "server",
				Sources:  cli.EnvVars("IMAGE_TRANSFORMER_MAX_BLUR_SIGMA"),
			},
		},
		Action: serve,
	}
}

// registerVipsDebugHandler adds storage's libvips memory report to
// http.DefaultServeMux, alongside the pprof handlers registered there by the
// net/http/pprof blank import. The shared serve runtime exposes that mux through
// Options.DebugAddr, so the route is reachable only when pprof is enabled.
func registerVipsDebugHandler() {
	http.HandleFunc("/debug/vips", func(w http.ResponseWriter, _ *http.Request) {
		var stats vips.MemoryStats
		vips.ReadVipsMemStats(&stats)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats) //nolint:errcheck
	})
}

func serve(ctx context.Context, cmd *cli.Command) error {
	logger := serveutil.NewLogger(cmd.Bool(flagDebug), cmd.Bool(flagLogFormatTEXT))
	logger.InfoContext(ctx, cmd.Root().Name+" v"+cmd.Root().Version)
	serveutil.LogFlags(ctx, logger, cmd)

	opts := optionsFromCommand(cmd)

	debugAddr := cmd.String(flagPprofBind)
	if debugAddr != "" {
		registerVipsDebugHandler()
	}

	// Only the default read-header deadline applies, so large uploads and
	// downloads are not aborted mid-transfer.
	// Run's errors already name the service and the lifecycle phase that failed.
	//nolint:wrapcheck // adding a prefix here would only repeat that context.
	return serveutil.Run(ctx, serveutil.Options{
		Logger:          logger,
		Addr:            cmd.String(flagBind),
		HTTP:            serveutil.HTTPTimeouts{ReadHeader: 0, Read: 0, Write: 0, Idle: 0},
		DebugAddr:       debugAddr,
		ShutdownTimeout: 0,
		Compose:         nil,
	}, serveutil.Definition{
		Name: "storage", Prefix: "",
		Build: func(ctx context.Context, logger *slog.Logger) (*serveutil.Service, error) {
			return NewService(ctx, opts, logger)
		},
	})
}

// NewService builds storage's serving surface from opts, which it validates
// first: the HTTP handler and the image transformer. Storage has no long-lived background loop, so Background is nil:
// the transformer bounds concurrency with a semaphore rather than worker
// goroutines. Close calls Transformer.Shutdown, which tears down process-global
// libvips state and is not re-entrant: image.NewTransformer cannot restart libvips
// afterward. Close must therefore run exactly once, after all in-flight requests
// have drained. NewService is consumed both by the standalone serve command and
// by the engine unified binary, which mounts the handler behind a shared listener.
// Past validation, its construction and cleanup error paths are
// integration-only because they require the storage service's PostgreSQL, S3,
// and Hasura environment.
func NewService(
	ctx context.Context,
	opts Options,
	logger *slog.Logger,
) (_ *serveutil.Service, err error) {
	if err := opts.Validate(); err != nil {
		return nil, err
	}

	imageTransformer := newImageTransformer(ctx, opts, logger)

	// Tear libvips down again if the rest of construction fails. On success the
	// returned Service owns the transformer and frees it through its Close.
	defer func() {
		if err != nil {
			imageTransformer.Shutdown()
		}
	}()

	contentStorage, err := getContentStorage(ctx, opts, logger)
	if err != nil {
		return nil, err
	}

	if err := applyMigrations(ctx, opts, logger); err != nil {
		return nil, err
	}

	metadataStorage := getMetadataStorage(opts.HasuraEndpoint + "/graphql")

	handler, err := getHandler( //nolint:contextcheck
		opts, metadataStorage, contentStorage, imageTransformer, logger,
	)
	if err != nil {
		return nil, err
	}

	return &serveutil.Service{
		Handler:    handler,
		Background: nil,
		Close:      serveutil.CloseFunc(imageTransformer.Shutdown),
	}, nil
}

// newImageTransformer builds the image transformer, defaulting the worker count
// to 2×GOMAXPROCS when it is not explicitly configured.
func newImageTransformer(
	ctx context.Context,
	opts Options,
	logger *slog.Logger,
) *image.Transformer {
	workers := opts.ImageTransformerWorkers
	if workers <= 0 {
		workers = 2 * runtime.GOMAXPROCS(0) //nolint:mnd
		logger.InfoContext(
			ctx,
			"calculating number of image transformer workers based on GOMAXPROCS",
			slog.Int("workers", workers),
		)
	}

	return image.NewTransformer(
		workers,
		opts.ImageTransformerMaxDimension,
		opts.ImageTransformerMaxBlurSigma,
	)
}
