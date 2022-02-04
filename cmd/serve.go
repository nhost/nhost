package cmd

import (
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/metadata"
	"github.com/nhost/hasura-storage/migrations"
	"github.com/nhost/hasura-storage/storage"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const (
	bindFlag                      = "bind"
	trustedProxiesFlag            = "trusted-proxies"
	graphqlEndpointFlag           = "graphql_endpoint"
	s3EndpointFlag                = "s3_endpoint"
	s3AccessKeyFlag               = "s3_access_key"
	s3SecretKeyFlag               = "s3_secret_key" // nolint: gosec
	s3RegionFlag                  = "s3_region"
	s3BucketFlag                  = "s3_bucket"
	s3RootFolderFlag              = "s3_root_folder"
	postgresMigrationsFlag        = "postgres-migrations"
	postgresMigrationsSourceFlag  = "postgres-migrations-source"
	hasuraMetadataFlag            = "hasura-metadata"
	hasuraMetadataAdminSecretFlag = "hasura-metadata-admin-secret" // nolint: gosec
)

func ginLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		ctx.Next()

		endTime := time.Now()

		latencyTime := endTime.Sub(startTime)
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		statusCode := ctx.Writer.Status()
		clientIP := ctx.ClientIP()

		fields := logrus.Fields{
			"status_code":  statusCode,
			"latency_time": latencyTime,
			"client_ip":    clientIP,
			"method":       reqMethod,
			"url":          reqURL,
			"errors":       ctx.Errors.Errors(),
		}

		if len(ctx.Errors.Errors()) > 0 {
			logger.WithFields(fields).Error("call completed with some errors")
		} else {
			logger.WithFields(fields).Info()
		}
	}
}

func getGin(
	metadataStorage controller.MetadataStorage,
	contentStorage controller.ContentStorage,
	trustedProxies []string,
	logger *logrus.Logger,
	debug bool,
) (*gin.Engine, error) {
	if !debug {
		gin.SetMode(gin.ReleaseMode)
	}

	ctrl := controller.New(metadataStorage, contentStorage, logger)

	return ctrl.SetupRouter(trustedProxies, ginLogger(logger)) // nolint: wrapcheck
}

func getMetadataStorage(endpoint string) *metadata.Hasura {
	return metadata.NewHasura(endpoint, metadata.ForWardHeadersAuthorizer)
}

func getContentStorage(
	s3Endpoint, region, s3AccessKey, s3SecretKey, bucket, rootFolder string, logger *logrus.Logger,
) *storage.S3 {
	config := &aws.Config{ // nolint: exhaustivestruct
		Credentials:      credentials.NewStaticCredentials(s3AccessKey, s3SecretKey, ""),
		Endpoint:         aws.String(s3Endpoint),
		Region:           aws.String(region),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
	}

	st, err := storage.NewS3(config, bucket, rootFolder, logger)
	if err != nil {
		panic(err)
	}

	return st
}

