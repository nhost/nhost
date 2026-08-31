package dockercompose //nolint:testpackage

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

// engineTestConfig returns getConfig() opted into the bundled engine via
// experimental.nhost. The engine sources auth and storage from the root config
// (getConfig already populates them), reproducing the environment the standalone
// services would. graphql uses empty settings, exercising the constellation
// defaults.
func engineTestConfig() *model.ConfigConfig {
	cfg := getConfig()

	cfg.Experimental = &model.ConfigExperimental{
		Constellation: nil,
		Nhost: &model.ConfigNhost{
			Version:   new("0.0.1"),
			Resources: nil,
			Graphql:   &model.ConfigConstellationConfig{},
		},
	}

	return cfg
}

// runGetServices runs getServices with the standard local dev arguments and the
// given host OS, returning the raw result so callers can assert on errors.
func runGetServices(
	t *testing.T,
	cfg *model.ConfigConfig,
	hostOS string,
) (map[string]*Service, error) {
	t.Helper()

	tmp := t.TempDir()

	return getServices(
		cfg, "dev", "nhost", 1337, false, 5432, tmp, tmp, tmp,
		ExposePorts{}, "main", "nhost/dashboard:3.0.0", "2.1.0",
		"nhost/cli:dev", "00000000-0000-0000-0000-000000000000", false, hostOS,
	)
}

// engineModeConfig returns a config that opts into the bundled engine, configured
// from the fully-defaulted root [auth]/[storage] sections. It deliberately leaves
// experimental.nhost.graphql unset to prove the constellation GraphQL engine runs
// by default with the engine, without an explicit opt-in.
func engineModeConfig() *model.ConfigConfig {
	cfg := engineTestConfig()
	cfg.Hasura.Version = new("v2.25.0")
	cfg.Experimental.Nhost.Graphql = nil

	return cfg
}

// TestGetServicesEngineMode locks in that experimental.nhost runs a single
// bundled engine container (no standalone auth/storage/constellation) and that
// its constellation router owns local.graphql, displacing the hasura-cli
// graphql router.
func TestGetServicesEngineMode(t *testing.T) {
	t.Parallel()

	services, err := runGetServices(t, engineModeConfig(), "darwin")
	if err != nil {
		t.Fatalf("getServices failed: %v", err)
	}

	if _, ok := services["engine"]; !ok {
		t.Error("engine service should be present when experimental.nhost is set")
	}

	for _, name := range []string{"auth", "storage", "constellation"} {
		if _, ok := services[name]; ok {
			t.Errorf("standalone %q service must not run in engine mode", name)
		}
	}

	labels := services["engine"].Labels
	if got := labels["traefik.http.routers.constellation.rule"]; got != canonicalConstellationRule {
		t.Errorf("engine constellation router rule = %q; want %q", got, canonicalConstellationRule)
	}

	if got := labels["traefik.http.middlewares.addprefix-constellation.addprefix.prefix"]; got != "/graphql" {
		t.Errorf("engine constellation addprefix = %q; want /graphql", got)
	}

	if _, ok := services["graphql"].Labels["traefik.http.routers.graphql.rule"]; ok {
		t.Error("graphql service must not own local.graphql when constellation runs in the engine")
	}
}

// TestGetServicesEngineConstellationMutuallyExclusive locks in that configuring
// both experimental.nhost and experimental.constellation is rejected.
func TestGetServicesEngineConstellationMutuallyExclusive(t *testing.T) {
	t.Parallel()

	cfg := engineModeConfig()
	cfg.Experimental.Constellation = &model.ConfigConstellation{
		Version:  new("0.1.0"),
		Settings: nil,
	}

	if _, err := runGetServices(
		t,
		cfg,
		"darwin",
	); !errors.Is(
		err,
		errNhostConstellationExclusive,
	) {
		t.Errorf("getServices error = %v; want errNhostConstellationExclusive", err)
	}
}

