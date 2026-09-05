package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

const constellationPort = 8000

func constellation( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	nhostFolder string,
	image string,
	hostOS string,
) (*Service, error) {
	envars, err := appconfig.ConstellationEnv(
		cfg,
		appconfig.ConstellationEnvInput{ //nolint:gosec // G101: local dev docker-compose connection string, not a secret
			PostgresConnection: "postgres://postgres:postgres@postgres:5432/local",
			NhostAuthURL:       URL(subdomain, svcAuth, httpPort, useTLS) + "/v1",
			NhostGraphqlURL:    URL(subdomain, svcGraphql, httpPort, useTLS) + "/v1",
			NhostStorageURL:    URL(subdomain, "storage", httpPort, useTLS) + "/v1",
			NhostFunctionsURL:  "http://functions:3000",
			Subdomain:          subdomain,
			Region:             "local",
			DashboardOrigin:    URL(subdomain, svcDashboard, httpPort, useTLS),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get constellation env vars: %w", err)
	}

	env := make(Environment, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image: image,
		DependsOn: map[string]DependsOn{
			svcPostgres: {Condition: serviceHealthy},
		},
		EntryPoint:  nil,
		Command:     []string{serve},
		Environment: env,
		ExtraHosts:  extraHosts,
		HealthCheck: &HealthCheck{
			Test: []string{
				healthCmd,
				wget,
				spider,
				"-S",
				fmt.Sprintf("http://localhost:%d/healthz", constellationPort),
			},
			Timeout:     healthTimeout,
			Interval:    "5s",
			StartPeriod: healthTimeout,
		},
		Labels: Ingresses{
			{
				Name:    "constellation",
				TLS:     useTLS,
				Rule:    traefikHostMatch(svcGraphql),
				Port:    constellationPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks: networkAliases("constellation-service"),
		Ports:    nil,
		Restart:  always,
		User:     hostUserSpec(hostOS),
		Volumes: []Volume{
			{
				Type:     bind,
				Source:   nhostFolder + "/metadata",
				Target:   "/metadata",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}, nil
}
