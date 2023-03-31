package compose

import (
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost/envvars"
	"gopkg.in/yaml.v3"

	"github.com/compose-spec/compose-go/types"
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

	// volume names
	volFunctionsNodeModules = "functions_node_modules"
	volRootNodeModules      = "root_node_modules"
	// --

	// providers
	providerTwilio = "twilio"
)

type Config struct {
	nhostConfig        *model.ConfigConfig // nhost configuration
	gitBranch          string              // git branch name, used as a namespace for postgres data mounted from host
	composeConfig      *types.Config
	composeProjectName string
	ports              *ports.Ports
	globalEnvs         envvars.Env
}

func NewConfig(conf *model.ConfigConfig, p *ports.Ports, gitBranch, projectName string) *Config {
	return &Config{
		nhostConfig:        conf,
		globalEnvs:         configGlobalEnvVarsToEnvVars(conf),
		ports:              p,
		gitBranch:          gitBranch,
		composeProjectName: projectName,
	}
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

func (c Config) twilioSettings() (accountSid, authToken, messagingServiceId string) {
	providerConf := c.nhostConfig.GetProvider()
	providerName := strings.ToLower(generichelper.DerefPtr(providerConf.GetSms().GetProvider()))

	if providerName == providerTwilio {
		accountSid = providerConf.Sms.AccountSid
		authToken = providerConf.Sms.AuthToken
		messagingServiceId = providerConf.Sms.MessagingServiceId
	}

	return
}

func (c Config) graphqlJwtSecret() string {
	hasuraConf := c.nhostConfig.GetHasura()
	var graphqlJwtSecret string

	if len(hasuraConf.GetJwtSecrets()) > 0 {
		graphqlJwtSecret = fmt.Sprintf(
			`{"type":"%s", "key": "%s"}`,
			generichelper.DerefPtr(hasuraConf.JwtSecrets[0].Type),
			generichelper.DerefPtr(hasuraConf.JwtSecrets[0].Key),
		)
	}

	return graphqlJwtSecret
}

func (c Config) build() *types.Config {
	conf := &types.Config{}

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
	conf.Volumes = types.Volumes{
		volFunctionsNodeModules: types.VolumeConfig{},
		volRootNodeModules:      types.VolumeConfig{},
	}

	// loop over services and filter out nils, i.e. services that are not enabled
	for _, service := range services {
		if service != nil {
			conf.Services = append(conf.Services, *c.addExtraHosts(service))
		}
	}

	c.composeConfig = conf

	return conf
}

func (c Config) smtpSettings() *model.ConfigSmtp {
	// use smtp settings if they are provided
	if c.nhostConfig.GetProvider().GetSmtp() != nil {
		return c.nhostConfig.GetProvider().GetSmtp()
	}

	// otherwise use mailhog
	return &model.ConfigSmtp{
		User:     "user",
		Password: "password",
		Sender:   "hasura-auth@example.com",
		Host:     "mailhog",
		Port:     uint16(ports.DefaultSMTPPort),
		Secure:   false,
		Method:   "PLAIN",
	}
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

func (c Config) nhostSystemEnvs() envvars.Env {
	hasuraConf := c.nhostConfig.GetHasura()
	return envvars.Env{
		"NHOST_BACKEND_URL":    c.envValueNhostBackendUrl(),
		"NHOST_SUBDOMAIN":      SubdomainLocal,
		"NHOST_REGION":         "",
		"NHOST_HASURA_URL":     c.envValueNhostHasuraURL(),
		"NHOST_GRAPHQL_URL":    c.PublicHasuraGraphqlEndpoint(),
		"NHOST_AUTH_URL":       c.PublicAuthConnectionString(),
		"NHOST_STORAGE_URL":    c.PublicStorageConnectionString(),
		"NHOST_FUNCTIONS_URL":  c.PublicFunctionsConnectionString(),
		"NHOST_ADMIN_SECRET":   escapeDollarSignForDockerCompose(hasuraConf.GetAdminSecret()),
		"NHOST_WEBHOOK_SECRET": escapeDollarSignForDockerCompose(hasuraConf.GetWebhookSecret()),
		"NHOST_JWT_SECRET":     escapeDollarSignForDockerCompose(c.graphqlJwtSecret()),
	}
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

func configGlobalEnvVarsToEnvVars(conf *model.ConfigConfig) envvars.Env {
	envs := envvars.Env{}
	globalEnvs := conf.GetGlobal().GetEnvironment()
	for _, env := range globalEnvs {
		envs[env.GetName()] = env.GetValue()
	}
	return envs
}

// prevents '$' from being replaced by docker-compose, see https://docs.docker.com/compose/compose-file/compose-file-v2/#variable-substitution
func escapeDollarSignForDockerCompose(v string) string {
	return strings.ReplaceAll(v, "$", "$$")
}
