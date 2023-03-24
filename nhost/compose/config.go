package compose

import (
	"fmt"
	"strings"

	"github.com/nhost/cli/internal/ports"
	"gopkg.in/yaml.v3"

	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

const (
	// hosts
	hostDockerInternal = "host.docker.internal"
	hostGateway        = "host-gateway"

	// docker compose service names
	SvcPostgres  = "postgres"
	SvcAuth      = "auth"
	SvcStorage   = "storage"
	SvcFunctions = "functions"
	SvcMinio     = "minio"
	SvcMailhog   = "mailhog"
	SvcHasura    = "hasura"
	SvcTraefik   = "traefik"
	SvcGraphql   = "graphql"
	SvcDashboard = "dashboard"
	// --

	// container ports
	authPort        = 4000
	dashboardPort   = 3000
	functionsPort   = 3000
	mailhogUIPort   = 8025
	mailhogSMTPPort = 1025
	minioUIPort     = 8484
	minioS3Port     = 9000
	storagePort     = 8576
	graphqlPort     = 8080
	dbPort          = 5432
	traefikUIPort   = 8080
	proxyPort       = 1337
	proxySSLPort    = 443
	// --

	// default docker images
	svcDashboardDefaultImage = "nhost/dashboard:0.13.9"
	svcPostgresDefaultImage  = "nhost/postgres:14.5-20230104-1"
	svcAuthDefaultImage      = "nhost/hasura-auth:0.19.0"
	svcStorageDefaultImage   = "nhost/hasura-storage:0.3.0"
	svcFunctionsDefaultImage = "nhost/functions:0.1.8"
	svcMinioDefaultImage     = "minio/minio:RELEASE.2022-07-08T00-05-23Z"
	svcMailhogDefaultImage   = "mailhog/mailhog"
	svcHasuraDefaultImage    = "hasura/graphql-engine:v2.15.2"
	svcTraefikDefaultImage   = "traefik:v2.8"
	// --

	// volume names
	volFunctionsNodeModules = "functions_node_modules"
	volRootNodeModules      = "root_node_modules"
	// --
)

type Config struct {
	nhostConfig        *nhost.Configuration // nhost configuration
	gitBranch          string               // git branch name, used as a namespace for postgres data mounted from host
	composeConfig      *types.Config
	composeProjectName string
	dotenv             []string // environment variables from .env file
	ports              *ports.Ports
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

func NewConfig(conf *nhost.Configuration, p *ports.Ports, env []string, gitBranch, projectName string) *Config {
	return &Config{nhostConfig: conf, ports: p, dotenv: env, gitBranch: gitBranch, composeProjectName: projectName}
}

func (c Config) addExtraHosts(svc *types.ServiceConfig) *types.ServiceConfig {
	svc.ExtraHosts = map[string]string{
		hostDockerInternal:         hostGateway, // for Linux
		HostLocalDbNhostRun:        hostGateway,
		HostLocalHasuraNhostRun:    hostGateway,
		HostLocalGraphqlNhostRun:   hostGateway,
		HostLocalAuthNhostRun:      hostGateway,
		HostLocalStorageNhostRun:   hostGateway,
		HostLocalFunctionsNhostRun: hostGateway,
	}
	return svc
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
func (c Config) serviceConfigEnvs(svc string) env {
	e := env{}

	if svcConf, ok := c.nhostConfig.Services[svc]; ok && svcConf != nil {
		e.mergeWithServiceEnv(svcConf.Environment)
	}

	return e
}

func (c Config) build() *types.Config {
	config := &types.Config{}

	// build services, they may be nil
	services := []*types.ServiceConfig{
		// proxy service
		c.traefikService(),

		// database
		c.postgresService(),

		// backend services
		c.hasuraService(),
		c.authService(),
		c.storageService(),
		c.httpStorageService(),
		c.functionsService(),

		// extra services
		c.minioService(),
		c.mailhogService(),

		// ui
		c.dashboardService(),
	}

	// set volumes
	config.Volumes = types.Volumes{
		volFunctionsNodeModules: types.VolumeConfig{},
		volRootNodeModules:      types.VolumeConfig{},
	}

	// loop over services and filter out nils, i.e. services that are not enabled
	for _, service := range services {
		if service != nil {
			config.Services = append(config.Services, *c.addExtraHosts(service))
		}
	}

	c.composeConfig = config

	return config
}

func (c Config) BuildYAML() ([]byte, error) {
	return yaml.Marshal(c.build())
}

func (c Config) postgresConnectionStringForUser(user string) string {
	postgresEnv := c.postgresServiceEnvs()
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s@%s:%d/%s", user, HostLocalDbNhostRun, c.ports.DB(), db)
}

func (c Config) PublicHasuraGraphqlEndpoint() string {
	return HasuraGraphqlHostname(c.ports.SSLProxy()) + "/v1"
}

func (c Config) PublicHasuraEndpoint() string {
	return HasuraHostname(c.ports.SSLProxy())
}

func (c Config) PublicAuthConnectionString() string {
	return fmt.Sprintf("%s/v1", AuthHostname(c.ports.SSLProxy()))
}

func (c Config) PublicHasuraConsoleURL() string {
	return HasuraConsoleHostname(c.ports.HasuraConsole())
}

func (c Config) PublicHasuraConsoleRedirectURL() string {
	return HasuraConsoleRedirectHostname(c.ports.SSLProxy()) + "/console"
}

func (c Config) PublicStorageConnectionString() string {
	return fmt.Sprintf("%s/v1", StorageHostname(c.ports.SSLProxy()))
}

func (c Config) httpStorageEnvPublicURL() string {
	return HTTPStorageHostname(c.ports.Proxy())
}

func (c Config) storageEnvPublicURL() string {
	return StorageHostname(c.ports.SSLProxy())
}

func (c Config) PublicMailhogURL() string {
	return MailhogHostname(c.ports.Mailhog())
}

func (c Config) PublicFunctionsConnectionString() string {
	return fmt.Sprintf("%s/v1", FunctionsHostname(c.ports.SSLProxy()))
}

func (c Config) PublicPostgresConnectionString() string {
	postgresEnv := c.postgresServiceEnvs()
	user := postgresEnv[envPostgresUser]
	password := postgresEnv[envPostgresPassword]
	db := postgresEnv[envPostgresDb]

	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s", user, password, HostLocalDbNhostRun, c.ports.DB(), db)
}

func (c Config) PublicDashboardURL() string {
	return DashboardHostname(c.ports.Dashboard())
}

func (c Config) envValueHasuraGraphqlJwtSecret() string {
	return fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY)
}

// deprecated
func (c Config) envValueNhostBackendUrl() string {
	return fmt.Sprintf("http://traefik:%d", proxyPort)
}

func (c Config) envValueNhostHasuraURL() string {
	return c.PublicHasuraConsoleRedirectURL()
}

func (c Config) hasuraApiURL() string {
	return HasuraHostname(c.ports.SSLProxy())
}

func (c Config) hasuraMigrationsApiURL() string {
	return HasuraMigrationsAPIHostname(c.ports.HasuraConsoleAPI())
}
