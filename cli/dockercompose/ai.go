package dockercompose

import (
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func ai(
	cfg *model.ConfigConfig,
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
			svcGraphql: {
				Condition: serviceHealthy,
			},
			svcPostgres: {
				Condition: serviceHealthy,
			},
			svcAuth: {
				Condition: serviceHealthy,
			},
		},
		EntryPoint: nil,
		Command: []string{
			serve,
		},
		Environment: env,
		ExtraHosts:  extraHosts,
		Labels:      nil,
		Networks:    nil,
		Ports:       nil,
		Restart:     always,
		User:        nil,
		HealthCheck: &HealthCheck{
			Test: []string{
				healthCmd, "graphite", "healthcheck",
			},
			Timeout:     healthTimeout,
			Interval:    "5s",
			StartPeriod: "10s",
		},
		Volumes:    nil,
		WorkingDir: nil,
	}
}
