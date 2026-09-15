package dockercompose

import (
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

const enginePort = 8080

// Local-dev values the engine must feed its bundled services. They mirror what
// auth(), storage() and constellation() pass when those run standalone;
// TestEngineEnvMatchesStandaloneServices fails if the two drift apart.
const (
	// engineDatabaseURL is one connection serving two consumers: auth's runtime
	// connection and the graphql engine's metadata store. The engine consolidates
	// both onto --database-url and uses the hasura role for it, matching what
	// factorio passes in the cloud. Standalone constellation happens to use the
	// superuser locally, but the cloud's role split is the contract worth
	// reproducing here, and it keeps auth's runtime connection identical to the
	// standalone auth container.
	engineDatabaseURL = "postgres://nhost_hasura@postgres:5432/local"
	// engineHasuraURL is the compose hasura container, which keeps running
	// alongside the engine. auth() and storage() name the same service.
	engineHasuraURL = "http://graphql:8080"

	// Each bundled service still applies its own migrations under its own
	// least-privilege role, exactly as the standalone services do.
	engineAuthMigrationsConnection = "postgres://nhost_auth_admin@postgres:5432/local"
	engineStorageConnection        = "postgres://nhost_storage_admin@postgres:5432/local?sslmode=disable"

	localAppID         = "00000000-0000-0000-0000-000000000000"
	localRegion        = "local"
	localS3Endpoint    = "http://minio:9000"
	localS3Bucket      = "nhost"
	localS3AccessKey   = "minioaccesskey123123"
	localS3SecretKey   = "minioaccesskey123123"
	localEncryptionKey = "5181f67e2844e4b60d571fa346cac9c37fc00d1ff519212eae6cead138e639ba"
	localFunctionsURL  = "http://functions:3000"
)

var errEngineVersionMissing = errors.New(
	"experimental.nhost.version is empty: the engine image tag cannot be resolved",
)

// localSMTPSettings points the bundled auth at the mailhog container, matching
// what auth() configures for the standalone service.
func localSMTPSettings() *model.ConfigSmtp {
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

// hasuraAuthUsable reports whether hasura-auth can serve this project. The
// standalone topology simply omits the auth container when it cannot; the
// engine instead runs with --disable-auth, keeping storage and graphql.
func hasuraAuthUsable(cfg *model.ConfigConfig) bool {
	return len(cfg.GetHasura().GetJwtSecrets()) > 0 &&
		IsJWTSecretCompatibleWithHasuraAuth(cfg.GetHasura().GetJwtSecrets()[0]) &&
		cfg.GetHasura().GetAuthHook() == nil
}

// engineEnabled reports whether the project opted into the bundled engine. When
// it does, one engine container replaces the separate auth and storage
// containers and takes over the graphql host from hasura, mirroring what
// factorio renders in the cloud.
func engineEnabled(cfg *model.ConfigConfig) bool {
	return cfg.GetExperimental().GetNhost() != nil
}

// engineIngress routes one public service host to the engine, prepending that
// service's mount prefix.
//
// The engine serves each bundled service under /auth, /storage or /graphql,
// while clients keep using the unprefixed per-service hosts. In the cloud the
// nginx ingress prepends the prefix; here traefik does, so the prefixes stay
// invisible to clients in both topologies. That is also why the engine's
// --mount-prefix-hosts and --auth-compat-hosts stay empty locally: nothing
// reaches the engine on a host where the prefix is externally visible.
func engineIngress(service, mount string, useTLS bool, rule string) Ingress {
	return Ingress{
		Name: "engine-" + service,
		TLS:  useTLS,
		Rule: rule,
		Port: enginePort,
		Rewrite: &Rewrite{
			Regex:       "^/(.*)",
			Replacement: mount + "/$$1",
		},
	}
}

// engine renders the bundled engine: one container serving auth, storage and
// the graphql engine. Hasura keeps running, because the engine's graphql
// service proxies to it rather than replacing it.
func engine( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	useTLS bool,
	httpPort uint,
	nhostFolder string,
	hostUser string,
) (*Service, error) {
	version := deptr(cfg.GetExperimental().GetNhost().GetVersion())
	if version == "" {
		return nil, errEngineVersionMissing
	}

	envars, err := appconfig.NhostEngineEnv(
		cfg,
		appconfig.NhostEngineEnvInput{
			// The engine binds its own default; the compose ingress targets it.
			ListenAddress: "",

			// Hasura is not bundled: the engine's graphql service proxies to the
			// same container the standalone services talk to.
			HasuraURL: engineHasuraURL,

			// Auth and the graphql engine run as the hasura role, while each
			// bundled service applies its migrations under its own role. This
			// mirrors both the standalone compose services and the cloud.
			DatabaseURL:               engineDatabaseURL,
			AuthMigrationsDatabaseURL: engineAuthMigrationsConnection,
			StorageDatabaseURL:        engineStorageConnection,

			// Traefik prepends the mount prefix, so no host sees a prefixed path
			// and no redirect needs rewriting.
			DisableAuth:      !hasuraAuthUsable(cfg),
			AuthCompatHosts:  nil,
			MountPrefixHosts: nil,

			AuthServerURL:     URL(subdomain, "auth", httpPort, useTLS) + "/v1",
			SMTPSettings:      localSMTPSettings(),
			IsCustomSMTP:      false,
			AutoScalerEnabled: false,
			AppID:             localAppID,
			EncryptionKey:     localEncryptionKey,

			StoragePublicURL: URL(subdomain, "storage", httpPort, useTLS),
			S3Endpoint:       localS3Endpoint,
			S3Region:         "",
			S3Bucket:         localS3Bucket,
			S3RootFolder:     "",
			S3AccessKey:      localS3AccessKey,
			S3SecretKey:      localS3SecretKey,
			AntivirusServer:  deptr(cfg.GetStorage().GetAntivirus().GetServer()),

			NhostAuthURL:      URL(subdomain, "auth", httpPort, useTLS) + "/v1",
			NhostGraphqlURL:   URL(subdomain, "graphql", httpPort, useTLS) + "/v1",
			NhostStorageURL:   URL(subdomain, "storage", httpPort, useTLS) + "/v1",
			NhostFunctionsURL: localFunctionsURL,
			Subdomain:         subdomain,
			Region:            localRegion,
			DashboardOrigin:   URL(subdomain, "dashboard", httpPort, useTLS),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get engine env vars: %w", err)
	}

	env := make(Environment, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image: "nhost/engine:" + version,
		DependsOn: map[string]DependsOn{
			// The graphql engine proxies to hasura and storage stores its file
			// metadata there, so the engine needs hasura up, exactly as the
			// standalone auth and storage services do.
			"graphql":  {Condition: "service_healthy"},
			"postgres": {Condition: "service_healthy"},
			"minio":    {Condition: "service_started"},
		},
		EntryPoint:  nil,
		Command:     []string{"serve"},
		Environment: env,
		ExtraHosts:  extraHosts,
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD",
				"wget",
				"--spider",
				"-S",
				fmt.Sprintf("http://localhost:%d/healthz", enginePort),
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			engineIngress(
				"auth", "/auth", useTLS,
				traefikHostMatch("auth")+" && PathPrefix(`/v1`)",
			),
			engineIngress(
				"storage", "/storage", useTLS,
				traefikHostMatch("storage")+" && PathPrefix(`/v1`)",
			),
			engineIngress(
				"graphql", "/graphql", useTLS,
				traefikHostMatch("graphql")+" && PathPrefix(`/v1`)",
			),
		}.Labels(),
		// The engine deliberately does not answer to hasura-auth-service,
		// hasura-storage-service or constellation-service: those names imply the
		// per-service ports and unprefixed routes its shared listener does not
		// serve. In-container callers use http://engine:8080/<mount>/v1.
		Networks: networkAliases(),
		Ports:    nil,
		Restart:  "always",
		User:     hostUserSpec(hostUser),
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   nhostFolder + "/emails",
				Target:   "/app/email-templates",
				ReadOnly: new(false),
			},
			{
				Type:     "bind",
				Source:   nhostFolder + "/metadata",
				Target:   "/metadata",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}, nil
}
