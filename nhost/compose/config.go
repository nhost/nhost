package compose

import (
	"encoding/json"
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"path/filepath"
	"strings"
	"time"
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
	SvcHasuraConsole = "hasura-console"
	SvcTraefik       = "traefik"
	SvcGraphqlEngine = "graphql-engine"
	// --

	// data directory names
	dataDirDb      = "db"
	dataDirMailhog = "mailhog"
	dataDirMinio   = "minio"
	// --

	// default docker images
	svcPostgresDefaultImage      = "nhost/postgres:12-v0.0.6"
	svcAuthDefaultImage          = "nhost/hasura-auth:0.6.3"
	svcStorageDefaultImage       = "nhost/hasura-storage:0.2.2"
	svcFunctionsDefaultImage     = "nhost/functions:0.0.2"
	svcMinioDefaultImage         = "minio/minio:RELEASE.2022-07-08T00-05-23Z"
	svcMailhogDefaultImage       = "mailhog/mailhog"
	svcHasuraDefaultImage        = "hasura/graphql-engine:v2.2.0"
	svcHasuraConsoleDefaultImage = "nhost/hasura-cli-docker:2.2.0"
	svcTraefikDefaultImage       = "traefik:v2.8"
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
	envPostgresDbDefaultValue        = "postgres"
	envPostgresUserDefaultValue      = "postgres"
	envPostgresPasswordDefaultValue  = "postgres"
	envPostgresDataDefaultValue      = "/var/lib/postgresql/data/pgdata"
	envMinioRootUserDefaultValue     = "minioaccesskey123123"
	envMinioRootPasswordDefaultValue = "minioaccesskey123123"

	// --
)

type Config struct {
	nhostConfig        *nhost.Configuration // nhost configuration
	gitBranch          string               // git branch name, used as a namespace for postgres data mounted from host
	composeConfig      *types.Config
	composeProjectName string
	dotenv             []string // environment variables from .env file
	ports              Ports
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

func NewConfig(conf *nhost.Configuration, p Ports, env []string, gitBranch, projectName string) *Config {
	if p == nil {
		p = DefaultPorts()
	}
	return &Config{nhostConfig: conf, ports: p, dotenv: env, gitBranch: gitBranch, composeProjectName: projectName}
}

func (c Config) serviceDockerImage(svcName, dockerImageFallback string) string {
	if svcConf, ok := c.nhostConfig.Services[svcName]; ok {
		if svcConf.Image != "" {
			return svcConf.Image
		}
	}

	return dockerImageFallback
}

// serviceConfigEnvs returns environment variables from "services".$name."environment" section in yaml config
func (c *Config) serviceConfigEnvs(svc string) env {
	e := env{}

	if svcConf, ok := c.nhostConfig.Services[svc]; ok {
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
		c.hasuraConsoleService(),
		c.authService(),
		c.minioService(),
		c.storageService(),
		c.functionsService(),
		c.mailhogService(),
	}

	// loop over services and filter out nils, i.e. services that are not enabled
	for _, service := range services {
		if service != nil {
			config.Services = append(config.Services, *service)
		}
	}

	// set volumes
	config.Volumes = types.Volumes{
		"functions_node_modules": types.VolumeConfig{},
	}

	c.composeConfig = config

	return config
}

func (c Config) hostDataDirectory(path string) string {
	return filepath.Join("data", path)
}

func (c Config) hostDataDirectoryBranchScoped(path string) string {
	return filepath.Join("data", path, c.gitBranch)
}

func (c *Config) BuildJSON() ([]byte, error) {
	return json.MarshalIndent(c.build(), "", "  ")
}

func (c Config) postgresConnectionString() string {
	postgresEnv := c.postgresServiceEnvs()
	user := postgresEnv[envPostgresUser]
	password := postgresEnv[envPostgresPassword]
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s", user, password, SvcPostgres, svcPostgresDefaultPort, db)
}

func (c Config) PublicHasuraConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/graphql", c.ports[SvcGraphqlEngine])
}

func (c Config) PublicAuthConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/auth", c.ports[SvcTraefik])
}

