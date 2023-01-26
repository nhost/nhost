package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"path/filepath"
	"time"
)

func (c Config) authServiceEnvs() env {
	e := env{
		"AUTH_HOST":                   "0.0.0.0",
		"HASURA_GRAPHQL_DATABASE_URL": c.postgresConnectionStringForUser("nhost_auth_admin"),
		"HASURA_GRAPHQL_GRAPHQL_URL":  c.hasuraGraphqlAPIEndpoint(),
		"AUTH_SERVER_URL":             c.PublicAuthConnectionString(),
		"HASURA_GRAPHQL_JWT_SECRET":   c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET": util.ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":          util.ADMIN_SECRET,
		"NHOST_WEBHOOK_SECRET":        util.WEBHOOK_SECRET,
	}

	e.merge(c.serviceConfigEnvs(SvcAuth))
	e.mergeWithConfigEnv(c.nhostConfig.Auth, "AUTH")
	e.mergeWithSlice(c.dotenv)

	return e
}

func (c Config) authService() *types.ServiceConfig {
	sslLabels := makeTraefikServiceLabels(
		SvcAuth,
		withTLS(),
		withHost(HostLocalAuthNhostRun),
		withPathPrefix("/v1"),
		withStripPrefix("/v1"),
	)

	// deprecated endpoints
	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcAuth,
		withPathPrefix("/v1/auth"),
		withStripPrefix("/v1/auth"),
	)

	return &types.ServiceConfig{
		Name:        SvcAuth,
		Image:       c.serviceDockerImage(SvcAuth, svcAuthDefaultImage),
		Environment: c.authServiceEnvs().dockerServiceConfigEnv(),
		Labels:      mergeTraefikServiceLabels(sslLabels, httpLabels).AsMap(),
		Expose:      []string{"4000"},
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
			SvcGraphql: {
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

func (c Config) authServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)
	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", "wget http://localhost:4000/healthz -q -O - > /dev/null 2>&1"},
		Interval:    &i,
		StartPeriod: &s,
	}
}
