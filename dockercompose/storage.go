package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func deptr[T any](t *T) T { //nolint:ireturn
	if t == nil {
		return *new(T)
	}
	return *t
}

func storage( //nolint:funlen
	cfg *model.ConfigConfig,
	useTLS bool,
	httpPort uint,
	exposePort uint,
) (*Service, error) {
	envars, err := appconfig.HasuraStorageEnv(
		cfg,
		"http://graphql:8080/v1",
		"postgres://nhost_storage_admin@postgres:5432/local?sslmode=disable",
		URL("storage", httpPort, useTLS),
		"http://minio:9000",
		"",
		"nhost",
		"",
		"minioaccesskey123123",
		"minioaccesskey123123",
		deptr(cfg.Storage.GetAntivirus().GetServer()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image: fmt.Sprintf("nhost/hasura-storage:%s", *cfg.GetStorage().GetVersion()),
		DependsOn: map[string]DependsOn{
			"minio": {
				Condition: "service_started",
			},
			"graphql": {
				Condition: "service_healthy",
			},
			"postgres": {
				Condition: "service_healthy",
			},
		},
		EntryPoint: nil,
		Command: []string{
			"serve",
		},
		Environment: env,
		ExtraHosts:  extraHosts(),
		Labels: Ingresses{
			{
				Name:    "storage",
				TLS:     useTLS,
				Rule:    "PathPrefix(`/v1`) && Host(`local.storage.nhost.run`)",
				Port:    storagePort,
				Rewrite: nil,
			},
		}.Labels(),
		Ports:       ports(exposePort, storagePort),
		Restart:     "always",
		HealthCheck: nil,
		Volumes:     nil,
		WorkingDir:  nil,
	}, nil
}
