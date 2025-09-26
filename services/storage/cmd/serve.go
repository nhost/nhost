package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/image"
	"github.com/nhost/hasura-storage/metadata"
	"github.com/nhost/hasura-storage/middleware"
	"github.com/nhost/hasura-storage/middleware/cdn/fastly"
	"github.com/nhost/hasura-storage/migrations"
	"github.com/nhost/hasura-storage/storage"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const (
	publicURLFlag                = "public-url"
	apiRootPrefixFlag            = "api-root-prefix"
	bindFlag                     = "bind"
	hasuraEndpointFlag           = "hasura-endpoint"
	hasuraMetadataFlag           = "hasura-metadata"
	hasuraAdminSecretFlag        = "hasura-graphql-admin-secret" //nolint: gosec
	s3EndpointFlag               = "s3-endpoint"
	s3AccessKeyFlag              = "s3-access-key"
	s3SecretKeyFlag              = "s3-secret-key" //nolint: gosec
	s3RegionFlag                 = "s3-region"
	s3BucketFlag                 = "s3-bucket"
	s3RootFolderFlag             = "s3-root-folder"
	s3DisableHTTPS               = "s3-disable-http"
	postgresMigrationsFlag       = "postgres-migrations"
	postgresMigrationsSourceFlag = "postgres-migrations-source"
	fastlyServiceFlag            = "fastly-service"
	fastlyKeyFlag                = "fastly-key"
	corsAllowOriginsFlag         = "cors-allow-origins"
	corsAllowCredentialsFlag     = "cors-allow-credentials" //nolint: gosec
	clamavServerFlag             = "clamav-server"
	hasuraDBNameFlag             = "hasura-db-name"
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
	logger *logrus.Logger,
	debug bool,
	corsAllowOrigins []string,
	corsAllowCredentials bool,
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

	fastlyService := viper.GetString(fastlyServiceFlag)
	if fastlyService != "" {
		logger.Info("enabling fastly middleware")
		handlers = append(
			handlers,
			fastly.New(fastlyService, viper.GetString(fastlyKeyFlag), logger),
		)
	}

	router.Use(handlers...)

	av, err := getAv(viper.GetString(clamavServerFlag))
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
	logger *logrus.Logger,
) *storage.S3 {
	var (
		cfg aws.Config
		err error
	)

	if s3AccessKey != "" && s3SecretKey != "" {
		logger.Info("Using static aws credentials")

		cfg, err = config.LoadDefaultConfig(
			ctx,
			config.WithRegion(region),
			config.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(s3AccessKey, s3SecretKey, ""),
			),
		)
	} else {
		logger.Info("Using default configuration for aws credentials")

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

func applymigrations(
	postgresMigrations bool,
	postgresSource string,
	hasuraMetadata bool,
	hasuraEndpoint string,
	hasuraSecret string,
	hasuraDBName string,
	logger *logrus.Logger,
) {
	if postgresMigrations {
		if postgresSource == "" {
			logger.Error("you need to specify " + postgresMigrationsSourceFlag)
			os.Exit(1)
		}

		logger.Info("applying postgres migrations")

		if err := migrations.ApplyPostgresMigration(postgresSource); err != nil {
			logger.Errorf("problem applying postgres migrations: %s", err.Error())
			os.Exit(1)
		}
	}

	if hasuraMetadata {
		logger.Info("applying hasura metadata")

		if err := migrations.ApplyHasuraMetadata(hasuraEndpoint, hasuraSecret, hasuraDBName); err != nil {
			logger.Errorf("problem applying hasura metadata: %s", err.Error())
			os.Exit(1)
		}
	}
}

func init() { //nolint:funlen
	rootCmd.AddCommand(serveCmd)

	{
		addStringFlag(
			serveCmd.Flags(),
			publicURLFlag,
			"http://localhost:8000",
			"public URL of the service",
		)
		addStringFlag(serveCmd.Flags(), apiRootPrefixFlag, "/v1", "API root prefix")
		addStringFlag(serveCmd.Flags(), bindFlag, ":8000", "bind the service to this address")
	}

	{
		addStringFlag(
			serveCmd.Flags(),
			hasuraEndpointFlag,
			"",
			"Use this endpoint when connecting using graphql as metadata storage",
		)
	}

	{
		addStringFlag(serveCmd.Flags(), s3EndpointFlag, "", "S3 Endpoint")
		addStringFlag(serveCmd.Flags(), s3AccessKeyFlag, "", "S3 Access key")
		addStringFlag(serveCmd.Flags(), s3SecretKeyFlag, "", "S3 Secret key")
		addStringFlag(serveCmd.Flags(), s3RegionFlag, "no-region", "S3 region")
		addStringFlag(serveCmd.Flags(), s3BucketFlag, "", "S3 bucket")
		addStringFlag(
			serveCmd.Flags(),
			s3RootFolderFlag,
			"",
			"All buckets will be created inside this root",
		)
	}

	{
		addBoolFlag(serveCmd.Flags(), postgresMigrationsFlag, false, "Apply Postgres migrations")
		addStringFlag(
			serveCmd.Flags(),
			postgresMigrationsSourceFlag,
			"",
			"postgres connection, i.e. postgres://user@pass:localhost:5432/mydb",
		)
		addStringFlag(serveCmd.Flags(), hasuraDBNameFlag, "default", "Hasura database name")
	}

	{
		addBoolFlag(serveCmd.Flags(), hasuraMetadataFlag, false, "Apply Hasura's metadata")
		addStringFlag(serveCmd.Flags(), hasuraAdminSecretFlag, "", "")
	}

	{
		addStringFlag(
			serveCmd.Flags(),
			fastlyServiceFlag,
			"",
			"Enable Fastly middleware and enable automated purges",
		)
		addStringFlag(serveCmd.Flags(), fastlyKeyFlag, "", "Fastly CDN Key to authenticate purges")
	}

	{
		addStringArrayFlag(
			serveCmd.Flags(),
			corsAllowOriginsFlag,
			[]string{"*"},
			"CORS allow origins",
		)
		addBoolFlag(serveCmd.Flags(), corsAllowCredentialsFlag, false, "CORS allow credentials")
		addStringFlag(
			serveCmd.Flags(),
			clamavServerFlag,
			"",
			"If set, use ClamAV to scan files. Example: tcp://clamavd:3310",
		)
	}
}

var serveCmd = &cobra.Command{ //nolint:exhaustruct
	Use:   "serve",
	Short: "Starts hasura-storage server",
	Run: func(cmd *cobra.Command, _ []string) {
		logger := getLogger()

		logger.Info("storage version ", controller.Version())

		ctx, cancel := context.WithCancel(cmd.Context())
		defer cancel()

		if viper.GetBool(debugFlag) {
			logger.SetLevel(logrus.DebugLevel)
			gin.SetMode(gin.DebugMode)
		} else {
			logger.SetLevel(logrus.InfoLevel)
			gin.SetMode(gin.ReleaseMode)
		}

		imageTransformer := image.NewTransformer()
		defer imageTransformer.Shutdown()

		logger.WithFields(
			logrus.Fields{
				debugFlag:              viper.GetBool(debugFlag),
				bindFlag:               viper.GetString(bindFlag),
				hasuraEndpointFlag:     viper.GetString(hasuraEndpointFlag),
				postgresMigrationsFlag: viper.GetBool(postgresMigrationsFlag),
				hasuraMetadataFlag:     viper.GetBool(hasuraMetadataFlag),
				s3EndpointFlag:         viper.GetString(s3EndpointFlag),
				s3RegionFlag:           viper.GetString(s3RegionFlag),
				s3BucketFlag:           viper.GetString(s3BucketFlag),
				s3RootFolderFlag:       viper.GetString(s3RootFolderFlag),
				clamavServerFlag:       viper.GetString(clamavServerFlag),
				hasuraDBNameFlag:       viper.GetString(hasuraDBNameFlag),
			},
		).Debug("parameters")

		contentStorage := getContentStorage(
			ctx,
			viper.GetString(s3EndpointFlag),
			viper.GetString(s3RegionFlag),
			viper.GetString(s3AccessKeyFlag),
			viper.GetString(s3SecretKeyFlag),
			viper.GetString(s3BucketFlag),
			viper.GetString(s3RootFolderFlag),
			viper.GetBool(s3DisableHTTPS),
			logger,
		)

		applymigrations(
			viper.GetBool(postgresMigrationsFlag),
			viper.GetString(postgresMigrationsSourceFlag),
			viper.GetBool(hasuraMetadataFlag),
			viper.GetString(hasuraEndpointFlag),
			viper.GetString(hasuraAdminSecretFlag),
			viper.GetString(hasuraDBNameFlag),
			logger,
		)

		metadataStorage := getMetadataStorage(
			viper.GetString(hasuraEndpointFlag) + "/graphql",
		)
		server, err := getGin(
			viper.GetString(bindFlag),
			viper.GetString(publicURLFlag),
			viper.GetString(apiRootPrefixFlag),
			viper.GetString(hasuraAdminSecretFlag),
			metadataStorage,
			contentStorage,
			imageTransformer,
			logger,
			viper.GetBool(debugFlag),
			viper.GetStringSlice(corsAllowOriginsFlag),
			viper.GetBool(corsAllowCredentialsFlag),
		)
		cobra.CheckErr(err)

		go func() {
			defer cancel()
			logger.Info("starting server")
			if err := server.ListenAndServe(); err != nil {
				logger.Error("server failed", logrus.Fields{
					"error": err,
				})
			}
		}()

		<-ctx.Done()

		logger.Info("shutting down server")
		err = server.Shutdown(ctx)
		cobra.CheckErr(err)
	},
}
