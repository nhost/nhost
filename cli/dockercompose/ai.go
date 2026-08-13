package dockercompose

import (
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

// ai builds the graphite (AI) service. storageURL is graphite's hasura-storage
// endpoint and backendService is the service it waits on to be healthy: the
// standalone storage/auth setup points at the `storage` container via
// http://storage:5000/v1 and depends on `auth`, while the bundled engine points
// at http://engine:8080/storage/v1 and depends on `engine`.
func ai(
	cfg *model.ConfigConfig,
	storageURL string,
	backendService string,
) *Service {
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
			backendService: {
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