func applymigrations(
	postgresMigrations bool,
	postgresSource string,
	hasuraMetadata bool,
	hasruraEndpoint string,
	hasuraSecret string,
	logger *logrus.Logger,
) {
	if postgresMigrations {
		if postgresSource == "" {
			logger.Error("you need to specify --postgres-migrations-source")
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
		if err := migrations.ApplyHasuraMetadata(hasruraEndpoint, hasuraSecret, logger); err != nil {
			logger.Errorf("problem applying hasura metadata: %s", err.Error())
			os.Exit(1)
		}
	}
}

func init() {
	rootCmd.AddCommand(serveCmd)

	{
		addStringFlag(serveCmd.Flags(), bindFlag, ":8000", "bind the service to this address")
		addStringArrayFlag(
			serveCmd.Flags(),
			trustedProxiesFlag,
			[]string{},
			"Trust this proxies only. Can be passed many times",
		)
	}

	{
		addStringFlag(
			serveCmd.Flags(),
			graphqlEndpointFlag,
			"",
			"Use this endpoint when connecting using graphql as metadata storage",
		)
	}

	{
		addStringFlag(serveCmd.Flags(), s3EndpointFlag, "", "S3 Endpoint")
		addStringFlag(serveCmd.Flags(), s3AccessKeyFlag, "", "S3 Access key")
		addStringFlag(serveCmd.Flags(), s3SecretKeyFlag, "", "S3 Secret key")
		addStringFlag(serveCmd.Flags(), s3RegionFlag, "", "S3 region")
		addStringFlag(serveCmd.Flags(), s3BucketFlag, "", "S3 bucket")
		addStringFlag(serveCmd.Flags(), s3RootFolderFlag, "", "All buckets will be created inside this root")
	}

	{
		addBoolFlag(serveCmd.Flags(), postgresMigrationsFlag, false, "Apply Postgres migrations")
		addStringFlag(
			serveCmd.Flags(),
			postgresMigrationsSourceFlag,
			"",
			"postgres connection, i.e. postgres://user@pass:localhost:5432/mydb",
		)
	}

	{
		addBoolFlag(serveCmd.Flags(), hasuraMetadataFlag, false, "Apply Hasura's metadata")
		addStringFlag(serveCmd.Flags(), hasuraMetadataAdminSecretFlag, "", "")
	}
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Starts hasura-storage server",
	Run: func(_ *cobra.Command, _ []string) {
		logger := getLogger()

		logger.Info("storage version ", controller.Version())

		if viper.GetBool(debugFlag) {
			logger.SetLevel(logrus.DebugLevel)
			gin.SetMode(gin.DebugMode)
		} else {
			logger.SetLevel(logrus.InfoLevel)
			gin.SetMode(gin.ReleaseMode)
		}

		logger.WithFields(
			logrus.Fields{
				"debug":               viper.GetBool(debugFlag),
				"bind":                viper.GetString(bindFlag),
				"trusted-proxies":     viper.GetStringSlice(trustedProxiesFlag),
				"graphql_endpoint":    viper.GetString(graphqlEndpointFlag),
				"postgres-migrations": viper.GetBool(postgresMigrationsFlag),
				"hasura-metadata":     viper.GetBool(hasuraMetadataFlag),
				"s3_endpoint":         viper.GetString(s3EndpointFlag),
				"s3_region":           viper.GetString(s3RegionFlag),
				"s3_bucket":           viper.GetString(s3BucketFlag),
				"s3_root_folder":      viper.GetString(s3RootFolderFlag),
			},
		).Debug("parameters")

		contentStorage := getContentStorage(
			viper.GetString(s3EndpointFlag),
			viper.GetString(s3RegionFlag),
			viper.GetString(s3AccessKeyFlag),
			viper.GetString(s3SecretKeyFlag),
			viper.GetString(s3BucketFlag),
			viper.GetString(s3RootFolderFlag),
			logger,
		)

		applymigrations(
			viper.GetBool(postgresMigrationsFlag),
			viper.GetString(postgresMigrationsSourceFlag),
			viper.GetBool(hasuraMetadataFlag),
			viper.GetString(graphqlEndpointFlag),
			viper.GetString(hasuraMetadataAdminSecretFlag),
			logger,
		)

		metadataStorage := getMetadataStorage(
			viper.GetString(graphqlEndpointFlag) + "/graphql",
		)
		router, err := getGin(
			metadataStorage,
			contentStorage,
			viper.GetStringSlice(trustedProxiesFlag),
			logger,
			viper.GetBool(debugFlag),
		)
		cobra.CheckErr(err)

		logger.Info("starting server")

		router.Use(cors.New(cors.Config{
			AllowOrigins: []string{"*"},
			AllowMethods: []string{"GET", "PUT", "POST", "HEAD", "DELETE"},
			AllowHeaders: []string{
				"Authorization", "Origin", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since",
			},
			ExposeHeaders: []string{
				"Content-Length", "Content-Type", "Cache-Control", "ETag", "Last-Modified", "X-Error",
			},
			MaxAge: 12 * time.Hour, // nolint: gomnd
		}))

		logger.Error(router.Run(viper.GetString(bindFlag)))
	},
}
