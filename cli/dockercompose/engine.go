package dockercompose

import (
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

// enginePort is the single port the nhost-engine container listens on. Every
// bundled service is served behind it under a path prefix (/auth, /storage,
// /graphql), with a root /healthz for liveness.
const enginePort = 8080

// defaultEngineVersion is the nhost-engine image tag used when
// experimental.engine.version is unset. It is the CLI's known-good default and
// is bumped alongside CLI releases; it mirrors the schema default.
const defaultEngineVersion = "0.0.1"

// engineVersion returns the nhost-engine image tag to run: the configured
// experimental.engine.version when set, otherwise the CLI default.
func engineVersion(cfg *model.ConfigConfig) string {
	if v := cfg.GetExperimental().GetEngine().GetVersion(); v != nil {
		return *v
	}

	return defaultEngineVersion
}

// engine builds the single nhost-engine container. It is used only when
// experimental.engine is set, and bundles the services selected by
// experimental.engine.settings: auth (also gated on hasura-auth JWT
// compatibility), storage, and graphql (constellation, which serves the GraphQL
// API on the graphql subdomain).
//
// Each bundled service reads its own native environment variables (the engine
// runs each service's own CLI internally), so the container environment is the
// union of the per-service env produced by appconfig, with BIND pointed at the
// shared engine listener.
func engine( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	nhostFolder string,
	authExpose uint,
	storageExpose uint,
	withAuth bool,
	withStorage bool,
	withGraphql bool,
	hostOS string,
) (*Service, error) {
	// The bundled services are configured from experimental.engine.settings, not
	// the project's root [auth]/[storage]/[constellation] sections, so build the
	// env from a config view derived from those settings.
	svcCfg, err := engineServiceConfig(cfg)
	if err != nil {
		return nil, err
	}

	env := make(map[string]string)

	if withStorage {
		if err := addStorageEnv(
			env,
			svcCfg,
			subdomain,
			useTLS,
			httpPort,
			storageExpose,
		); err != nil {
			return nil, err
		}
	}

	// Constellation is merged before auth: both set HASURA_GRAPHQL_DATABASE_URL
	// (constellation to the postgres superuser, auth to nhost_hasura). Only
	// auth reads it (via --postgres); constellation reads only
	// CONSTELLATION_METADATA_DATABASE_URL, so letting auth's value win is
	// correct.
	if withGraphql {
		if err := addConstellationEnv(env, svcCfg, subdomain, useTLS, httpPort); err != nil {
			return nil, err
		}
	}

	if withAuth {
		if err := addAuthEnv(env, svcCfg, subdomain, useTLS, httpPort, authExpose); err != nil {
			return nil, err
		}
	}

	// The engine owns the single listener; every bundled service is served as
	// a handler behind it, so its own BIND is irrelevant except that storage
	// reads BIND too — point them all at the shared engine port.
	env["BIND"] = fmt.Sprintf(":%d", enginePort)

	command := []string{"serve"}
	if !withAuth {
		command = append(command, "--disable-auth")
	}

	if !withStorage {
		command = append(command, "--disable-storage")
	}

	if !withGraphql {
		command = append(command, "--disable-graphql")
	}

	exposePort := authExpose
	if exposePort == 0 {
		exposePort = storageExpose
	}

	var user *string
	if withGraphql {
		// Constellation writes into the bind-mounted metadata folder, so on
		// Linux the engine runs as the host user (matching the standalone).
		user = hostUserSpec(hostOS)
	}

	return &Service{
		Image:       "nhost/nhost-engine:" + engineVersion(cfg),
		Command:     command,
		DependsOn:   engineDependsOn(withAuth, withStorage),
		EntryPoint:  nil,
		Environment: env,
		ExtraHosts:  extraHosts,
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD", "wget", "--spider", "-S",
				fmt.Sprintf("http://localhost:%d/healthz", enginePort),
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels:     engineIngresses(useTLS, withAuth, withStorage, withGraphql).Labels(),
		Networks:   networkAliases(engineNetworkAliases(withGraphql)...),
		Ports:      ports(exposePort, enginePort),
		Restart:    "always",
		User:       user,
		Volumes:    engineVolumes(nhostFolder, withAuth, withGraphql),
		WorkingDir: nil,
	}, nil
}

// engineServiceConfig returns a shallow copy of cfg whose Auth, Storage and
// Experimental.Constellation sections are rebuilt from
// experimental.engine.settings, so the shared appconfig env builders — which
// read the top-level service configs — emit the engine's bundled-service
// environment rather than the project's root [auth]/[storage]/[constellation]
// values.
//
// The engine settings types (ConfigAuthSettings, ConfigStorageSettings,
// ConfigConstellationConfig) deliberately share JSON field names with the
// standalone service configs minus version/resources, so a JSON round-trip
// copies them field-for-field. version/resources are carried over from the root
// config (nil when unset); the env builders ignore them, but the schema types
// still declare the fields.
func engineServiceConfig(cfg *model.ConfigConfig) (*model.ConfigConfig, error) {
	settings := cfg.GetExperimental().GetEngine().GetSettings()

	out := *cfg

	auth := &model.ConfigAuth{ //nolint:exhaustruct // overlaid from settings below
		Version:   cfg.GetAuth().GetVersion(),
		Resources: cfg.GetAuth().GetResources(),
	}
	if err := overlayEngineSettings(settings.GetAuth(), auth); err != nil {
		return nil, fmt.Errorf("failed to build engine auth config: %w", err)
	}

	out.Auth = auth

	storage := &model.ConfigStorage{ //nolint:exhaustruct // overlaid from settings below
		Version:   cfg.GetStorage().GetVersion(),
		Resources: cfg.GetStorage().GetResources(),
	}
	if err := overlayEngineSettings(settings.GetStorage(), storage); err != nil {
		return nil, fmt.Errorf("failed to build engine storage config: %w", err)
	}

	out.Storage = storage

	constellation := &model.ConfigConstellation{} //nolint:exhaustruct // overlaid below
	if err := overlayEngineSettings(settings.GetGraphql(), constellation); err != nil {
		return nil, fmt.Errorf("failed to build engine graphql config: %w", err)
	}

	// Copy Experimental so replacing Constellation does not mutate the caller's
	// config; Engine (and its version) is preserved for engineVersion.
	exp := *cfg.GetExperimental()
	exp.Constellation = constellation
	out.Experimental = &exp

	return &out, nil
}

// overlayEngineSettings copies settings onto target through a JSON round-trip,
// preserving any fields already set on target that settings does not carry (a
// nil settings pointer marshals to "null" and leaves target untouched).
func overlayEngineSettings(settings, target any) error {
	b, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("failed to marshal engine settings: %w", err)
	}

	if err := json.Unmarshal(b, target); err != nil {
		return fmt.Errorf("failed to apply engine settings: %w", err)
	}

	return nil
}

