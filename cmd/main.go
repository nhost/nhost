package main

import (
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/metadata"
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

func getContentStorage(s3Endpoint, region, s3AccessKey, s3SecretKey, bucket, rootFolder string, logger *logrus.Logger) *storage.S3 {
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
			"debug":            viper.GetBool("debug"),
			"bind":             viper.GetString("bind"),
			"graphql_endpoint": viper.GetString("graphql_endpoint"),
			"s3_endpoint":      viper.GetString("s3_endpoint"),
			"s3_region":        viper.GetString("s3_region"),
			"s3_bucket":        viper.GetString("s3_bucket"),
		},
	).Debug("parameters")

	metadataStorage := getMetadataStorage(
		viper.GetString("graphql_endpoint"),
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

	r := getGin(metadataStorage, contentStorage, logger, viper.GetBool("debug"))

	logger.Info("starting server")
	logger.Error(r.Run(viper.GetString("bind")))
}
