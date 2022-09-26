package compose

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

const (
	// docker compose service names
	SvcPostgres      = "postgres"
	SvcAuth          = "auth"
	SvcStorage       = "storage"
	SvcFunctions     = "functions"
	SvcMinio         = "minio"
	SvcMailhog       = "mailhog"
	SvcHasura        = "hasura"
	SvcTraefik       = "traefik"
	SvcGraphqlEngine = "graphql-engine"
	// --

	// container ports
	graphqlPort = 8080
	dbPort      = 5432
	proxyPort   = 1337
	// --

	// default docker images
	svcPostgresDefaultImage  = "nhost/postgres:14.5-20220831-1"
	svcAuthDefaultImage      = "nhost/hasura-auth:0.13.0"
	svcStorageDefaultImage   = "nhost/hasura-storage:0.2.4"
	svcFunctionsDefaultImage = "nhost/functions:0.1.3"
	svcMinioDefaultImage     = "minio/minio:RELEASE.2022-07-08T00-05-23Z"
	svcMailhogDefaultImage   = "mailhog/mailhog"
	svcHasuraDefaultImage    = "hasura/graphql-engine:v2.10.1"
	svcTraefikDefaultImage   = "traefik:v2.8"
	// --

	// volume names
	volFunctionsNodeModules = "functions_node_modules"
	volRootNodeModules      = "root_node_modules"
	// --

	// environment variables

	// envs prefixes
	envPrefixAuth    = "AUTH"
	envPrefixStorage = "STORAGE"

	// minio
	envMinioRootUser     = "MINIO_ROOT_USER"
	envMinioRootPassword = "MINIO_ROOT_PASSWORD"

	// auth
	envAuthSmtpHost   = "AUTH_SMTP_HOST"
	envAuthSmtpPort   = "AUTH_SMTP_PORT"
	envAuthSmtpUser   = "AUTH_SMTP_USER"
	envAuthSmtpPass   = "AUTH_SMTP_PASS"
	envAuthSmtpSecure = "AUTH_SMTP_SECURE"
	envAuthSmtpSender = "AUTH_SMTP_SENDER"

	// postgres
	envPostgresPassword = "POSTGRES_PASSWORD"
	envPostgresDb       = "POSTGRES_DB"
	envPostgresUser     = "POSTGRES_USER"
	envPostgresData     = "PGDATA"

	// default values for environment variables
	envPostgresDbDefaultValue       = "postgres"
	envPostgresUserDefaultValue     = "postgres"
	envPostgresPasswordDefaultValue = "postgres"
	envPostgresDataDefaultValue     = "/var/lib/postgresql/data/pgdata"

	// --
)

type Config struct {
	nhostConfig        *nhost.Configuration // nhost configuration
	gitBranch          string               // git branch name, used as a namespace for postgres data mounted from host
	composeConfig      *types.Config
	composeProjectName string
	dotenv             []string // environment variables from .env file
	ports              nhost.Ports
}

// HasuraCliVersion extracts version from Hasura CLI docker image. That allows us to keep the same version of Hasura CLI
// both in the docker image and in the hasura-cli on the host
func HasuraCliVersion() (string, error) {
	s := strings.SplitN(svcHasuraDefaultImage, ":", 2)
	if len(s) != 2 {
		return "", fmt.Errorf("invalid hasura cli version: %s", svcHasuraDefaultImage)
	}

	return s[1], nil
}

func NewConfig(conf *nhost.Configuration, p nhost.Ports, env []string, gitBranch, projectName string) *Config {
	return &Config{nhostConfig: conf, ports: p, dotenv: env, gitBranch: gitBranch, composeProjectName: projectName}
}

func (c Config) serviceDockerImage(svcName, dockerImageFallback string) string {
	if svcConf, ok := c.nhostConfig.Services[svcName]; ok && svcConf != nil {
		if svcConf.Image != "" {
			return svcConf.Image
		}
	}

	return dockerImageFallback
}