func engineDependsOn(withAuth, withStorage bool) map[string]DependsOn {
	deps := map[string]DependsOn{
		"postgres": {Condition: "service_healthy"},
	}

	// auth and storage both talk to Hasura on startup (migrations / metadata).
	if withAuth || withStorage {
		deps["graphql"] = DependsOn{Condition: "service_healthy"}
	}

	if withStorage {
		deps["minio"] = DependsOn{Condition: "service_started"}
	}

	return deps
}

func engineNetworkAliases(withGraphql bool) []string {
	aliases := []string{"hasura-auth-service", "hasura-storage-service"}
	if withGraphql {
		aliases = append(aliases, "constellation-service")
	}

	return aliases
}

func engineVolumes(nhostFolder string, withAuth, withGraphql bool) []Volume {
	var volumes []Volume

	if withAuth {
		volumes = append(volumes, Volume{
			Type:     "bind",
			Source:   nhostFolder + "/emails",
			Target:   "/app/email-templates",
			ReadOnly: new(false),
		})
	}

	if withGraphql {
		volumes = append(volumes, Volume{
			Type:     "bind",
			Source:   nhostFolder + "/metadata",
			Target:   "/metadata",
			ReadOnly: new(false),
		})
	}

	return volumes
}

// addStorageEnv merges hasura-storage's native environment into env.
func addStorageEnv(
	env map[string]string,
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	storageExpose uint,
) error {
	storageHTTPPort := httpPort
	if storageExpose != 0 {
		storageHTTPPort = storageExpose
	}

	storageEnvars, err := appconfig.HasuraStorageEnv(
		cfg,
		"http://graphql:8080/v1",
		"postgres://nhost_storage_admin@postgres:5432/local?sslmode=disable",
		URL(subdomain, "storage", storageHTTPPort, useTLS && storageExpose == 0),
		"http://minio:9000",
		"",
		"nhost",
		"",
		"minioaccesskey123123",
		"minioaccesskey123123",
		deptr(cfg.Storage.GetAntivirus().GetServer()),
	)
	if err != nil {
		return fmt.Errorf("failed to get storage env vars: %w", err)
	}

	for _, v := range storageEnvars {
		env[v.Name] = v.Value
	}

	return nil
}

