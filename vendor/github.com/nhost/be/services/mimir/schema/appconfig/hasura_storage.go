package appconfig

import (
	"fmt"
	"time"

	"github.com/nhost/be/services/mimir/model"
)

const (
	hasuraStoragePort             = 5000
	externalSecretRefreshInterval = 3 * time.Minute
	hasuraStoragePodAffinity      = "hasura"
)

const (
	secretHasuraStorageAdminSecret = "adminSecret"
	secretHasuraStorageDatabaseURL = "databaseUrl"
	secretHasuraStorageS3AccessKey = "s3AccessKey"
	secretHasuraStorageS3SecretKey = "s3SecretKey"
)

func HasuraStorageEnv( //nolint:funlen
	cfg *model.ConfigConfig,
	hasuraEndpoint,
	postgresURL,
	publicURL,
	s3Endpoint,
	s3Region,
	s3Bucket,
	s3RootFolder,
	s3AccessKey,
	s3SecretKey,
	antivirusServer string,
) ([]EnvVar, error) {
	env := []EnvVar{
		{
			Name:       "HASURA_GRAPHQL_ADMIN_SECRET",
			Value:      cfg.GetHasura().GetAdminSecret(),
			SecretName: secretHasuraStorageAdminSecret,
			IsSecret:   true,
		},
		{
			Name:       "BIND",
			Value:      fmt.Sprintf(":%d", hasuraStoragePort),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_METADATA",
			Value:      "1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_ENDPOINT",
			Value:      hasuraEndpoint,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "POSTGRES_MIGRATIONS",
			Value:      "1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "POSTGRES_MIGRATIONS_SOURCE",
			Value:      postgresURL,
			SecretName: secretHasuraStorageDatabaseURL,
			IsSecret:   true,
		},
		{
			Name:       "S3_ENDPOINT",
			Value:      s3Endpoint,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "S3_BUCKET",
			Value:      s3Bucket,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "S3_ROOT_FOLDER",
			Value:      s3RootFolder,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "S3_REGION",
			Value:      s3Region,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "PUBLIC_URL",
			Value:      publicURL,
			IsSecret:   false,
			SecretName: "",
		},
	}

	if s3AccessKey != "" {
		env = append(env,
			EnvVar{
				Name:       "S3_ACCESS_KEY",
				Value:      s3AccessKey,
				SecretName: secretHasuraStorageS3AccessKey,
				IsSecret:   true,
			},
			EnvVar{
				Name:       "S3_SECRET_KEY",
				Value:      s3SecretKey,
				SecretName: secretHasuraStorageS3SecretKey,
				IsSecret:   true,
			},
		)
	}

	if antivirusServer != "" {
		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  "CLAMAV_SERVER",
			Value: antivirusServer,
		})
	}

	return env, nil
}
