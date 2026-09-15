package dockercompose //nolint:testpackage

import (
	"net/url"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/be/services/mimir/model"
)

func engineConfig() *model.ConfigConfig {
	cfg := getConfig()
	cfg.Hasura.Version = new("v2.25.0")
	cfg.Experimental = &model.ConfigExperimental{
		Nhost: &model.ConfigNhost{
			Version: new("0.0.5"),
		},
	}

	return cfg
}

func expectedEngine() *Service {
	return &Service{
		Image: "nhost/engine:0.0.5",
		DependsOn: map[string]DependsOn{
			"graphql":  {Condition: "service_healthy"},
			"minio":    {Condition: "service_started"},
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint:  nil,
		Command:     []string{"serve"},
		Environment: nil, // asserted separately; owned by appconfig.NhostEngineEnv
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD", "wget", "--spider", "-S", "http://localhost:8080/healthz",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			{
				Name: "engine-auth",
				TLS:  false,
				Rule: traefikHostMatch("auth") + " && PathPrefix(`/v1`)",
				Port: enginePort,
				Rewrite: &Rewrite{
					Regex:       "^/(.*)",
					Replacement: "/auth/$$1",
				},
			},
			{
				Name: "engine-storage",
				TLS:  false,
				Rule: traefikHostMatch("storage") + " && PathPrefix(`/v1`)",
				Port: enginePort,
				Rewrite: &Rewrite{
					Regex:       "^/(.*)",
					Replacement: "/storage/$$1",
				},
			},
			{
				Name: "engine-graphql",
				TLS:  false,
				Rule: traefikHostMatch("graphql") + " && PathPrefix(`/v1`)",
				Port: enginePort,
				Rewrite: &Rewrite{
					Regex:       "^/(.*)",
					Replacement: "/graphql/$$1",
				},
			},
		}.Labels(),
		Networks: networkAliases(),
		Ports:    nil,
		Restart:  "always",
		User:     nil,
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   "/tmp/emails",
				Target:   "/app/email-templates",
				ReadOnly: new(false),
			},
			{
				Type:     "bind",
				Source:   "/tmp/metadata",
				Target:   "/metadata",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}
}

// TestEngine pins the container shape. The environment is asserted separately
// because appconfig.NhostEngineEnv owns it; what matters here is that the
// engine is reachable on all three public service hosts with its mount prefix
// prepended, and that it carries both bind mounts its bundled services need.
func TestEngine(t *testing.T) {
	t.Parallel()

	got, err := engine(engineConfig(), "dev", false, 444, "/tmp", "")
	if err != nil {
		t.Fatalf("engine() failed: %v", err)
	}

	if diff := cmp.Diff(
		expectedEngine(), got,
		cmpopts.IgnoreFields(Service{}, "Environment"),
	); diff != "" {
		t.Errorf("engine service mismatch (-want +got):\n%s", diff)
	}
}

func TestEngineRequiresVersion(t *testing.T) {
	t.Parallel()

	cfg := engineConfig()
	cfg.Experimental.Nhost.Version = new("")

	if _, err := engine(cfg, "dev", false, 444, "/tmp", ""); err == nil {
		t.Fatal("engine() accepted an empty version; the image tag would be nhost/engine:")
	}
}

// TestEngineDisablesAuthWhenHasuraAuthUnusable covers the engine's counterpart
// to the standalone topology simply omitting the auth container: the engine
// still runs, serving storage and graphql, with auth switched off.
func TestEngineDisablesAuthWhenHasuraAuthUnusable(t *testing.T) {
	t.Parallel()

	usable, err := engine(engineConfig(), "dev", false, 444, "/tmp", "")
	if err != nil {
		t.Fatalf("engine() failed: %v", err)
	}

	if got := usable.Environment["DISABLE_AUTH"]; got == "true" {
		t.Errorf(
			"DISABLE_AUTH = %q with a hasura-auth compatible JWT secret, want unset/false",
			got,
		)
	}

	cfg := engineConfig()
	cfg.Hasura.AuthHook = &model.ConfigHasuraAuthHook{
		Url: "https://auth.example.com/hook",
	}

	disabled, err := engine(cfg, "dev", false, 444, "/tmp", "")
	if err != nil {
		t.Fatalf("engine() failed with an auth hook: %v", err)
	}

	if got := disabled.Environment["DISABLE_AUTH"]; got != "true" {
		t.Errorf("DISABLE_AUTH = %q with an auth hook configured, want %q", got, "true")
	}
}

// TestEngineTopologyReplacesAuthAndStorage is the compose-level contract the
// e2e suite asserts against a real stack: one engine container instead of the
// auth and storage containers, with hasura still running behind it.
func TestEngineTopologyReplacesAuthAndStorage(t *testing.T) {
	t.Parallel()

	services := callGetServicesWithEngine(t)

	if _, ok := services["engine"]; !ok {
		t.Fatal("engine service missing when experimental.nhost is set")
	}

	for _, name := range []string{"auth", "storage", "constellation"} {
		if _, ok := services[name]; ok {
			t.Errorf("service %q should be replaced by the engine", name)
		}
	}

	if _, ok := services["graphql"]; !ok {
		t.Error("hasura should keep running: the engine's graphql service proxies to it")
	}

	for serviceName, service := range services {
		for dependency := range service.DependsOn {
			if _, ok := services[dependency]; !ok {
				t.Errorf("service %q depends on undefined service %q", serviceName, dependency)
			}
		}
	}

	aiService, ok := services["ai"]
	if !ok {
		t.Fatal("ai service missing from ai-enabled engine topology")
	}

	if dependency, ok := aiService.DependsOn["engine"]; !ok {
		t.Error("ai should wait for the engine's bundled auth and storage services")
	} else if dependency.Condition != "service_healthy" {
		t.Errorf("ai engine dependency condition = %q, want service_healthy", dependency.Condition)
	}

	if got, want := aiService.Environment["NHOST_STORAGE_URL"],
		"http://engine:8080/storage/v1"; got != want {
		t.Errorf("ai NHOST_STORAGE_URL = %q, want %q", got, want)
	}

	// The engine owns the public graphql host, so hasura keeps only its console
	// routes, exactly as when standalone constellation is enabled.
	labels := services["graphql"].Labels
	if _, ok := labels["traefik.http.routers.graphql.rule"]; ok {
		t.Error("hasura still owns the public graphql router while the engine is enabled")
	}

	if _, ok := labels["traefik.http.routers.hasura.rule"]; !ok {
		t.Error("hasura lost its console router")
	}
}

