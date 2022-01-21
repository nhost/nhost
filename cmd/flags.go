package main

import (
	"errors"

	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

func initFlags() {
	pflag.Bool("version", false, "Print version and exit")
	pflag.Bool("debug", false, "enable debug messages")
	pflag.String("bind", ":8000", "bind the service to this address")

	{
		pflag.String("graphql_endpoint", "", "Use this endpoint when connecting using graphql as metadata storage")
	}
	{
		pflag.String("s3_endpoint", "", "S3 Endpoint")
		pflag.String("s3_access_key", "", "S3 Access key")
		pflag.String("s3_secret_key", "", "S3 Secret key")
		pflag.String("s3_region", "", "S3 region")
		pflag.String("s3_bucket", "", "S3 bucket")
		pflag.String("s3_root_folder", "", "All buckets will be created inside this root")
	}
	{
		pflag.Bool("postgres-migrations", false, "Apply Postgres migrations")
		pflag.String("postgres-migrations-source", "", "postgres connection, i.e. postgres://user@pass:localhost:5432/mydb")
	}
	{
		pflag.Bool("hasura-metadata", false, "Apply Hasura's metadata")
		pflag.String("hasura-metadata-admin-secret", "", "")
	}

	pflag.Parse()

	if err := viper.BindPFlags(pflag.CommandLine); err != nil {
		panic(err)
	}
}

func readConfiguration(logger *logrus.Logger) {
	viper.AutomaticEnv()
	viper.SetConfigName(name)
	viper.AddConfigPath("$HOME")
	viper.AddConfigPath(".")

	err := viper.ReadInConfig()
	if err != nil {
		if errors.As(err, &viper.ConfigFileNotFoundError{}) {
			logger.Warn("configuration file not found")
		} else {
			logger.Errorf("configuration file found but failed to load: %s", err)
		}
	}
}
