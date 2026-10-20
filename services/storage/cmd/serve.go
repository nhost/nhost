package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	_ "net/http/pprof" //nolint:gosec
	"runtime"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/cshum/vipsgen/vips"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
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
	"github.com/nhost/nhost/services/storage/usage"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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
	flagPostgresSource           = "postgres-source"
	flagMetricsBind              = "metrics-bind"
	flagMaxTotalStorageSize      = "max-total-storage-size"
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

func getCORSOptions(cmd *cli.Command) oapimw.CORSOptions {
	return oapimw.CORSOptions{
		AllowOriginFunc:  nil,
		AllowedOrigins:   cmd.StringSlice(flagCorsAllowOrigins),
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
		AllowCredentials: cmd.Bool(flagCorsAllowCredentials),
		// Conditionally required: the shared CORS middleware is fail-closed and
		// rejects allow-all origins combined with credentials, so without this
		// flag NewRouter would error at startup for any deployment that runs the
		// default ["*"] origins together with --cors-allow-credentials. Because
		// both AllowedOrigins and AllowCredentials are config-driven here,
		// deployments with explicit origins are unaffected; the flag only
		// preserves boot for the legacy allow-all + credentials combination.
		// Replace with explicit allowed origins in a follow-up migration.
		UnsafeAllowAllOriginsWithCredentials: true,
		MaxAge:                               "86400",
	}
}

func configureMiddleware(cmd *cli.Command, router *gin.Engine, logger *slog.Logger) {
	// Always set standard security headers on every response. Not behind a flag.
	router.Use(securityheaders.New())

	if cmd.Bool(flagCDNCacheControl) {
		logger.InfoContext(context.Background(), "enabling cdn-cache-control middleware")
		router.Use(cdncachecontrol.New())
	}

	if cmd.String(flagFastlyService) != "" {
		logger.InfoContext(context.Background(), "enabling fastly middleware")
		router.Use(
			fastly.New(cmd.String(flagFastlyService), cmd.String(flagFastlyKey), logger),
		)
	}
}

