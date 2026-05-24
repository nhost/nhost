package dockercompose //nolint:testpackage

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

const constellationJWTSecret = `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}` //nolint:gosec

func expectedConstellation() *Service {
	return &Service{
		Image: "nhost/constellation:0.0.1",
		DependsOn: map[string]DependsOn{
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint: nil,
		Command:    []string{"serve"},
		Environment: map[string]string{
			"CONSTELLATION_ADMIN_SECRET":               "adminSecret",
			"CONSTELLATION_CORS_ALLOWED_ORIGINS":       "http://dev.dashboard.local.nhost.run:1337,http://localhost:3000",
			"CONSTELLATION_DEBUG":                      "false",
			"CONSTELLATION_DEV_MODE":                   "false",
			"CONSTELLATION_JWT_SECRET":                 constellationJWTSecret,
			"CONSTELLATION_METADATA_DATABASE_URL":      "postgres://postgres:postgres@postgres:5432/local",
			"CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL": "1s",
			"ENV1":                        "VALUE1",
			"ENV2":                        "VALUE2",
			"GRAPHITE_WEBHOOK_SECRET":     "webhookSecret",
			"HASURA_GRAPHQL_DATABASE_URL": "postgres://postgres:postgres@postgres:5432/local",
			"NHOST_ADMIN_SECRET":          "adminSecret",
			"NHOST_AUTH_URL":              "http://dev.auth.local.nhost.run:1337/v1",
			"NHOST_FUNCTIONS_URL":         "http://functions:3000",
			"NHOST_GRAPHQL_DATABASE_URL":  "postgres://postgres:postgres@postgres:5432/local",
			"NHOST_GRAPHQL_URL":           "http://dev.graphql.local.nhost.run:1337/v1",
			"NHOST_JWT_SECRET":            constellationJWTSecret,
			"NHOST_REGION":                "local",
			"NHOST_STORAGE_URL":           "http://dev.storage.local.nhost.run:1337/v1",
			"NHOST_SUBDOMAIN":             "dev",
			"NHOST_WEBHOOK_SECRET":        "webhookSecret",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
			"dev.auth.local.nhost.run:host-gateway",
			"dev.db.local.nhost.run:host-gateway",
			"dev.functions.local.nhost.run:host-gateway",
			"dev.graphql.local.nhost.run:host-gateway",
			"dev.hasura.local.nhost.run:host-gateway",
			"dev.storage.local.nhost.run:host-gateway",
			"local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway",
			"local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway",
			"local.hasura.nhost.run:host-gateway",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: nil,
		Labels: map[string]string{
			"traefik.enable": "true",
			"traefik.http.middlewares.replace-constellation.replacepathregex.regex":       "/v1(/.*)?",
			"traefik.http.middlewares.replace-constellation.replacepathregex.replacement": "/graphql",
			"traefik.http.routers.constellation.entrypoints":                              "web",
			"traefik.http.routers.constellation.middlewares":                              "replace-constellation",
			"traefik.http.routers.constellation.rule":                                     "(HostRegexp(`^.+\\.graphql\\.local\\.nhost\\.run$`) || Host(`local.graphql.nhost.run`))&& PathPrefix(`/v1`)",
			"traefik.http.routers.constellation.service":                                  "constellation",
			"traefik.http.routers.constellation.tls":                                      "false",
			"traefik.http.services.constellation.loadbalancer.server.port":                "8000",
		},
		Networks: networkAliases("constellation-service"),
		Ports:    nil,
		Restart:  "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   "/path/to/nhost/metadata",
				Target:   "/metadata",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}
}

func callGetServices(t *testing.T, withConstellation bool) map[string]*Service {
	t.Helper()

	tmp := t.TempDir()

	cfg := getConfig()
	cfg.Hasura.Version = new("v2.25.0")

	if withConstellation {
		cfg.Experimental = &model.ConfigExperimental{
			Constellation: &model.ConfigConstellation{
				Version:  new("0.0.1"),
				Settings: nil,
			},
		}
	}

	services, err := getServices(
		cfg,
		"dev",
		"nhost",
		1337,
		false,
		5432,
		tmp,
		tmp,
		tmp,
		ExposePorts{},
		"main",
		"nhost/dashboard:2.63.0",
		"2.1.0",
		"nhost/cli:dev",
		"00000000-0000-0000-0000-000000000000",
		false,
	)
	if err != nil {
		t.Fatalf("getServices failed: %v", err)
	}

	return services
}

func TestGraphqlIngressWithConstellation(t *testing.T) {
	t.Parallel()

	t.Run("graphql owns local.graphql when constellation disabled", func(t *testing.T) {
		t.Parallel()

		services := callGetServices(t, false)

		if _, ok := services["constellation"]; ok {
			t.Fatal("constellation service should not be present when disabled")
		}

		labels := services["graphql"].Labels
		if _, ok := labels["traefik.http.routers.graphql.rule"]; !ok {
			t.Error("expected graphql service to keep its `graphql` router when constellation is disabled")
		}

		if _, ok := labels["traefik.http.routers.hasura.rule"]; !ok {
			t.Error("expected graphql service to keep its `hasura` router")
		}
	})

	t.Run("constellation owns local.graphql when enabled", func(t *testing.T) {
		t.Parallel()

		services := callGetServices(t, true)

		c, ok := services["constellation"]
		if !ok {
			t.Fatal("constellation service should be present when enabled")
		}

		if got := c.Labels["traefik.http.routers.constellation.rule"]; got == "" {
			t.Error("expected constellation router rule to be set")
		}

		labels := services["graphql"].Labels
		if _, ok := labels["traefik.http.routers.graphql.rule"]; ok {
			t.Error("graphql service must not register its `graphql` router when constellation is enabled — constellation owns local.graphql.local.nhost.run")
		}

		if _, ok := labels["traefik.http.routers.hasura.rule"]; !ok {
			t.Error("graphql service should still own the `hasura` router")
		}
	})
}

func TestConstellation(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		cfg      func() *model.ConfigConfig
		useTLS   bool
		expected func() *Service
	}{
		{
			name:     "success",
			cfg:      getConfig,
			useTLS:   false,
			expected: expectedConstellation,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := constellation(
				tc.cfg(),
				"dev",
				tc.useTLS,
				1337,
				"/path/to/nhost",
				"nhost/constellation:0.0.1",
			)
			if err != nil {
				t.Fatalf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