func (c Config) PublicStorageConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/storage", c.ports[SvcTraefik])
}

func (c Config) PublicFunctionsConnectionString() string {
	return fmt.Sprintf("http://localhost:%d/v1/functions", c.ports[SvcTraefik])
}

func (c Config) PublicHasuraConsole() string {
	return fmt.Sprintf("http://localhost:%d", c.ports[SvcTraefik])
}

func (c Config) PublicPostgresConnectionString() string {
	postgresEnv := c.postgresServiceEnvs()
	user := postgresEnv[envPostgresUser]
	password := postgresEnv[envPostgresPassword]
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s:%s@localhost:%d/%s", user, password, c.ports[SvcPostgres], db)
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
	return e
}

func (c Config) runMailhogService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMailhog]; ok {
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
				Published: fmt.Sprint(c.ports[SvcMailhog]),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   8025,
				Protocol: "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: c.hostDataDirectory(dataDirMailhog),
				Target: "/maildir",
			},
		},
	}
}

func (c Config) minioServiceEnvs() env {
	e := env{
		envMinioRootUser:     envMinioRootUserDefaultValue,
		envMinioRootPassword: envMinioRootPasswordDefaultValue,
	}
	e.merge(c.serviceConfigEnvs(SvcMinio))
	return e
}

func (c Config) runMinioService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMinio]; ok {
		if conf.NoContainer {
			return false
		}
	}

	return true
}

func (c Config) minioService() *types.ServiceConfig {
	if !c.runMinioService() {
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
				Mode:     "ingress",
				Target:   9000,
				Protocol: "tcp",
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
				Source: c.hostDataDirectory(dataDirMinio),
				Target: "/data",
			},
		},
	}
}

func (c Config) functionsServiceEnvs() env {
	e := env{}
	e.mergeWithSlice(c.dotenv)
	e.merge(env{
		"NHOST_BACKEND_URL":    c.envValueNhostBackendUrl(),
		"NHOST_ADMIN_SECRET":   util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET": util.WEBHOOK_SECRET,
		"NHOST_JWT_SECRET":     c.envValueHasuraGraphqlJwtSecret(),
	})

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
		HealthCheck: c.functionsServiceHealthcheck(time.Second*3, time.Minute*5),
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: "..",
				Target: "/opt/project",
			},
			{
				Type:   types.VolumeTypeVolume,
				Source: "functions_node_modules",
				Target: "/opt/project/node_modules",
			},
		},
	}
}

func (c Config) storageServiceEnvs() env {
	minioEnv := c.minioServiceEnvs()
	s3Endpoint := "http://minio:9000"

	if minioConf, ok := c.nhostConfig.Services[SvcMinio]; ok {
		if minioConf.NoContainer {
			s3Endpoint = minioConf.Address
		}
	}

	e := env{
		"DEBUG":                       "true",
		"BIND":                        ":8576",
		"PUBLIC_URL":                  "http://localhost:8576",
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
		"POSTGRES_MIGRATIONS_SOURCE":  fmt.Sprintf("%s?sslmode=disable", c.postgresConnectionString()),
		"NHOST_BACKEND_URL":           c.envValueNhostBackendUrl(),
	}

	e.merge(c.serviceConfigEnvs(SvcStorage))
	e.mergeWithConfigEnv(c.nhostConfig.Storage, envPrefixStorage)

	return e
}

func (c Config) storageService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable":                           "true",
		"traefik.http.routers.storage.rule":        "PathPrefix(`/v1/storage`)",
		"traefik.http.routers.storage.entrypoints": "web",
		// Rewrite the path so it matches with the new storage API path introduced in hasura-storage 0.2
		"traefik.http.middlewares.strip-suffix.replacepathregex.regex":       "^/v1/storage/(.*)",
		"traefik.http.middlewares.strip-suffix.replacepathregex.replacement": "/v1/$$1",
		"traefik.http.routers.storage.middlewares":                           "strip-suffix@docker",
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
		"HASURA_GRAPHQL_DATABASE_URL": c.postgresConnectionString(),
		"HASURA_GRAPHQL_GRAPHQL_URL":  fmt.Sprintf("%s/graphql", c.hasuraEndpoint()),
		"HASURA_GRAPHQL_JWT_SECRET":   c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET": util.ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":          util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        util.WEBHOOK_SECRET,
	}

	e.merge(c.serviceConfigEnvs(SvcAuth))
	e.mergeWithConfigEnv(c.nhostConfig.Auth, envPrefixAuth)

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
	return "http://traefik:1337"
}

