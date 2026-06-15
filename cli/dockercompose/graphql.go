package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"golang.org/x/mod/semver"
)

func graphql( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort, port uint,
) (*Service, error) {
	constellationEnabled := cfg.GetExperimental().GetConstellation() != nil

	envars, err := appconfig.HasuraEnv(
		cfg,
		subdomain,
		"local",
		"nhost.run",
		"postgres://nhost_hasura@postgres:5432/local",
		URL(subdomain, "dashboard", httpPort, useTLS),
		useTLS,
		httpPort,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get hasura env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		if v.Name == "HASURA_GRAPHQL_CORS_DOMAIN" && v.Value != "*" {
			v.Value += "," + URL("*", "hasura", httpPort, useTLS)
			v.Value += "," + URL("*", "dashboard", httpPort, useTLS)
		}

		env[v.Name] = v.Value
	}

	labels := Ingresses{
		{
			Name: "hasura",
			TLS:  useTLS,
			Rule: traefikHostMatch(
				"hasura",
			) + "&& ( PathPrefix(`/v1`) || PathPrefix(`/v2`) || PathPrefix(`/api/`) || PathPrefix(`/console/assets`) )", //nolint:lll
			Port:    hasuraPort,
			Rewrite: nil,
		},
	}

	if !constellationEnabled {
		labels = append(
			labels, Ingress{
				Name: "graphql",
				TLS:  useTLS,
				Rule: traefikHostMatch("graphql") + "&& PathPrefix(`/v1`)",
				Port: hasuraPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/|$$)(.*)",
					Replacement: "/v1/graphql$$2",
				},
			},
		)
	}

	return &Service{
		Image: "nhost/graphql-engine:" + *cfg.GetHasura().GetVersion(),
		DependsOn: map[string]DependsOn{
			"postgres": {
				Condition: "service_healthy",
			},
		},
		EntryPoint:  nil,
		Command:     nil,
		Environment: env,
		ExtraHosts:  extraHosts(subdomain),
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL",
				"curl http://localhost:8080/healthz > /dev/null 2>&1",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels:     labels.Labels(),
		Networks:   networkAliases("hasura-service"),
		Ports:      ports(port, hasuraPort),
		Restart:    "always",
		Volumes:    nil,
		WorkingDir: nil,
	}, nil
}

func console( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	port uint,
) (*Service, error) {
	if semver.Compare(*cfg.GetHasura().GetVersion(), minimumHasuraVerson) < 0 {
		return nil, fmt.Errorf( //nolint:err113
			"hasura version must be at least %s",
			minimumHasuraVerson,
		)
	}

	scheme := schemeHTTP
	if useTLS {
		scheme = schemeHTTPS
	}

	envars, err := appconfig.HasuraEnv(
		cfg,
		subdomain,
		"local",
		"nhost.run",
		"postgres://nhost_hasura@postgres:5432/local",
		URL(subdomain, "dashboard", httpPort, useTLS),
		useTLS,
		httpPort,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get hasura env vars: %w", err)
	}

	// The console container hosts hasura-cli on port 9695 and serves
	// itself under <subdomain>.hasura.local.nhost.run. Pin that hostname
	// to 0.0.0.0 inside this container so the console's API discovery
	// loops back to itself instead of round-tripping through traefik.
	extraHosts := append( //nolint:gocritic
		extraHosts(subdomain),
		subdomain+".hasura.local.nhost.run:0.0.0.0",
	)

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		if v.Name == "HASURA_GRAPHQL_CORS_DOMAIN" && v.Value != "*" {
			v.Value += "," + URL("*", "hasura", httpPort, useTLS)
		}

		env[v.Name] = v.Value
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
                    --api-host %s://%s.hasura.local.nhost.run \
                    --console-hge-endpoint %s`,
				httpPort, scheme, subdomain, URL(subdomain, "hasura", httpPort, useTLS)),
		},
		DependsOn: map[string]DependsOn{
			"graphql": {Condition: "service_healthy"},
		},
		EntryPoint:  nil,
		Environment: env,
		ExtraHosts:  extraHosts,
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
				Rule:    traefikHostMatch("hasura"),
				Port:    consolePort,
				Rewrite: nil,
			},
			{
				Name:    "migrate",
				TLS:     useTLS,
				Rule:    traefikHostMatch("hasura") + "&& PathPrefix(`/apis/`)",
				Port:    httpPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks: nil,
		Ports:    ports(port, consolePort),
		Restart:  "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   nhostFolder,
				Target:   "/app",
				ReadOnly: new(bool),
			},
		},
		WorkingDir: new("/app"),
	}, nil
}