// TestGetServicesEngineExposePortsExclusive locks in that exposing both auth and
// storage on distinct host ports is rejected in engine mode, where the single
// engine container can publish only one host port.
func TestGetServicesEngineExposePortsExclusive(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()

	_, err := getServices(
		engineModeConfig(), "dev", "nhost", 1337, false, 5432, tmp, tmp, tmp,
		ExposePorts{Auth: 1234, Storage: 5678}, "main", "nhost/dashboard:3.0.0", "2.1.0",
		"nhost/cli:dev", "00000000-0000-0000-0000-000000000000", false, "darwin",
	)
	if !errors.Is(err, errEngineExposePortsExclusive) {
		t.Errorf("getServices error = %v; want errEngineExposePortsExclusive", err)
	}
}

// assertEngineEnv checks the engine container environment at the invariant
// level. Exhaustive per-service env correctness is covered by
// appconfig.NhostEngineEnv's own tests; here we verify the engine-specific
// wiring: the consolidated globals, that the per-service shared keys they
// replace are gone, the local metadata-path pin, and that user env survives.
func assertEngineEnv(
	t *testing.T,
	env map[string]string,
	withAuth, withStorage, withGraphql bool,
) {
	t.Helper()

	if got := env["BIND"]; got != ":8080" {
		t.Errorf("engine env[BIND] = %q; want :8080", got)
	}

	if withAuth {
		assertEngineAuthEnabledEnv(t, env)
	} else {
		assertEngineAuthDisabledEnv(t, env)
	}

	if withStorage {
		if got := env["S3_BUCKET"]; got != "nhost" {
			t.Errorf("engine env[S3_BUCKET] = %q; want nhost", got)
		}
	}

	if withGraphql {
		if got := env["CONSTELLATION_METADATA_PATH"]; got != engineMetadataPath {
			t.Errorf("engine env[CONSTELLATION_METADATA_PATH] = %q; want /metadata/metadata.yaml", got)
		}

		if got := env["NHOST_SUBDOMAIN"]; got != "dev" {
			t.Errorf("engine env[NHOST_SUBDOMAIN] = %q; want dev", got)
		}
	}
}

// assertEngineAuthEnabledEnv asserts the consolidated globals are present with
// the right values and the per-service shared keys folded into them are dropped.
func assertEngineAuthEnabledEnv(t *testing.T, env map[string]string) {
	t.Helper()

	wantGlobals := map[string]string{
		"ADMIN_SECRET":                      "adminSecret",
		"DATABASE_URL":                      engineDatabaseURL,
		"MIGRATIONS_DATABASE_URL":           engineMigrationsDatabaseURL,
		"CONSTELLATION_HASURA_UPSTREAM_URL": "http://hasura-service:8080/",
		"JWT_SECRET":                        constellationJWTSecret,
		"AUTH_SERVER_URL":                   "https://dev.auth.local.nhost.run:1336/v1",
		"ENV1":                              "VALUE1",
		"ENV2":                              "VALUE2",
	}
	for k, want := range wantGlobals {
		if got := env[k]; got != want {
			t.Errorf("engine env[%q] = %q; want %q", k, got, want)
		}
	}

	// CORS/DEBUG globals are hoisted from the constellation graphql settings;
	// their derivation is appconfig's concern, so just assert they are present.
	for _, k := range []string{"CORS_ALLOWED_ORIGINS", "DEBUG"} {
		if _, ok := env[k]; !ok {
			t.Errorf("engine env missing global %q", k)
		}
	}

	// The per-service shared keys consolidated into globals (or owned by the
	// engine listener) must not leak through. HASURA_GRAPHQL_DATABASE_URL is
	// deliberately NOT here: remapBundledEnv drops auth's copy but keeps
	// constellation's, so it legitimately survives.
	for _, k := range []string{
		"AUTH_HOST", "AUTH_PORT",
		"HASURA_GRAPHQL_ADMIN_SECRET", "HASURA_GRAPHQL_JWT_SECRET",
		"POSTGRES_MIGRATIONS_CONNECTION",
		"POSTGRES_MIGRATIONS_SOURCE", "NHOST_JWT_SECRET",
		"CONSTELLATION_ADMIN_SECRET", "CONSTELLATION_JWT_SECRET",
		"CONSTELLATION_METADATA_DATABASE_URL",
	} {
		if _, ok := env[k]; ok {
			t.Errorf("engine env should not contain consolidated key %q", k)
		}
	}
}