func (c Config) envValueHasuraGraphqlJwtSecret() string {
	return fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY)
}

func (c Config) hasuraEndpoint() string {
	return fmt.Sprintf("http://graphql-engine:%d/v1", svcHasuraDefaultPort)
}

func (c Config) hasuraServiceEnvs() env {
	e := env{
		"HASURA_GRAPHQL_DATABASE_URL":              c.postgresConnectionString(),
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

	e.mergeWithSlice(c.dotenv)
	e.merge(c.serviceConfigEnvs(SvcHasura))

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
				Target:    svcHasuraDefaultPort,
				Published: fmt.Sprint(c.ports[SvcGraphqlEngine]),
				Protocol:  "tcp",
			},
		},
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
			SvcFunctions: {
				Condition: types.ServiceConditionHealthy,
			},
		},
		Restart: types.RestartPolicyAlways,
	}
}

func (c Config) hasuraConsoleServiceEnvs() env {
	return env{
		"HASURA_GRAPHQL_DATABASE_URL":              c.postgresConnectionString(),
		"HASURA_GRAPHQL_JWT_SECRET":                c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET":              util.ADMIN_SECRET,
		"HASURA_GRAPHQL_ENDPOINT":                  fmt.Sprintf("http://127.0.0.1:%d", c.ports[SvcGraphqlEngine]),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 "debug",
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_RUN_CONSOLE":                       "true",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
		"GRAPHQL_PORT":                             fmt.Sprint(c.ports[SvcGraphqlEngine]),
		"API_PORT":                                 fmt.Sprint(c.ports[SvcHasuraConsole]),
	}
}

func (c Config) hasuraConsoleService() *types.ServiceConfig {
	labels := map[string]string{
		"traefik.enable": "true",
		"traefik.http.services.hasura-console.loadbalancer.server.port": "9695",
		"traefik.http.routers.hasura-console.rule":                      "PathPrefix(`/`)",
		"traefik.http.routers.hasura-console.entrypoints":               "web",
	}

	return &types.ServiceConfig{
		Name:        SvcHasuraConsole,
		Image:       c.serviceDockerImage(SvcHasuraConsole, svcHasuraConsoleDefaultImage),
		Environment: c.hasuraConsoleServiceEnvs().dockerServiceConfigEnv(),
		Labels:      labels,
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
			SvcGraphqlEngine: {
				Condition: types.ServiceConditionStarted,
			},
			SvcFunctions: {
				Condition: types.ServiceConditionHealthy,
			},
		},
		Ports: []types.ServicePortConfig{
			{
				Mode:     "ingress",
				Target:   9695,
				Protocol: "tcp",
			},
			{
				Mode:      "ingress",
				Target:    9693,
				Published: fmt.Sprint(c.ports[SvcHasuraConsole]),
				Protocol:  "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: "../nhost",
				Target: "/usr/src/hasura",
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
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: c.hostDataDirectoryBranchScoped(dataDirDb),
				Target: envPostgresDataDefaultValue,
			},
		},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    svcPostgresDefaultPort,
				Published: fmt.Sprint(c.ports[SvcPostgres]),
				Protocol:  "tcp",
			},
		},
	}
}

func (c Config) serverPort() uint32 {
	return c.ports[SvcTraefik]
}

func (c Config) traefikService() *types.ServiceConfig {
	port := c.serverPort()

	return &types.ServiceConfig{
		Name:    SvcTraefik,
		Image:   c.serviceDockerImage(SvcTraefik, svcTraefikDefaultImage),
		Restart: types.RestartPolicyAlways,
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    serverDefaultPort,
				Published: fmt.Sprint(port),
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
			fmt.Sprintf("--entrypoints.web.address=:%d", serverDefaultPort),
		},
	}
}