// serviceConfigEnvs returns environment variables from "services".$name."environment" section in yaml config
func (c *Config) serviceConfigEnvs(svc string) env {
	e := env{}

	if svcConf, ok := c.nhostConfig.Services[svc]; ok && svcConf != nil {
		e.mergeWithServiceEnv(svcConf.Environment)
	}

	return e
}

func (c *Config) build() *types.Config {
	config := &types.Config{}

	// build services, they may be nil
	services := []*types.ServiceConfig{
		c.traefikService(),
		c.postgresService(),
		c.hasuraService(),
		c.authService(),
		c.minioService(),
		c.storageService(),
		c.functionsService(),
		c.mailhogService(),
	}

	// set volumes
	config.Volumes = types.Volumes{
		volFunctionsNodeModules: types.VolumeConfig{},
		volRootNodeModules:      types.VolumeConfig{},
	}

	// loop over services and filter out nils, i.e. services that are not enabled
	for _, service := range services {
		if service != nil {
			config.Services = append(config.Services, *service)
		}
	}

	c.composeConfig = config

	return config
}

func (c *Config) BuildJSON() ([]byte, error) {
	return json.MarshalIndent(c.build(), "", "  ")
}

func (c Config) connectionStringForUser(user string) string {
	postgresEnv := c.postgresServiceEnvs()
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s@%s:%d/%s", user, SvcPostgres, dbPort, db)
}

func (c Config) PublicHasuraConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/graphql", c.ports.Proxy())
}

func (c Config) PublicAuthConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/auth", c.ports.Proxy())
}

func (c Config) PublicStorageConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/storage", c.ports.Proxy())
}

func (c Config) PublicFunctionsConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/functions", c.ports.Proxy())
}

func (c Config) PublicPostgresConnectionString() string {
	postgresEnv := c.postgresServiceEnvs()
	user := postgresEnv[envPostgresUser]
	password := postgresEnv[envPostgresPassword]
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s:%s@localhost:%d/%s", user, password, c.ports.DB(), db)
}

func (c Config) mailhogServiceEnvs() env {
	authEnv := c.authServiceEnvs()

	e := env{
		"SMTP_HOST":   authEnv[envAuthSmtpHost],
		"SMTP_PORT":   authEnv[envAuthSmtpPort],
		"SMTP_PASS":   authEnv[envAuthSmtpPass],
		"SMTP_USER":   authEnv[envAuthSmtpUser],
		"SMTP_SECURE": authEnv[envAuthSmtpSecure],
		"SMTP_SENDER": authEnv[envAuthSmtpSender],
	}

	e.merge(c.serviceConfigEnvs(SvcMailhog))
	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) runMailhogService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMailhog]; ok && conf != nil {
		if conf.NoContainer {
			return false
		}
	}

	authEnv := c.authServiceEnvs()

	return authEnv[envAuthSmtpHost] == SvcMailhog
}

func (c Config) mailhogService() *types.ServiceConfig {
	if !c.runMailhogService() {
		return nil
	}

	return &types.ServiceConfig{
		Name:        SvcMailhog,
		Environment: c.mailhogServiceEnvs().dockerServiceConfigEnv(),
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcMailhog, svcMailhogDefaultImage),
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    1025,
				Published: fmt.Sprint(c.ports.SMTP()),
				Protocol:  "tcp",
			},
			{
				Mode:      "ingress",
				Target:    8025,
				Published: fmt.Sprint(c.ports.Mailhog()),
				Protocol:  "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: MailHogDataDirGiBranchScopedPath(c.gitBranch),
				Target: "/maildir",
			},
		},
	}
}

func (c Config) minioServiceEnvs() env {
	e := env{
		envMinioRootUser:     nhost.MINIO_USER,
		envMinioRootPassword: nhost.MINIO_PASSWORD,
	}
	e.merge(c.serviceConfigEnvs(SvcMinio))
	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) RunMinioService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMinio]; ok && conf != nil {
		if conf.NoContainer {
			return false
		}
	}

	return true
}

