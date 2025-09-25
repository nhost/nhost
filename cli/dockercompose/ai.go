package dockercompose

import (
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func ai(
	cfg *model.ConfigConfig,
	subdomain string,
) *Service {
	envars := appconfig.AIEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		"postgres://postgres@postgres:5432/local?sslmode=disable",
		"http://storage:5000/v1",
		"",
	)

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image: "nhost/graphite:" + *cfg.GetAi().GetVersion(),
		DependsOn: map[string]DependsOn{
			"graphql": {
				Condition: "service_healthy",
			},
			"postgres": {
				Condition: "service_healthy",
			},
			"auth": {
				Condition: "service_healthy",
			},
		},
		EntryPoint: nil,
		Command: []string{
			"serve",
		},
		Environment: env,
		ExtraHosts:  extraHosts(subdomain),
		Labels:      nil,
		Ports:       nil,
		Restart:     "always",
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD", "graphite", "healthcheck",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "10s",
		},
		Volumes:    nil,
		WorkingDir: nil,
	}
}