// addAuthEnv merges hasura-auth's native environment into env. The overlap with
// storage's environment is limited to HASURA_GRAPHQL_ADMIN_SECRET, which holds
// the same value, so a plain merge is safe.
func addAuthEnv(
	env map[string]string,
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	authExpose uint,
) error {
	authHTTPPort := httpPort
	if authExpose != 0 {
		authHTTPPort = authExpose
	}

	authEnvars, err := appconfig.HasuraAuthEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		URL(subdomain, "auth", authHTTPPort, useTLS && authExpose == 0)+"/v1",
		"postgres://nhost_hasura@postgres:5432/local",
		"postgres://nhost_auth_admin@postgres:5432/local",
		&model.ConfigSmtp{
			User:     new("user"),
			Password: new("password"),
			Sender:   new("auth@example.com"),
			Host:     new("mailhog"),
			Port:     new(uint16(1025)), //nolint:mnd
			Secure:   new(false),
			Method:   new("LOGIN"),
		},
		false,
		false,
		"00000000-0000-0000-0000-000000000000",
		"5181f67e2844e4b60d571fa346cac9c37fc00d1ff519212eae6cead138e639ba",
	)
	if err != nil {
		return fmt.Errorf("failed to get hasura-auth env vars: %w", err)
	}

	for _, v := range authEnvars {
		env[v.Name] = v.Value
	}

	return nil
}

// addConstellationEnv merges constellation's native environment into env and
// pins its metadata path to the bind-mounted /metadata folder (the flag
// defaults to a workdir-relative path, which is unreliable inside the engine
// image).
func addConstellationEnv(
	env map[string]string,
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
) error {
	constellationEnvars, err := appconfig.ConstellationEnv(
		cfg,
		appconfig.ConstellationEnvInput{
			PostgresConnection: "postgres://postgres:postgres@postgres:5432/local",
			NhostAuthURL:       URL(subdomain, "auth", httpPort, useTLS) + "/v1",
			NhostGraphqlURL:    URL(subdomain, "graphql", httpPort, useTLS) + "/v1",
			NhostStorageURL:    URL(subdomain, "storage", httpPort, useTLS) + "/v1",
			NhostFunctionsURL:  "http://functions:3000",
			Subdomain:          subdomain,
			Region:             "local",
			DashboardOrigin:    URL(subdomain, "dashboard", httpPort, useTLS),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to get constellation env vars: %w", err)
	}

	for _, v := range constellationEnvars {
		env[v.Name] = v.Value
	}

	env["CONSTELLATION_METADATA_PATH"] = "/metadata/metadata.yaml"

	return nil
}

// engineIngresses returns the traefik routers for the engine container. The
// engine host (<sub>.engine.local.nhost.run) reaches the engine root directly;
// the storage, auth and graphql (constellation) hosts keep their existing
// public URLs and are rewritten onto the engine's /storage, /auth and /graphql
// path prefixes. Each per-service router is present only when its service runs.
func engineIngresses(useTLS, withAuth, withStorage, withGraphql bool) Ingresses {
	ingresses := Ingresses{
		{
			Name:      "engine",
			TLS:       useTLS,
			Rule:      traefikHostMatch("engine"),
			Port:      enginePort,
			Rewrite:   nil,
			AddPrefix: "",
		},
	}

	if withStorage {
		ingresses = append(ingresses, Ingress{
			Name:      "storage",
			TLS:       useTLS,
			Rule:      traefikHostMatch("storage") + "&& PathPrefix(`/v1`)",
			Port:      enginePort,
			Rewrite:   nil,
			AddPrefix: "/storage",
		})
	}

	if withAuth {
		ingresses = append(ingresses, Ingress{
			Name:      "auth",
			TLS:       useTLS,
			Rule:      traefikHostMatch("auth"),
			Port:      enginePort,
			Rewrite:   nil,
			AddPrefix: "/auth",
		})
	}

	if withGraphql {
		ingresses = append(ingresses, Ingress{
			Name:      "constellation",
			TLS:       useTLS,
			Rule:      traefikHostMatch("graphql"),
			Port:      enginePort,
			Rewrite:   nil,
			AddPrefix: "/graphql",
		})
	}

	return ingresses
}
