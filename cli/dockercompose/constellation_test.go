package dockercompose //nolint:testpackage

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

const constellationJWTSecret = `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}` //nolint:gosec

// Canonical traefik rule strings produced by graphql.go / constellation.go.
// These are referenced from TestGraphqlIngressWithConstellation so a regression
// in the rule construction is caught by an exact-value comparison.
const (
	canonicalHasuraRule        = "(HostRegexp(`^.+\\.hasura\\.local\\.nhost\\.run$`) || Host(`local.hasura.nhost.run`))&& ( PathPrefix(`/v1`) || PathPrefix(`/v2`) || PathPrefix(`/api/`) || PathPrefix(`/console/assets`) )"
	canonicalGraphqlRule       = "(HostRegexp(`^.+\\.graphql\\.local\\.nhost\\.run$`) || Host(`local.graphql.nhost.run`))&& PathPrefix(`/v1`)"
	canonicalConstellationRule = "(HostRegexp(`^.+\\.graphql\\.local\\.nhost\\.run$`) || Host(`local.graphql.nhost.run`))"
)

func expectedConstellation(useTLS bool) *Service {
	scheme := "http"
	if useTLS {
		scheme = "https"
	}

	tlsLabel := "false"
	if useTLS {
		tlsLabel = "true"
	}

	return &Service{
		Image: "nhost/constellation:0.1.0",
		DependsOn: map[string]DependsOn{
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint: nil,
		Command:    []string{"serve"},
		Environment: map[string]string{
			"CONSTELLATION_ADMIN_SECRET":               "adminSecret",
			"CONSTELLATION_CORS_ALLOWED_ORIGINS":       scheme + "://dev.dashboard.local.nhost.run:1337,http://localhost:3000",
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
			"NHOST_AUTH_URL":              scheme + "://dev.auth.local.nhost.run:1337/v1",
			"NHOST_FUNCTIONS_URL":         "http://functions:3000",
			"NHOST_GRAPHQL_DATABASE_URL":  "postgres://postgres:postgres@postgres:5432/local",
			"NHOST_GRAPHQL_URL":           scheme + "://dev.graphql.local.nhost.run:1337/v1",
			"NHOST_JWT_SECRET":            constellationJWTSecret,
			"NHOST_REGION":                "local",
			"NHOST_STORAGE_URL":           scheme + "://dev.storage.local.nhost.run:1337/v1",
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
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD",
				"wget",
				"--spider",
				"-S",
				"http://localhost:8000/healthz",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: map[string]string{
			"traefik.enable": "true",
			"traefik.http.routers.constellation.entrypoints":               "web",
			"traefik.http.routers.constellation.rule":                      canonicalConstellationRule,
			"traefik.http.routers.constellation.service":                   "constellation",
			"traefik.http.routers.constellation.tls":                       tlsLabel,
			"traefik.http.services.constellation.loadbalancer.server.port": "8000",
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

func callGetServices(t *testing.T, withConstellation, useTLS bool) map[string]*Service {
	t.Helper()

	tmp := t.TempDir()

	cfg := getConfig()
	cfg.Hasura.Version = new("v2.25.0")

	if withConstellation {
		cfg.Experimental = &model.ConfigExperimental{
			Constellation: &model.ConfigConstellation{
				Version:  new("0.1.0"),
				Settings: nil,
			},
		}
	}

	services, err := getServices(
		cfg,
		"dev",
		"nhost",
		1337,
		useTLS,
		5432,
		tmp,
		tmp,
		tmp,
		ExposePorts{},
		"main",
		"nhost/dashboard:2.65.1",
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

		services := callGetServices(t, false, false)

		if _, ok := services["constellation"]; ok {
			t.Fatal("constellation service should not be present when disabled")
		}

		labels := services["graphql"].Labels
		if got := labels["traefik.http.routers.graphql.rule"]; got != canonicalGraphqlRule {
			t.Errorf(
				"graphql router rule drifted from canonical:\n  got:  %q\n  want: %q",
				got,
				canonicalGraphqlRule,
			)
		}

		if got := labels["traefik.http.routers.hasura.rule"]; got != canonicalHasuraRule {
			t.Errorf(
				"hasura router rule drifted from canonical:\n  got:  %q\n  want: %q",
				got,
				canonicalHasuraRule,
			)
		}
	})

	t.Run("constellation owns local.graphql when enabled", func(t *testing.T) {
		t.Parallel()
		assertConstellationOwnsGraphql(t, false)
	})

	t.Run("constellation owns local.graphql when enabled under TLS", func(t *testing.T) {
		t.Parallel()
		assertConstellationOwnsGraphql(t, true)
	})
}

// assertConstellationOwnsGraphql exercises the constellation-enabled
// `getServices` path and re-asserts the four canonical traefik labels
// (rule, tls, loadbalancer port, no rewrite middleware) plus the
// graphql/hasura sibling invariants. Parameterised on useTLS so the TLS
// integration path is covered without duplicating the assertion block.
func assertConstellationOwnsGraphql(t *testing.T, useTLS bool) {
	t.Helper()

	services := callGetServices(t, true, useTLS)

	c, ok := services["constellation"]
	if !ok {
		t.Fatal("constellation service should be present when enabled")
	}

	wantTLS := "false"
	if useTLS {
		wantTLS = "true"
	}

	wantLabels := map[string]string{
		"traefik.http.routers.constellation.rule":                      canonicalConstellationRule,
		"traefik.http.routers.constellation.tls":                       wantTLS,
		"traefik.http.services.constellation.loadbalancer.server.port": "8000",
	}
	for k, want := range wantLabels {
		if got := c.Labels[k]; got != want {
			t.Errorf("constellation label %q drifted (useTLS=%v):\n  got:  %q\n  want: %q",
				k, useTLS, got, want)
		}
	}

	if _, ok := c.Labels["traefik.http.middlewares.replace-constellation.replacepathregex.regex"]; ok {
		t.Error("constellation router should not register a rewrite middleware")
	}

	labels := services["graphql"].Labels
	if _, ok := labels["traefik.http.routers.graphql.rule"]; ok {
		t.Error(
			"graphql service must not register its `graphql` router when constellation is enabled — constellation owns local.graphql.local.nhost.run",
		)
	}

	// The hand-rolled hasura ingress in compose.go's constellation branch
	// must stay byte-for-byte identical to the canonical one produced by
	// graphql.go; this assertion catches drift between the two paths.
	if got := labels["traefik.http.routers.hasura.rule"]; got != canonicalHasuraRule {
		t.Errorf(
			"hasura router rule drifted from canonical (useTLS=%v):\n  got:  %q\n  want: %q",
			useTLS, got, canonicalHasuraRule,
		)
	}
}

func TestConstellation(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		cfg      func() *model.ConfigConfig
		useTLS   bool
		expected func(useTLS bool) *Service
	}{
		{
			name:     "success",
			cfg:      getConfig,
			useTLS:   false,
			expected: expectedConstellation,
		},
		{
			name:     "with TLS",
			cfg:      getConfig,
			useTLS:   true,
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
				"nhost/constellation:0.1.0",
			)
			if err != nil {
				t.Fatalf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(tc.useTLS), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