// assertEngineAuthDisabledEnv asserts the DisableAuth path: the engine still
// bundles storage + constellation, JWT_SECRET remains (constellation validates
// tokens with it), and hasura-auth's own env is dropped.
func assertEngineAuthDisabledEnv(t *testing.T, env map[string]string) {
	t.Helper()

	if got := env["JWT_SECRET"]; got != constellationJWTSecret {
		t.Errorf("engine env[JWT_SECRET] = %q; want %q (constellation needs it with auth off)", got, constellationJWTSecret)
	}

	for _, k := range []string{"AUTH_SERVER_URL", "AUTH_HOST", "AUTH_CLIENT_URL"} {
		if _, ok := env[k]; ok {
			t.Errorf("engine env should not contain auth key %q when auth is disabled", k)
		}
	}

	for k, want := range map[string]string{
		"ADMIN_SECRET":            "adminSecret",
		"DATABASE_URL":            engineDatabaseURL,
		"MIGRATIONS_DATABASE_URL": engineMigrationsDatabaseURL,
	} {
		if got := env[k]; got != want {
			t.Errorf("engine env[%q] = %q; want %q", k, got, want)
		}
	}
}

func engineLabels(withAuth, withStorage, withGraphql bool) map[string]string {
	labels := map[string]string{
		"traefik.enable": "true",
	}

	if withStorage {
		labels["traefik.http.routers.storage.entrypoints"] = "web"
		labels["traefik.http.routers.storage.rule"] = "(HostRegexp(`^.+\\.storage\\.local\\.nhost\\.run$`) || Host(`local.storage.nhost.run`))&& PathPrefix(`/v1`)"
		labels["traefik.http.routers.storage.service"] = "storage"
		labels["traefik.http.routers.storage.tls"] = "true"
		labels["traefik.http.services.storage.loadbalancer.server.port"] = "8080"
		labels["traefik.http.middlewares.addprefix-storage.addprefix.prefix"] = "/storage"
		labels["traefik.http.routers.storage.middlewares"] = "addprefix-storage"
	}

	if withAuth {
		labels["traefik.http.routers.auth.entrypoints"] = "web"
		labels["traefik.http.routers.auth.rule"] = "(HostRegexp(`^.+\\.auth\\.local\\.nhost\\.run$`) || Host(`local.auth.nhost.run`))"
		labels["traefik.http.routers.auth.service"] = "auth"
		labels["traefik.http.routers.auth.tls"] = "true"
		labels["traefik.http.services.auth.loadbalancer.server.port"] = "8080"
		labels["traefik.http.middlewares.addprefix-auth.addprefix.prefix"] = "/auth"
		labels["traefik.http.routers.auth.middlewares"] = "addprefix-auth"
	}

	if withGraphql {
		labels["traefik.http.routers.constellation.entrypoints"] = "web"
		labels["traefik.http.routers.constellation.rule"] = canonicalConstellationRule
		labels["traefik.http.routers.constellation.service"] = "constellation"
		labels["traefik.http.routers.constellation.tls"] = "true"
		labels["traefik.http.services.constellation.loadbalancer.server.port"] = "8080"
		labels["traefik.http.middlewares.addprefix-constellation.addprefix.prefix"] = "/graphql"
		labels["traefik.http.routers.constellation.middlewares"] = "addprefix-constellation"
	}

	return labels
}

