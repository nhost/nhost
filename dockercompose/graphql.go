package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"golang.org/x/mod/semver"
)

func graphql( //nolint:funlen
	cfg *model.ConfigConfig,
	useTLS bool,
	httpPort, port uint,
) (*Service, error) {
	envars, err := appconfig.HasuraEnv(
		cfg,
		"local",
		"",
		"nhost.run",
		"postgres://nhost_hasura@postgres:5432/local",
		useTLS,
		httpPort,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get hasura env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image: fmt.Sprintf("nhost/graphql-engine:%s", *cfg.GetHasura().GetVersion()),
		DependsOn: map[string]DependsOn{
			"postgres": {
				Condition: "service_healthy",
			},
			"functions": {
				Condition: "service_healthy",
			},
		},
		EntryPoint:  nil,
		Command:     nil,
		Environment: env,
		ExtraHosts:  extraHosts(),
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL",
				"curl http://localhost:8080/healthz > /dev/null 2>&1",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			{
				Name: "graphql",
				TLS:  useTLS,
				Rule: "PathPrefix(`/v1`) && Host(`local.graphql.nhost.run`)",
				Port: hasuraPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/|$$)(.*)",
					Replacement: "/v1/graphql$$2",
				},
			},
			{
				Name:    "hasura",
				TLS:     useTLS,
				Rule:    "( PathPrefix(`/v1`) || PathPrefix(`/v2`) || PathPrefix(`/console/assets`) ) && Host(`local.hasura.nhost.run`)", //nolint:lll
				Port:    hasuraPort,
				Rewrite: nil,
			},
		}.Labels(),
		Ports:      ports(port, hasuraPort),
		Restart:    "always",
		Volumes:    nil,
		WorkingDir: nil,
	}, nil
}

func console( //nolint:funlen
	cfg *model.ConfigConfig,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	port uint,
) (*Service, error) {
	if semver.Compare(*cfg.GetHasura().GetVersion(), minimumHasuraVerson) < 0 {
		return nil, fmt.Errorf( //nolint:goerr113
			"hasura version must be at least %s",
			minimumHasuraVerson,
		)
	}

	scheme := "http"
	if useTLS {
		scheme = "https"
	}

	return &Service{
		Image: fmt.Sprintf(
			"nhost/graphql-engine:%s.cli-migrations-v3",
			*cfg.GetHasura().GetVersion(),
		),
		Command: []string{
			"bash", "-c",
			fmt.Sprintf(`
                hasura-cli \
                    console \
                    --no-browser \
                    --endpoint http://graphql:8080 \
                    --address 0.0.0.0 \
                    --console-port 9695 \
                    --api-port %d \
                    --api-host %s://local.hasura.nhost.run \
                    --console-hge-endpoint %s`, httpPort, scheme, URL("hasura", httpPort, useTLS)),
		},
		DependsOn: map[string]DependsOn{
			"graphql": {Condition: "service_healthy"},
		},
		EntryPoint: nil,
		Environment: map[string]string{
			"HASURA_GRAPHQL_ADMIN_SECRET": cfg.GetHasura().GetAdminSecret(),
			"HASURA_GRAPHQL_DATABASE_URL": "postgres://nhost_hasura@postgres:5432/local",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
			"local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway",
			"local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway",
			"local.hasura.nhost.run:0.0.0.0",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL",
				"timeout 1s bash -c ':> /dev/tcp/127.0.0.1/9695' || exit 1",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			{
				Name:    "console",
				TLS:     useTLS,
				Rule:    "Host(`local.hasura.nhost.run`)",
				Port:    consolePort,
				Rewrite: nil,
			},
			{
				Name:    "migrate",
				TLS:     useTLS,
				Rule:    "PathPrefix(`/apis/`) && Host(`local.hasura.nhost.run`)",
				Port:    httpPort,
				Rewrite: nil,
			},
		}.Labels(),
		Ports:   ports(port, consolePort),
		Restart: "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   nhostFolder,
				Target:   "/app",
				ReadOnly: new(bool),
			},
		},
		WorkingDir: ptr("/app"),
	}, nil
}
