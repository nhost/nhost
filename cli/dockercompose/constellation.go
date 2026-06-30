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
) (*Service, error) {
	envars, err := appconfig.ConstellationEnv(
		cfg,
		appconfig.ConstellationEnvInput{
			PostgresConnection: "postgres://postgres:postgres@postgres:5432/local",
			NhostAuthURL:       URL(subdomain, "auth", httpPort, useTLS) + "/v1",
			NhostGraphqlURL:    URL(subdomain, "graphql", httpPort, useTLS) + "/v1",
			NhostStorageURL:    URL(subdomain, "storage", httpPort, useTLS) + "/v1",
			NhostFunctionsURL:  "http://functions:3000",
			Subdomain:          subdomain,
			Region:             "local",
			DashboardOrigin:    URL(subdomain, "dashboard", httpPort, useTLS),
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
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint:  nil,
		Command:     []string{"serve"},
		Environment: env,
		ExtraHosts:  extraHosts,
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD",
				"wget",
				"--spider",
				"-S",
				fmt.Sprintf("http://localhost:%d/healthz", constellationPort),
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			{
				Name:    "constellation",
				TLS:     useTLS,
				Rule:    traefikHostMatch("graphql"),
				Port:    constellationPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks: networkAliases("constellation-service"),
		Ports:    nil,
		Restart:  "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   nhostFolder + "/metadata",
				Target:   "/metadata",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}, nil
}