// expectedEngine is the structural expectation for the engine container. Its
// Environment is left nil: env is asserted separately via assertEngineEnv, and
// the test clears got.Environment before the structural diff.
func expectedEngine() *Service {
	return &Service{
		Image:   "nhost/engine:0.0.1",
		Command: []string{"serve", "--disable-graphql"},
		DependsOn: map[string]DependsOn{
			"graphql":  {Condition: "service_healthy"},
			"minio":    {Condition: "service_started"},
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint:  nil,
		Environment: nil,
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test:        []string{"CMD", "wget", "--spider", "-S", "http://localhost:8080/healthz"},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels:   engineLabels(true, true, false),
		Networks: networkAliases("hasura-auth-service", "hasura-storage-service"),
		Ports:    nil,
		Restart:  "always",
		User:     nil,
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   "/tmp/nhost/emails",
				Target:   "/app/email-templates",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}
}

func TestEngine(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		cfg           func() *model.ConfigConfig
		hostOS        string
		authExpose    uint
		storageExpose uint
		withAuth      bool
		withStorage   bool
		withGraphql   bool
		expected      func() *Service
	}{
		{
			name:          "auth and storage",
			cfg:           engineTestConfig,
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   true,
			withGraphql:   false,
			expected:      expectedEngine,
		},
		{
			name:          "storage only",
			cfg:           engineTestConfig,
			authExpose:    0,
			storageExpose: 0,
			withAuth:      false,
			withStorage:   true,
			withGraphql:   false,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Command = []string{"serve", "--disable-auth", "--disable-graphql"}
				svc.Labels = engineLabels(false, true, false)
				svc.Volumes = nil

				return svc
			},
		},
		{
			name:          "auth and constellation without storage",
			cfg:           engineTestConfig,
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   false,
			withGraphql:   true,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Command = []string{"serve", "--disable-storage"}
				svc.Labels = engineLabels(true, false, true)

				svc.DependsOn = map[string]DependsOn{
					"graphql":  {Condition: "service_healthy"},
					"postgres": {Condition: "service_healthy"},
				}
				svc.Networks = networkAliases(
					"hasura-auth-service", "hasura-storage-service", "constellation-service",
				)
				svc.Volumes = append(svc.Volumes, Volume{
					Type:     "bind",
					Source:   "/tmp/nhost/metadata",
					Target:   "/metadata",
					ReadOnly: new(false),
				})

				return svc
			},
		},
		{
			// Runs on linux to cover the host-user branch: with constellation the
			// engine writes the bind-mounted /metadata folder, so on linux it must
			// run as the host user. The other cases use darwin (User nil).
			name:          "auth, storage and constellation on linux",
			cfg:           engineTestConfig,
			hostOS:        "linux",
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   true,
			withGraphql:   true,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Command = []string{"serve"}
				svc.Labels = engineLabels(true, true, true)
				svc.Networks = networkAliases(
					"hasura-auth-service", "hasura-storage-service", "constellation-service",
				)
				svc.Volumes = append(svc.Volumes, Volume{
					Type:     "bind",
					Source:   "/tmp/nhost/metadata",
					Target:   "/metadata",
					ReadOnly: new(false),
				})
				svc.User = hostUserSpec("linux")

				return svc
			},
		},
		{
			name: "pinned engine version",
			cfg: func() *model.ConfigConfig {
				cfg := engineTestConfig()
				cfg.Experimental.Nhost.Version = new("1.2.3")

				return cfg
			},
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   true,
			withGraphql:   false,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Image = "nhost/engine:1.2.3"

				return svc
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			hostOS := tc.hostOS
			if hostOS == "" {
				hostOS = "darwin"
			}

			got, err := engine(
				tc.cfg(), "dev", true, 1336, "/tmp/nhost",
				tc.authExpose, tc.storageExpose,
				tc.withAuth, tc.withStorage, tc.withGraphql, hostOS,
			)
			if err != nil {
				t.Errorf("got error: %v", err)
			}

			// Env is asserted at the invariant level; appconfig.NhostEngineEnv's own
			// tests cover exhaustive per-service correctness. Clear it before the
			// structural diff so the two concerns stay independent.
			assertEngineEnv(t, got.Environment, tc.withAuth, tc.withStorage, tc.withGraphql)
			got.Environment = nil

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
