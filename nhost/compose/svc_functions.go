package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost/envvars"
	"time"
)

func (c Config) functionsServiceEnvs() envvars.Env {
	return c.nhostSystemEnvs().Merge(c.globalEnvs)
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
		functionsPort,
		withTLS(),
		withPathPrefix("/v1"),
		withStripPrefix("/v1"),
		withHost(HostLocalFunctionsNhostRun),
	)

	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcFunctions,
		functionsPort,
		withPathPrefix("/v1/functions"),
		withStripPrefix("/v1/functions"),
	)

	return &types.ServiceConfig{
		Name:        SvcFunctions,
		Image:       "nhost/functions:0.1.8",
		Labels:      mergeTraefikServiceLabels(sslLabels, httpLabels).AsMap(),
		Restart:     types.RestartPolicyAlways,
		Environment: c.functionsServiceEnvs().ToDockerServiceConfigEnv(),
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
