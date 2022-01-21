package main

import (
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/metadata"
	"github.com/nhost/hasura-storage/migrations"
	"github.com/nhost/hasura-storage/storage"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

const (
	name = "hasura-storage"
)

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

func main() {
	initFlags()
	if viper.GetBool("version") {
		fmt.Printf("%s-%s\n", name, controller.Version()) // nolint
		os.Exit(0)
	}

	logger := getLogger()

	logger.Info("storage version ", controller.Version())

	readConfiguration(logger)

	if viper.GetBool("debug") {
		logger.SetLevel(logrus.DebugLevel)
		gin.SetMode(gin.DebugMode)
	} else {
		logger.SetLevel(logrus.InfoLevel)
		gin.SetMode(gin.ReleaseMode)
	}

	logger.WithFields(
		logrus.Fields{
			"debug":               viper.GetBool("debug"),
			"bind":                viper.GetString("bind"),
			"graphql_endpoint":    viper.GetString("graphql_endpoint"),
			"postgres-migrations": viper.GetBool("postgres-migrations"),
			"hasura-metadata":     viper.GetBool("hasura-metadata"),
			"s3_endpoint":         viper.GetString("s3_endpoint"),
			"s3_region":           viper.GetString("s3_region"),
			"s3_bucket":           viper.GetString("s3_bucket"),
		},
	).Debug("parameters")

	metadataStorage := getMetadataStorage(
		viper.GetString("graphql_endpoint") + "/graphql",
	)

	contentStorage := getContentStorage(
		viper.GetString("s3_endpoint"),
		viper.GetString("s3_region"),
		viper.GetString("s3_access_key"),
		viper.GetString("s3_secret_key"),
		viper.GetString("s3_bucket"),
		viper.GetString("s3_root_folder"),
		logger,
	)

	applymigrations(
		viper.GetBool("postgres-migrations"),
		viper.GetString("postgres-migrations-source"),
		viper.GetBool("hasura-metadata"),
		viper.GetString("graphql_endpoint"),
		viper.GetString("hasura-metadata-admin-secret"),
		logger,
	)

	r := getGin(metadataStorage, contentStorage, logger, viper.GetBool("debug"))

	logger.Info("starting server")
	logger.Error(r.Run(viper.GetString("bind")))
}
