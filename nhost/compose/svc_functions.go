package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/util"
	"time"
)

func (c Config) functionsServiceEnvs() env {
	e := env{}
	e.merge(env{
		"NHOST_BACKEND_URL":    c.envValueNhostBackendUrl(),
		"NHOST_SUBDOMAIN":      HostLocalDashboardNhostRun,
		"NHOST_REGION":         "",
		"NHOST_HASURA_URL":     c.envValueNhostHasuraURL(),
		"NHOST_GRAPHQL_URL":    c.PublicHasuraGraphqlEndpoint(),
		"NHOST_AUTH_URL":       c.PublicAuthConnectionString(),
		"NHOST_STORAGE_URL":    c.PublicStorageConnectionString(),
		"NHOST_FUNCTIONS_URL":  c.PublicFunctionsConnectionString(),
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
	sslLabels := makeTraefikServiceLabels(
		SvcFunctions,
		withTLS(),
		withPathPrefix("/v1"),
		withStripPrefix("/v1"),
		withHost(HostLocalFunctionsNhostRun),
	)

	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcFunctions,
		withPathPrefix("/v1/functions"),
		withStripPrefix("/v1/functions"),
	)

	return &types.ServiceConfig{
		Name:        SvcFunctions,
		Image:       c.serviceDockerImage(SvcFunctions, svcFunctionsDefaultImage),
		Labels:      mergeTraefikServiceLabels(sslLabels, httpLabels).AsMap(),
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