func TestEngineRejectsStandalonePorts(t *testing.T) {
	t.Parallel()

	const wantErr = "the --auth-port/--storage-port flags cannot be used when experimental.nhost is enabled: " +
		"the bundled engine serves auth and storage behind one listener"

	tests := []struct {
		name  string
		ports ExposePorts
	}{
		{
			name:  "auth port",
			ports: ExposePorts{Auth: 4001},
		},
		{
			name:  "storage port",
			ports: ExposePorts{Storage: 5001},
		},
		{
			name:  "auth and storage ports",
			ports: ExposePorts{Auth: 4001, Storage: 5001},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := getServicesWithEngine(t, test.ports)
			if err == nil {
				t.Fatal("getServices accepted standalone service ports in engine mode")
			}

			if got := err.Error(); got != wantErr {
				t.Errorf("getServices error = %q, want %q", got, wantErr)
			}
		})
	}
}

// TestEngineEnvMatchesStandaloneServices guards against the engine and the
// standalone services drifting apart in local dev: every standalone variable
// must either be explicitly consolidated by the engine or emitted with the same
// value, except the connection and listener values the engine deliberately owns.
//
// Both sides are rendered from one config with a single auth replica, because
// that is the only shape the engine can be given: mimir rejects auth replica
// overrides once the engine is enabled, and the engine's rate limits are
// divided by its own replica count rather than auth's.
func TestEngineEnvMatchesStandaloneServices(t *testing.T) {
	t.Parallel()

	cfg := engineConfig()
	cfg.Auth.Resources.Replicas = new(uint8(1))

	eng, err := engine(cfg, "dev", false, 444, "/tmp", "")
	if err != nil {
		t.Fatalf("engine() failed: %v", err)
	}

	standaloneAuth, err := auth(cfg, "dev", 444, false, "/tmp", 0)
	if err != nil {
		t.Fatalf("auth() failed: %v", err)
	}

	standaloneStorage, err := storage(cfg, "dev", false, 444, 0)
	if err != nil {
		t.Fatalf("storage() failed: %v", err)
	}

	for _, tc := range []struct {
		name string
		env  map[string]string
	}{
		{name: "auth", env: standaloneAuth.Environment},
		{name: "storage", env: standaloneStorage.Environment},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			shared := 0

			for key, want := range tc.env {
				got, ok := eng.Environment[key]
				if !ok {
					if isStandaloneEnvConsolidatedByEngine(key) {
						continue
					}

					t.Errorf(
						"%s: standalone variable %s is missing from the engine environment",
						tc.name,
						key,
					)

					continue
				}

				if isEngineOwned(key) {
					continue
				}

				shared++

				if got != want {
					t.Errorf(
						"%s: engine and standalone disagree on %s:\n  engine:     %q\n  standalone: %q",
						tc.name,
						key,
						got,
						want,
					)
				}
			}

			if shared == 0 {
				t.Errorf(
					"%s: no shared variables compared; the parity check is not testing anything",
					tc.name,
				)
			}
		})
	}
}

// isEngineOwned reports whether a variable's value is expected to differ
// between the engine and a standalone service: the runtime database connection
// the engine consolidates and re-scopes, and the one HTTP listener it serves all
// three bundled services on.
func isEngineOwned(key string) bool {
	return key == "DATABASE_URL" || key == "BIND"
}

// isStandaloneEnvConsolidatedByEngine reports whether the engine intentionally
// replaces a standalone variable with a shared engine global.
func isStandaloneEnvConsolidatedByEngine(key string) bool {
	switch key {
	case "AUTH_HOST", "AUTH_PORT":
		// The engine replaces auth's listener variables with its shared BIND.
		return true
	case "HASURA_GRAPHQL_ADMIN_SECRET", "HASURA_GRAPHQL_JWT_SECRET":
		// The engine exposes these as ADMIN_SECRET and JWT_SECRET.
		return true
	default:
		return false
	}
}

func callGetServicesWithEngine(t *testing.T) map[string]*Service {
	t.Helper()

	services, err := getServicesWithEngine(t, ExposePorts{})
	if err != nil {
		t.Fatalf("getServices failed: %v", err)
	}

	return services
}

func getServicesWithEngine(t *testing.T, ports ExposePorts) (map[string]*Service, error) {
	t.Helper()

	tmp := t.TempDir()

	dockerURL, err := url.Parse(defaultDockerEndpoint)
	if err != nil {
		t.Fatalf("parse default Docker endpoint: %v", err)
	}

	return getServices(
		engineConfig(),
		dockerURL,
		"dev",
		"nhost",
		1337,
		false,
		5432,
		tmp,
		tmp,
		tmp,
		ports,
		"main",
		"nhost/dashboard:3.5.3",
		"2.1.0",
		"nhost/cli:dev",
		"00000000-0000-0000-0000-000000000000",
		false,
		"",
	)
}