func (c Config) minioService() *types.ServiceConfig {
	if !c.RunMinioService() {
		return nil
	}

	return &types.ServiceConfig{
		Name:        SvcMinio,
		Environment: c.minioServiceEnvs().dockerServiceConfigEnv(),
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcMinio, svcMinioDefaultImage),
		Command:     []string{"server", "/data", "--address", "0.0.0.0:9000", "--console-address", "0.0.0.0:8484"},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    9000,
				Published: fmt.Sprint(c.ports.MinioS3()),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   8484,
				Protocol: "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: MinioDataDirGitBranchScopedPath(c.gitBranch),
				Target: "/data",
			},
		},
	}
}

func (c Config) functionsServiceEnvs() env {
	e := env{}
	e.merge(env{
		"NHOST_BACKEND_URL":    c.envValueNhostBackendUrl(),
		"NHOST_ADMIN_SECRET":   util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET": util.WEBHOOK_SECRET,
		"NHOST_JWT_SECRET":     c.envValueHasuraGraphqlJwtSecret(),
	})
	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) functionsServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)
	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", "wget http://localhost:3000/healthz -q -O - > /dev/null 2>&1"},
		Interval:    &i,
		StartPeriod: &s,
	}
}

func (c Config) functionsService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable": "true",
		"traefik.http.middlewares.strip-functions.stripprefix.prefixes":                "/v1/functions",
		"traefik.http.middlewares.functions-cors.headers.accessControlAllowOriginList": "*",
		"traefik.http.middlewares.functions-cors.headers.accessControlAllowHeaders":    "origin,Accept,Authorization,Content-Type",
		"traefik.http.routers.functions.rule":                                          "PathPrefix(`/v1/functions`)",
		"traefik.http.routers.functions.middlewares":                                   "functions-cors@docker,strip-functions@docker",
		"traefik.http.routers.functions.entrypoints":                                   "web",
	}

	return &types.ServiceConfig{
		Name:        SvcFunctions,
		Image:       c.serviceDockerImage(SvcFunctions, svcFunctionsDefaultImage),
		Labels:      labels,
		Restart:     types.RestartPolicyAlways,
		Expose:      []string{"3000"},
		Environment: c.functionsServiceEnvs().dockerServiceConfigEnv(),
		HealthCheck: c.functionsServiceHealthcheck(time.Second*1, time.Minute*30), // 30 minutes is the maximum allowed time for a "functions" service to start, see more below
		// Probe failure during that period will not be counted towards the maximum number of retries
		// However, if a health check succeeds during the start period, the container is considered started and all
		// consecutive failures will be counted towards the maximum number of retries.
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: "..",
				Target: "/opt/project",
			},
			{
				Type:   types.VolumeTypeVolume,
				Source: volRootNodeModules,
				Target: "/opt/project/node_modules",
			},
			{
				Type:   types.VolumeTypeVolume,
				Source: volFunctionsNodeModules,
				Target: "/opt/project/functions/node_modules",
			},
		},
	}
}

func (c Config) storageServiceEnvs() env {
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
		"PUBLIC_URL":                  fmt.Sprintf("http://localhost:%d", c.ports.Proxy()),
		"API_ROOT_PREFIX":             "/v1/storage",
		"POSTGRES_MIGRATIONS":         "1",
		"HASURA_METADATA":             "1",
		"HASURA_ENDPOINT":             c.hasuraEndpoint(),
		"HASURA_GRAPHQL_ADMIN_SECRET": util.ADMIN_SECRET,
		"S3_ACCESS_KEY":               minioEnv[envMinioRootUser],
		"S3_SECRET_KEY":               minioEnv[envMinioRootPassword],
		"S3_ENDPOINT":                 s3Endpoint,
		"S3_BUCKET":                   "nhost",
		"HASURA_GRAPHQL_JWT_SECRET":   c.envValueHasuraGraphqlJwtSecret(),
		"NHOST_JWT_SECRET":            c.envValueHasuraGraphqlJwtSecret(),
		"NHOST_ADMIN_SECRET":          util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        util.WEBHOOK_SECRET,
		"POSTGRES_MIGRATIONS_SOURCE":  fmt.Sprintf("%s?sslmode=disable", c.connectionStringForUser("nhost_storage_admin")),
		"NHOST_BACKEND_URL":           c.envValueNhostBackendUrl(),
	}

	e.merge(c.serviceConfigEnvs(SvcStorage))
	e.mergeWithConfigEnv(c.nhostConfig.Storage, envPrefixStorage)
	e.mergeWithSlice(c.dotenv)

	return e
}