func getServer(
	cmd *cli.Command,
	metadataStorage controller.MetadataStorage,
	contentStorage controller.ContentStorage,
	imageTransformer *image.Transformer,
	logger *slog.Logger,
	limit controller.StorageLimit,
) (*http.Server, error) {
	av, err := getAv(cmd.String(flagClamavServer))
	if err != nil {
		return nil, fmt.Errorf("problem trying to get av: %w", err)
	}

	ctrl := controller.New(
		cmd.String(flagPublicURL),
		cmd.String(flagAPIRootPrefix),
		cmd.String(flagHasuraAdminSecret),
		metadataStorage,
		contentStorage,
		imageTransformer,
		av,
		logger,
		limit,
	)

	handler := api.NewStrictHandler(ctrl, []api.StrictMiddlewareFunc{})

	swagger, err := api.GetSpec()
	if err != nil {
		return nil, fmt.Errorf("loading OpenAPI schema: %w", err)
	}

	router, mw, err := oapi.NewRouter(
		swagger,
		cmd.String(flagAPIRootPrefix),
		middleware.AuthenticationFunc(cmd.String(flagHasuraAdminSecret)),
		getCORSOptions(cmd),
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create router: %w", err)
	}

	router.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	configureMiddleware(cmd, router, logger)

	api.RegisterHandlersWithOptions(
		router,
		handler,
		api.GinServerOptions{
			BaseURL:      cmd.String(flagAPIRootPrefix),
			Middlewares:  []api.MiddlewareFunc{mw},
			ErrorHandler: oapi.RecordError,
		},
	)

	server := &http.Server{ //nolint:exhaustruct
		Addr:              cmd.String(flagBind),
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
			ctx, hasuraEndpoint, hasuraSecret, hasuraDBName, logger,
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
				Name:     flagPostgresSource,
				Usage:    "persistent Postgres source for usage reads",
				Category: "postgres",
				Sources:  cli.EnvVars("POSTGRES_SOURCE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagMetricsBind,
				Usage:    "private metrics listener address (disabled when empty)",
				Category: "server",
				Sources:  cli.EnvVars("METRICS_BIND"),
			},
			&cli.Int64Flag{ //nolint:exhaustruct
				Name:     flagMaxTotalStorageSize,
				Usage:    "maximum uploaded bytes; uploads rejected when total >= limit (0 disables)",
				Category: "server",
				Sources:  cli.EnvVars("MAX_TOTAL_STORAGE_SIZE"),
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

func startPprofServer(ctx context.Context, bind string, logger *slog.Logger) {
	if bind == "" {
		return
	}

	http.HandleFunc("/debug/vips", func(w http.ResponseWriter, _ *http.Request) {
		var stats vips.MemoryStats
		vips.ReadVipsMemStats(&stats)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats) //nolint:errcheck
	})

	logger.InfoContext(ctx, "starting pprof server", slog.String("bind", bind))

	pprofServer := &http.Server{ //nolint:exhaustruct
		Addr:              bind,
		Handler:           http.DefaultServeMux,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
	}

	go func() {
		if err := pprofServer.ListenAndServe(); err != nil {
			logger.ErrorContext(ctx, "pprof server failed", slog.String("error", err.Error()))
		}
	}()
}

var (
	errMissingUsageSource = errors.New(
		"usage feature requires postgres-source or postgres-migrations-source",
	)
	errNegativeStorageLimit = errors.New("max-total-storage-size must not be negative")
	errInvalidUsageSource   = errors.New("open usage Postgres pool: invalid source")
	errUnreadableUsage      = errors.New("probe storage usage counter: unreadable or missing")
)

func validateUsageStartup(source, fallback, bind string, limit int64) (string, error) {
	if limit < 0 {
		return "", errNegativeStorageLimit
	}

	return resolvePostgresSource(source, fallback, bind != "" || limit > 0)
}

func resolvePostgresSource(source, fallback string, enabled bool) (string, error) {
	if !enabled {
		return "", nil
	}

	if source != "" {
		return source, nil
	}

	if fallback != "" {
		return fallback, nil
	}

	return "", errMissingUsageSource
}

type usageConnection interface {
	usage.Querier
	Close()
}
type pgUsageConnection struct {
	*usage.Reader

	pool *pgxpool.Pool
}

func (p *pgUsageConnection) Close() { p.pool.Close() }

//nolint:ireturn // The injected connection boundary permits startup failure tests without Postgres.
func openUsage(ctx context.Context, source string) (usageConnection, error) {
	pool, err := pgxpool.New(ctx, source)
	if err != nil {
		// pgxpool.New may echo the DSN on parse failure; do not wrap that error.
		return nil, errInvalidUsageSource
	}

	return &pgUsageConnection{Reader: usage.NewReader(pool), pool: pool}, nil
}

//nolint:ireturn // The connection is retained for ordered shutdown.
func startUsage(
	ctx context.Context,
	source, bind string,
) (usageConnection, *http.Server, net.Listener, error) {
	return startUsageWith(ctx, source, bind, openUsage)
}

//nolint:ireturn // Test fakes exercise the same startup path.
func startUsageWith(
	ctx context.Context,
	source, bind string,
	open func(context.Context, string) (usageConnection, error),
) (usageConnection, *http.Server, net.Listener, error) {
	if source == "" {
		return nil, nil, nil, nil
	}

	pool, err := open(ctx, source)
	if err != nil {
		return nil, nil, nil, err
	}

	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second) //nolint:mnd
	defer cancel()

	if _, err := pool.Total(probeCtx); err != nil {
		pool.Close()
		return nil, nil, nil, fmt.Errorf("%w: %w", errUnreadableUsage, err)
	}

	if bind == "" {
		return pool, nil, nil, nil
	}

	server := newMetricsServer(bind, pool)

	listener, err := (&net.ListenConfig{}).Listen(ctx, "tcp", bind) //nolint:exhaustruct
	if err != nil {
		pool.Close()
		return nil, nil, nil, fmt.Errorf("bind metrics listener: %w", err)
	}

	return pool, server, listener, nil
}

func newMetricsServer(bind string, reader usage.Querier) *http.Server {
	registry := prometheus.NewRegistry()
	registry.MustRegister(usage.NewCollector(reader))

	mux := http.NewServeMux()
	mux.Handle(
		"/metrics",
		promhttp.HandlerFor(
			registry,
			promhttp.HandlerOpts{ //nolint:exhaustruct // Other handler options retain upstream defaults.
				ErrorHandling: promhttp.HTTPErrorOnError,
			},
		),
	)

	return &http.Server{ //nolint:exhaustruct
		Addr:              bind,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
	}
}

func shutdownUsage(ctx context.Context, metrics, main *http.Server, pool usageConnection) error {
	var errs []error
	for _, server := range []*http.Server{metrics, main} {
		if server != nil {
			if err := server.Shutdown(ctx); err != nil {
				errs = append(errs, err)
			}
		}
	}

	if pool != nil {
		pool.Close()
	}

	return errors.Join(errs...)
}

//nolint:funlen // Startup coordinates optional services and shutdown.
func serve(
	ctx context.Context,
	cmd *cli.Command,
) error {
	logger := getLogger(cmd.Bool(flagDebug), cmd.Bool(flagLogFormatTEXT))
	logger.InfoContext(ctx, cmd.Root().Name+" v"+cmd.Root().Version)
	logFlags(ctx, logger, cmd)

	imageTransformerWorkers := cmd.Int(flagImageTransformerWorkers)
	if imageTransformerWorkers <= 0 {
		imageTransformerWorkers = 2 * runtime.GOMAXPROCS(0) //nolint:mnd
		logger.InfoContext(
			ctx,
			"calculating number of image transformer workers based on GOMAXPROCS",
			slog.Int("workers", imageTransformerWorkers),
		)
	}

	imageTransformer := image.NewTransformer(
		imageTransformerWorkers,
		cmd.Int(flagImageTransformerMaxDim),
		cmd.Float(flagImageTransformerMaxBlur),
	)
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

	source, err := validateUsageStartup(
		cmd.String(flagPostgresSource),
		cmd.String(flagPostgresMigrationsSource),
		cmd.String(flagMetricsBind),
		cmd.Int64(flagMaxTotalStorageSize),
	)
	if err != nil {
		return err
	}

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

	pool, metricsServer, metricsListener, err := startUsage(
		ctx,
		source,
		cmd.String(flagMetricsBind),
	)
	if err != nil {
		return err
	}

	if metricsListener != nil {
		defer metricsListener.Close()
	}

	metadataStorage := getMetadataStorage(
		cmd.String(flagHasuraEndpoint) + "/graphql",
	)

	var storageLimit controller.StorageLimit
	if cmd.Int64(flagMaxTotalStorageSize) > 0 {
		storageLimit = controller.StorageLimit{
			Limiter: pool,
			Max:     cmd.Int64(flagMaxTotalStorageSize),
		}
	}

	server, err := getServer( //nolint: contextcheck
		cmd,
		metadataStorage,
		contentStorage,
		imageTransformer,
		logger,
		storageLimit,
	)
	if err != nil {
		if pool != nil {
			pool.Close()
		}

		return err
	}

	if metricsServer != nil {
		go func() {
			if err := metricsServer.Serve(
				metricsListener,
			); err != nil &&
				!errors.Is(err, http.ErrServerClosed) {
				logger.ErrorContext(
					servCtx,
					"metrics server failed",
					slog.String("error", err.Error()),
				)
				cancel()
			}
		}()
	}

	startPprofServer(servCtx, cmd.String(flagPprofBind), logger)

	go func() {
		defer cancel()

		logger.InfoContext(servCtx, "starting server")

		if err := server.ListenAndServe(); err != nil {
			logger.ErrorContext(servCtx, "server failed", slog.String("error", err.Error()))
		}
	}()

	<-servCtx.Done()

	logger.InfoContext(ctx, "shutting down server")

	if err := shutdownUsage(ctx, metricsServer, server, pool); err != nil {
		logger.ErrorContext(ctx, "problem shutting down servers", slog.String("error", err.Error()))
	}

	return nil
}
