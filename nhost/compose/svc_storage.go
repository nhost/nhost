package compose

import (
	"fmt"

	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/util"
)

func (c Config) storageServiceEnvs(apiRootPrefix, publicURL string) env {
	minioEnv := c.minioServiceEnvs()
	s3Endpoint := "http://minio:9000"

	if minioConf, ok := c.nhostConfig.Services[SvcMinio]; ok && minioConf != nil {
		if minioConf.NoContainer {
			s3Endpoint = minioConf.Address
		}
	}

	e := env{
		"DEBUG":                       "true",
		"BIND":                        ":8576",
		"PUBLIC_URL":                  publicURL,
		"API_ROOT_PREFIX":             apiRootPrefix,
		"POSTGRES_MIGRATIONS":         "1",
		"HASURA_METADATA":             "1",
		"HASURA_ENDPOINT":             "http://graphql:8080/v1",
		"HASURA_GRAPHQL_ADMIN_SECRET": util.ADMIN_SECRET,
		"S3_ACCESS_KEY":               minioEnv[envMinioRootUser],
		"S3_SECRET_KEY":               minioEnv[envMinioRootPassword],
		"S3_ENDPOINT":                 s3Endpoint,
		"S3_BUCKET":                   "nhost",
		"HASURA_GRAPHQL_JWT_SECRET":   c.envValueHasuraGraphqlJwtSecret(),
		"NHOST_JWT_SECRET":            c.envValueHasuraGraphqlJwtSecret(),
		"NHOST_ADMIN_SECRET":          util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        util.WEBHOOK_SECRET,
		"POSTGRES_MIGRATIONS_SOURCE":  fmt.Sprintf("%s?sslmode=disable", c.postgresConnectionStringForUser("nhost_storage_admin")),
	}

	e.merge(c.serviceConfigEnvs(SvcStorage))
	e.mergeWithConfigEnv(c.nhostConfig.Storage, "STORAGE")
	e.mergeWithSlice(c.dotenv)

	return e
}

// deprecated
// We need to keep this for backward compatibility with deprecated backend services where "API_ROOT_PREFIX" env differs
func (c Config) httpStorageService() *types.ServiceConfig {
	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcStorage,
		storagePort,
		withPathPrefix("/v1/storage"),
	)

	return &types.ServiceConfig{
		Name:        "http-" + SvcStorage,
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcStorage, svcStorageDefaultImage),
		Environment: c.storageServiceEnvs("/v1/storage", c.httpStorageEnvPublicURL()).dockerServiceConfigEnv(),
		Labels:      httpLabels.AsMap(),
		Command:     []string{"serve"},
	}
}

func (c Config) storageService() *types.ServiceConfig {
	sslLabels := makeTraefikServiceLabels(
		SvcStorage,
		storagePort,
		withTLS(),
		withPathPrefix("/v1"),
		withHost(HostLocalStorageNhostRun),
	)

	return &types.ServiceConfig{
		Name:        SvcStorage,
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcStorage, svcStorageDefaultImage),
		Environment: c.storageServiceEnvs("", c.storageEnvPublicURL()).dockerServiceConfigEnv(),
		Labels:      sslLabels.AsMap(),
		Command:     []string{"serve"},
	}
}