func (c Config) storageService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable":                           "true",
		"traefik.http.routers.storage.rule":        "PathPrefix(`/v1/storage`)",
		"traefik.http.routers.storage.entrypoints": "web",
	}

	return &types.ServiceConfig{
		Name:        SvcStorage,
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcStorage, svcStorageDefaultImage),
		Environment: c.storageServiceEnvs().dockerServiceConfigEnv(),
		Labels:      labels,
		Command:     []string{"serve"},
		Expose:      []string{"8576"},
	}
}

func (c Config) authServiceEnvs() env {
	e := env{
		"AUTH_HOST":                   "0.0.0.0",
		"HASURA_GRAPHQL_DATABASE_URL": c.connectionStringForUser("nhost_auth_admin"),
		"HASURA_GRAPHQL_GRAPHQL_URL":  fmt.Sprintf("%s/graphql", c.hasuraEndpoint()),
		"AUTH_SERVER_URL":             c.PublicAuthConnectionString(),
		"HASURA_GRAPHQL_JWT_SECRET":   c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET": util.ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":          util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        util.WEBHOOK_SECRET,
	}

	e.merge(c.serviceConfigEnvs(SvcAuth))
	e.mergeWithConfigEnv(c.nhostConfig.Auth, envPrefixAuth)
	e.mergeWithSlice(c.dotenv)

	return e
}

func (c Config) authServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)
	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", "wget http://localhost:4000/healthz -q -O - > /dev/null 2>&1"},
		Interval:    &i,
		StartPeriod: &s,
	}
}

func (c Config) authService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable": "true",
		"traefik.http.middlewares.strip-auth.stripprefix.prefixes": "/v1/auth",
		"traefik.http.routers.auth.rule":                           "PathPrefix(`/v1/auth`)",
		"traefik.http.routers.auth.middlewares":                    "strip-auth@docker",
		"traefik.http.routers.auth.entrypoints":                    "web",
	}

	return &types.ServiceConfig{
		Name:        SvcAuth,
		Image:       c.serviceDockerImage(SvcAuth, svcAuthDefaultImage),
		Environment: c.authServiceEnvs().dockerServiceConfigEnv(),
		Labels:      labels,
		Expose:      []string{"4000"},
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
			SvcGraphqlEngine: {
				Condition: types.ServiceConditionStarted,
			},
		},
		Restart:     types.RestartPolicyAlways,
		HealthCheck: c.authServiceHealthcheck(time.Second*3, time.Minute*5),
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: filepath.Join(nhost.DOT_NHOST_DIR, "custom"),
				Target: "/app/custom",
			},
			{
				Type:   types.VolumeTypeBind,
				Source: nhost.EMAILS_DIR,
				Target: "/app/email-templates",
			},
		},
	}
}

func (c Config) envValueNhostBackendUrl() string {
	return fmt.Sprintf("http://traefik:%d", proxyPort)
}

func (c Config) envValueHasuraGraphqlJwtSecret() string {
	return fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY)
}

func (c Config) hasuraEndpoint() string {
	return fmt.Sprintf("http://graphql-engine:%d/v1", graphqlPort)
}

func (c Config) hasuraServiceEnvs() env {
	e := env{
		"HASURA_GRAPHQL_DATABASE_URL":              c.connectionStringForUser("nhost_hasura"),
		"HASURA_GRAPHQL_JWT_SECRET":                c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET":              util.ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":                       util.ADMIN_SECRET,
		"NHOST_BACKEND_URL":                        c.envValueNhostBackendUrl(),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 "debug",
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
		"NHOST_WEBHOOK_SECRET":                     util.WEBHOOK_SECRET,
	}

	e.merge(c.serviceConfigEnvs(SvcHasura))
	e.mergeWithSlice(c.dotenv)

	return e
}

