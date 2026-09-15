package dockercompose

import (
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func ai(
	cfg *model.ConfigConfig,
) *Service {
	storageURL, authService := "http://storage:5000/v1", "auth"
	if engineEnabled(cfg) {
		storageURL, authService = "http://engine:8080/storage/v1", "engine"
	}

	envars := appconfig.AIEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		"postgres://postgres@postgres:5432/local?sslmode=disable",
		storageURL,
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
			authService: {
				Condition: "service_healthy",
			},
		},
		EntryPoint: nil,
		Command: []string{
			"serve",
		},
		Environment: env,
		ExtraHosts:  extraHosts,
		Labels:      nil,
		Networks:    nil,
		Ports:       nil,
		Restart:     "always",
		User:        nil,
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
