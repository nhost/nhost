package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

const constellationPort = 8000

func constellation(
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	nhostFolder string,
	image string,
) (*Service, error) {
	envars, err := appconfig.ConstellationEnv(
		cfg,
		"postgres://postgres:postgres@postgres:5432/local",
		URL(subdomain, "auth", httpPort, useTLS)+"/v1",
		URL(subdomain, "graphql", httpPort, useTLS)+"/v1",
		URL(subdomain, "storage", httpPort, useTLS)+"/v1",
		"http://functions:3000",
		subdomain,
		"local",
		URL(subdomain, "dashboard", httpPort, useTLS),
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
		ExtraHosts:  extraHosts(subdomain),
		HealthCheck: nil,
		Labels: Ingresses{
			{
				Name: "constellation",
				TLS:  useTLS,
				Rule: traefikHostMatch("graphql") + "&& PathPrefix(`/v1`)",
				Port: constellationPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/.*)?",
					Replacement: "/v1/graphql",
				},
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