func (c Config) hasuraService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable":                          "true",
		"traefik.http.routers.hasura.rule":        "PathPrefix(`/v1/graphql`, `/v2/query`, `/v1/metadata`, `/v1/config`)",
		"traefik.http.routers.hasura.entrypoints": "web",
	}

	return &types.ServiceConfig{
		Name:        SvcGraphqlEngine,
		Image:       c.serviceDockerImage(SvcHasura, svcHasuraDefaultImage),
		Environment: c.hasuraServiceEnvs().dockerServiceConfigEnv(),
		Labels:      labels,
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    graphqlPort,
				Published: fmt.Sprint(c.ports.GraphQL()),
				Protocol:  "tcp",
			},
		},
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
		},
		Restart: types.RestartPolicyAlways,
	}
}

func (c Config) postgresServiceEnvs() env {
	e := env{
		envPostgresData:     envPostgresDataDefaultValue,
		envPostgresUser:     envPostgresUserDefaultValue,
		envPostgresPassword: envPostgresPasswordDefaultValue,
		envPostgresDb:       envPostgresDbDefaultValue,
	}

	e.merge(c.serviceConfigEnvs(SvcPostgres))
	e.mergeWithSlice(c.dotenv)

	return e
}

func (c Config) postgresServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)

	e := c.postgresServiceEnvs()
	pgUser := e[envPostgresUser]
	pgDb := e[envPostgresDb]

	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", fmt.Sprintf("pg_isready -U %s -d %s -q", pgUser, pgDb)},
		Interval:    &i,
		StartPeriod: &s,
	}
}

func (c Config) postgresService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name: SvcPostgres,
		// keep in mind that the provided postgres image should create schemas and triggers like in https://github.com/nhost/postgres/blob/ea53451b6df9f4b10ce515a2cefbd9ddfdfadb25/v12/db/0001-create-schema.sql
		Image:       c.serviceDockerImage(SvcPostgres, svcPostgresDefaultImage),
		Restart:     types.RestartPolicyAlways,
		Environment: c.postgresServiceEnvs().dockerServiceConfigEnv(),
		HealthCheck: c.postgresServiceHealthcheck(time.Second*3, time.Minute*2),
		Command: []string{
			"postgres",
			"-c", "config_file=/etc/postgresql.conf",
			"-c", "hba_file=/etc/pg_hba_local.conf",
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: DbDataDirGitBranchScopedPath(c.gitBranch, dataDirPgdata),
				Target: envPostgresDataDefaultValue,
			},
			{
				Type:   types.VolumeTypeBind,
				Source: DbDataDirGitBranchScopedPath(c.gitBranch, "pg_hba_local.conf"),
				Target: "/etc/pg_hba_local.conf",
			},
		},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    dbPort,
				Published: fmt.Sprint(c.ports.DB()),
				Protocol:  "tcp",
			},
		},
	}
}

func (c Config) traefikService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name:    SvcTraefik,
		Image:   c.serviceDockerImage(SvcTraefik, svcTraefikDefaultImage),
		Restart: types.RestartPolicyAlways,
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    proxyPort,
				Published: fmt.Sprint(c.ports.Proxy()),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   8080,
				Protocol: "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:     types.VolumeTypeBind,
				Source:   "/var/run/docker.sock",
				Target:   "/var/run/docker.sock",
				ReadOnly: true,
			},
		},
		Command: []string{
			"--api.insecure=true",
			"--providers.docker=true",
			"--providers.docker.exposedbydefault=false",
			fmt.Sprintf("--providers.docker.constraints=Label(`com.docker.compose.project`,`%s`)", c.composeProjectName),
			fmt.Sprintf("--entrypoints.web.address=:%d", proxyPort),
		},
	}
}
