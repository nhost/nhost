package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

// enginePort is the single port the engine container listens on. Every
// bundled service is served behind it under a path prefix (/auth, /storage,
// /graphql), with a root /healthz for liveness.
const enginePort = 8080

// defaultEngineVersion is the engine image tag used when
// experimental.nhost.version is unset. It is the CLI's known-good default and
// is bumped alongside CLI releases; it mirrors the schema default.
const defaultEngineVersion = "0.0.1"

// Local dev connection strings and fixtures shared by the engine env builders.
// The engine consolidates auth/storage/constellation onto a single runtime and
// migrations connection (appconfig.NhostEngineEnv drops the per-service DB URLs
// in favour of these globals), so both point at the local Postgres superuser,
// which can serve every bundled service's runtime and run all their migrations.
// sslmode=disable is required because the local Postgres has no TLS and
// hasura-storage's lib/pq migration driver defaults to sslmode=require.
const (
	engineDatabaseURL           = "postgres://postgres:postgres@postgres:5432/local?sslmode=disable"
	engineMigrationsDatabaseURL = "postgres://postgres:postgres@postgres:5432/local?sslmode=disable"
	engineLocalAppID            = "00000000-0000-0000-0000-000000000000"
	engineLocalEncryptionKey    = "5181f67e2844e4b60d571fa346cac9c37fc00d1ff519212eae6cead138e639ba"
	engineLocalMinioAccessKey   = "minioaccesskey123123"

	// engineMetadataPath is where constellation reads its metadata inside the
	// engine image; it matches the bind-mounted /metadata volume.
	engineMetadataPath = "/metadata/metadata.yaml"
)

// engineVersion returns the engine image tag to run: the configured
// experimental.nhost.version when set, otherwise the CLI default.
func engineVersion(cfg *model.ConfigConfig) string {
	if v := cfg.GetExperimental().GetNhost().GetVersion(); v != nil {
		return *v
	}

	return defaultEngineVersion
}

// engine builds the single engine container. It is used only when
// experimental.nhost is set, and bundles graphql (constellation, which serves
// the GraphQL API on the graphql subdomain) and storage always, plus auth when
// hasura-auth is JWT-compatible. auth and storage are configured from the
// project's root [auth]/[storage] sections; the GraphQL engine from
// experimental.nhost.graphql.
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
	env, err := engineEnv(
		cfg, subdomain, useTLS, httpPort, authExpose, storageExpose, withAuth,
	)
	if err != nil {
		return nil, err
	}

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
		Image:       "nhost/engine:" + engineVersion(cfg),
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

// engineEnv builds the engine environment via appconfig.NhostEngineEnv, the same
// single builder the cloud (factorio) uses, so local and cloud stay in lockstep
// and env-var overlap is resolved in one place. When the project's JWT secret is
// not hasura-auth compatible the caller passes withAuth=false; NhostEngineEnv
// then omits hasura-auth's env (DisableAuth) while still emitting storage,
// constellation and the JWT_SECRET global constellation validates tokens with.
//
// Every Hasura URL it emits (auth graphql, storage endpoint, constellation
// upstream) targets http://hasura-service:8080, which resolves locally because
// the Hasura container carries the "hasura-service" network alias.
func engineEnv(
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort, authExpose, storageExpose uint,
	withAuth bool,
) (map[string]string, error) {
	authHTTPPort := httpPort
	if authExpose != 0 {
		authHTTPPort = authExpose
	}

	storageHTTPPort := httpPort
	if storageExpose != 0 {
		storageHTTPPort = storageExpose
	}

	envars, err := appconfig.NhostEngineEnv(
		cfg,
		appconfig.NhostEngineEnvInput{
			ListenAddress:         fmt.Sprintf(":%d", enginePort),
			DisableAuth:           !withAuth,
			DatabaseURL:           engineDatabaseURL,
			MigrationsDatabaseURL: engineMigrationsDatabaseURL,
			AuthServerURL:         URL(subdomain, "auth", authHTTPPort, useTLS && authExpose == 0) + "/v1",
			SMTPSettings:          engineLocalSMTP(),
			IsCustomSMTP:          false,
			AutoScalerEnabled:     false,
			AppID:                 engineLocalAppID,
			EncryptionKey:         engineLocalEncryptionKey,
			StoragePublicURL:      URL(subdomain, "storage", storageHTTPPort, useTLS && storageExpose == 0),
			S3Endpoint:            "http://minio:9000",
			S3Region:              "",
			S3Bucket:              "nhost",
			S3RootFolder:          "",
			S3AccessKey:           engineLocalMinioAccessKey,
			S3SecretKey:           engineLocalMinioAccessKey,
			AntivirusServer:       deptr(cfg.Storage.GetAntivirus().GetServer()),
			NhostAuthURL:          URL(subdomain, "auth", httpPort, useTLS) + "/v1",
			NhostGraphqlURL:       URL(subdomain, "graphql", httpPort, useTLS) + "/v1",
			NhostStorageURL:       URL(subdomain, "storage", httpPort, useTLS) + "/v1",
			NhostFunctionsURL:     "http://functions:3000",
			Subdomain:             subdomain,
			Region:                "local",
			DashboardOrigin:       URL(subdomain, "dashboard", httpPort, useTLS),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build engine env vars: %w", err)
	}

	env := make(map[string]string, len(envars)+1)
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	// Constellation writes into the bind-mounted /metadata folder; its flag
	// defaults to a workdir-relative path that is unreliable inside the image,
	// and NhostEngineEnv does not pin it.
	env["CONSTELLATION_METADATA_PATH"] = engineMetadataPath

	return env, nil
}

// engineLocalSMTP is the mailhog SMTP configuration used for local dev.
func engineLocalSMTP() *model.ConfigSmtp {
	return &model.ConfigSmtp{
		User:     new("user"),
		Password: new("password"),
		Sender:   new("auth@example.com"),
		Host:     new("mailhog"),
		Port:     new(uint16(1025)), //nolint:mnd
		Secure:   new(false),
		Method:   new("LOGIN"),
	}
}

// engineIngresses returns the traefik routers for the engine container. The
// storage, auth and graphql (constellation) hosts keep their existing public
// URLs and are rewritten onto the engine's /storage, /auth and /graphql path
// prefixes. Each per-service router is present only when its service runs. The
// engine has no dedicated host of its own — it is reached solely through those
// per-subdomain hosts.
func engineIngresses(useTLS, withAuth, withStorage, withGraphql bool) Ingresses {
	var ingresses Ingresses

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
