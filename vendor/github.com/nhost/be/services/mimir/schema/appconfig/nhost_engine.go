package appconfig

import (
	"fmt"
	"strconv"

	"github.com/nhost/be/services/mimir/model"
)

// The nhost-engine binary runs auth, storage and constellation (its GraphQL
// engine) in one process behind a single shared HTTP listener. Its env/CLI
// contract (see nhost/nhost services/nhost-engine) is:
//
//   - Each bundled service keeps reading its own native environment variables:
//     the engine re-parses every sub-command with its native flag sources
//     (buildService in compose.go), and constellation additionally resolves
//     NHOST_*/GRAPHITE_* through its metadata "{{VAR}}" interpolation. So
//     per-service values are passed through unchanged under their native names.
//   - A small set of SHARED values (the engine "skip" sets: the listener, the
//     admin secret, the JWT secret, the postgres + migrations URLs, the CORS
//     origins and debug/log settings) are consolidated into engine globals that
//     are set exactly once. applySharedConfig then injects each global into the
//     matching per-service flag unless that service's native env set it first.
//
// NhostEngineEnv therefore composes HasuraAuthEnv, HasuraStorageEnv and
// ConstellationEnv without their user globals, drops the native vars the engine
// consolidates, emits the shared globals, then appends the user globals once.
// Storage deliberately keeps its native CORS override to preserve standalone
// allow-all behaviour. remapBundledEnv holds the drop tables in one place so the
// mapping can be corrected if the engine's skip sets change.
const (
	// nhostEngineDefaultBind is the engine's shared listener address, used when
	// the caller does not override it.
	nhostEngineDefaultBind = ":8080"

	// The bundled services keep talking to the standalone Hasura Deployment
	// (hasura is deliberately not part of the engine — it still serves
	// migrations/metadata/actions). These pin the internal URLs (plan §1.7 OQ1).
	nhostEngineAuthHasuraGraphqlURL  = "http://hasura-service:8080/v1/graphql"
	nhostEngineStorageHasuraEndpoint = "http://hasura-service:8080/v1"
	// nhostEngineConstellationHasuraUpstream is the Hasura instance constellation
	// reverse-proxies to for routes it does not serve natively. It matches
	// constellation's own default and points at the standalone Hasura.
	nhostEngineConstellationHasuraUpstream = "http://hasura-service:8080/"

	envAuthPostgresConnection         = "POSTGRES_CONNECTION"
	envConstellationHasuraUpstreamURL = "CONSTELLATION_HASURA_UPSTREAM_URL"
	envStorageCDNCacheControl         = "CDN_CACHE_CONTROL"
	envStorageCORSAllowOrigins        = "CORS_ALLOW_ORIGINS"
	envNhostJWTMetadata               = "NHOST_JWT_SECRET"

	// Engine shared globals (set once).
	envEngineBind                  = "BIND"
	envEngineDebug                 = "DEBUG"
	envEngineCORSAllowedOrigins    = "CORS_ALLOWED_ORIGINS"
	envEngineAdminSecret           = "ADMIN_SECRET"
	envEngineJWTSecret             = "JWT_SECRET"
	envEngineDatabaseURL           = "DATABASE_URL"
	envEngineMigrationsDatabaseURL = "MIGRATIONS_DATABASE_URL"

	// Secret keys for the single engine Secret produced by convertEnvVars.
	secretNhostEngineAdminSecret           = "adminSecret"
	secretNhostEngineJWTSecret             = "jwtSecret"
	secretNhostEngineMetadataJWTSecret     = "nhostJwtSecret"
	secretNhostEngineDatabaseURL           = "databaseUrl"
	secretNhostEngineMigrationsDatabaseURL = "migrationsDatabaseUrl"

	// Constellation vars whose computed value the engine hoists into a global.
	envConstellationCORSAllowedOrigins = "CONSTELLATION_CORS_ALLOWED_ORIGINS"
	envConstellationDebug              = "CONSTELLATION_DEBUG"
)

// NhostEngineEnvInput carries the runtime URLs, secrets and tenant identity the
// bundled auth/storage/constellation builders need, in addition to the app
// config. The shared DatabaseURL/MigrationsDatabaseURL are passed once and
// emitted as the engine's DATABASE_URL/MIGRATIONS_DATABASE_URL globals.
type NhostEngineEnvInput struct {
	// ListenAddress is the engine's shared HTTP listener. Defaults to ":8080".
	ListenAddress string

	// DatabaseURL is the shared PostgreSQL connection (the standalone-hasura
	// database) used by auth's main connection and the graphql engine's metadata
	// database. Emitted once as DATABASE_URL.
	DatabaseURL string
	// MigrationsDatabaseURL is the shared migrations connection used by both auth
	// and storage. Emitted once as MIGRATIONS_DATABASE_URL.
	MigrationsDatabaseURL string

	// DisableAuth omits hasura-auth's env from the engine output for apps whose
	// first JWT secret is not hasura-auth compatible (or that configure an auth
	// hook / external auth). Storage and constellation are still emitted, and the
	// JWT_SECRET global is still set so constellation can validate tokens. This
	// mirrors the standalone path, where hasura-auth is simply not deployed.
	DisableAuth bool

	// auth
	AuthServerURL     string
	SMTPSettings      *model.ConfigSmtp
	IsCustomSMTP      bool
	AutoScalerEnabled bool
	AppID             string
	EncryptionKey     string

	// storage
	StoragePublicURL string
	S3Endpoint       string
	S3Region         string
	S3Bucket         string
	S3RootFolder     string
	S3AccessKey      string
	S3SecretKey      string
	AntivirusServer  string

	// graphql (constellation)
	NhostAuthURL      string
	NhostGraphqlURL   string
	NhostStorageURL   string
	NhostFunctionsURL string
	Subdomain         string
	Region            string
	DashboardOrigin   string
}

// NhostEngineEnv builds the env/CLI variables for the nhost-engine unified
// binary by composing the auth, storage and constellation builders and remapping
// their output into the engine's contract: per-service values pass through under
// their native names, and the shared globals are emitted exactly once.
func NhostEngineEnv( //nolint:funlen // Keep precedence-sensitive environment assembly linear.
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	// Auth and constellation append global.environment themselves for standalone
	// deployments. Build every bundled service without that environment so user
	// globals can be appended once, after all authoritative engine values.
	serviceCfg := *cfg
	serviceCfg.Global = &model.ConfigGlobal{Environment: nil}

	// hasura-auth is omitted when the app's JWT is not hasura-auth compatible;
	// storage and constellation still run, and JWT_SECRET is still emitted below.
	var authEnv []EnvVar

	if !input.DisableAuth {
		var err error

		authEnv, err = nhostEngineAuthEnv(&serviceCfg, input)
		if err != nil {
			return nil, err
		}
	}

	storageEnv, err := nhostEngineStorageEnv(&serviceCfg, input)
	if err != nil {
		return nil, err
	}

	graphqlEnv, err := nhostEngineConstellationEnv(&serviceCfg, input)
	if err != nil {
		return nil, err
	}

	// The engine consolidates every JWT source into the single JWT_SECRET global
	// (see remapBundledEnv), which constellation uses to validate tokens even when
	// hasura-auth is disabled. The closed list in schema.cue pins
	// hasura.jwtSecrets to exactly one element, matching the sibling env builders.
	secrets := cfg.GetHasura().GetJwtSecrets()

	// Bundled auth signs tokens and therefore needs the private key. When auth
	// is disabled, storage and constellation only verify tokens, so omit it.
	raw, err := marshalJWT(secrets[0], !input.DisableAuth)
	if err != nil {
		return nil, fmt.Errorf("could not marshal JWT secret: %w", err)
	}

	jwtSecret := string(raw)

	bind := input.ListenAddress
	if bind == "" {
		bind = nhostEngineDefaultBind
	}

	// Hoist constellation's computed CORS origins and debug fallback into shared
	// globals before their per-service copies are dropped by remapBundledEnv.
	// nhostEngineGlobals replaces the legacy debug fallback when the promoted
	// experimental.nhost.debug field is present.
	globals := nhostEngineGlobals(
		cfg,
		input,
		bind,
		envVarValue(graphqlEnv, envConstellationDebug),
		envVarValue(graphqlEnv, envConstellationCORSAllowedOrigins),
		jwtSecret,
	)

	out, bundledDrop := remapBundledEnv(authEnv, storageEnv, graphqlEnv)

	// Strip user-provided copies of engine globals and replaced native names,
	// while retaining unrelated entries after every authoritative service value.
	strip := nhostEngineStripSet(globals, bundledDrop)
	out = appendFiltered(
		make([]EnvVar, 0, len(out)+len(globals)+len(cfg.GetGlobal().GetEnvironment())),
		out,
		strip,
	)
	out = append(out, globals...)

	for _, env := range cfg.GetGlobal().GetEnvironment() {
		if _, stripped := strip[env.Name]; stripped {
			continue
		}

		out = append(out, EnvVar{
			Name:       env.Name,
			Value:      env.Value,
			IsSecret:   false,
			SecretName: "",
		})
	}

	return dedupeEnvByName(out), nil
}

func nhostEngineStripSet(
	globals []EnvVar,
	bundledDrop map[string]struct{},
) map[string]struct{} {
	strip := make(map[string]struct{}, len(globals)+len(bundledDrop))
	for name := range bundledDrop {
		strip[name] = struct{}{}
	}

	for _, global := range globals {
		strip[global.Name] = struct{}{}
	}

	// Constellation emits this native name for metadata interpolation. Keep its
	// real, first-occurring value; auth already drops its copy, so first-wins
	// deduplication prevents the later user value from replacing it.
	delete(strip, "HASURA_GRAPHQL_DATABASE_URL")

	return strip
}

// nhostEngineAuthEnv builds hasura-auth's env with the graphql URL pinned to the
// standalone Hasura. The shared DB URLs are supplied here but dropped by
// remapBundledEnv in favour of the engine globals.
func nhostEngineAuthEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	// HasuraAuthEnv divides fixed-instance rate-limit bursts using auth's replica
	// count. The bundled engine is instead sized by experimental.nhost.resources,
	// so adapt a copy of the auth config to the deployed engine replica count.
	// Copy every pointer-bearing level we replace to leave the caller untouched.
	engineReplicas := uint8(1)
	if configuredReplicas := cfg.GetExperimental().
		GetNhost().
		GetResources().
		GetReplicas(); configuredReplicas != nil {
		engineReplicas = *configuredReplicas
	}

	authCfg := *cfg
	auth := *cfg.GetAuth()

	authResources := cfg.GetAuth().GetResources()
	if authResources == nil {
		authResources = &model.ConfigResources{
			Compute:    nil,
			Replicas:   nil,
			Autoscaler: nil,
			Networking: nil,
		}
	}

	engineAuthResources := *authResources
	engineAuthResources.Replicas = &engineReplicas
	auth.Resources = &engineAuthResources
	authCfg.Auth = &auth

	env, err := HasuraAuthEnv(
		&authCfg,
		nhostEngineAuthHasuraGraphqlURL,
		input.AuthServerURL,
		input.DatabaseURL,
		input.MigrationsDatabaseURL,
		input.SMTPSettings,
		input.IsCustomSMTP,
		input.AutoScalerEnabled,
		input.AppID,
		input.EncryptionKey,
	)
	if err != nil {
		return nil, fmt.Errorf("could not build hasura-auth env: %w", err)
	}

	return env, nil
}

// nhostEngineStorageEnv builds hasura-storage's env with the Hasura endpoint
// pinned to the standalone Hasura. The migrations source is supplied here but
// dropped by remapBundledEnv in favour of the MIGRATIONS_DATABASE_URL global.
func nhostEngineStorageEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	env, err := HasuraStorageEnv(
		cfg,
		nhostEngineStorageHasuraEndpoint,
		input.MigrationsDatabaseURL,
		input.StoragePublicURL,
		input.S3Endpoint,
		input.S3Region,
		input.S3Bucket,
		input.S3RootFolder,
		input.S3AccessKey,
		input.S3SecretKey,
		input.AntivirusServer,
	)
	if err != nil {
		return nil, fmt.Errorf("could not build hasura-storage env: %w", err)
	}

	env = append(
		env,
		EnvVar{
			Name:       envStorageCDNCacheControl,
			Value:      "true",
			IsSecret:   false,
			SecretName: "",
		},
		EnvVar{
			// The native storage env source marks cors-allow-origins as explicitly
			// set, so the engine does not replace storage's standalone allow-all
			// default with the shared constellation origin list.
			Name:       envStorageCORSAllowOrigins,
			Value:      "*",
			IsSecret:   false,
			SecretName: "",
		},
	)

	return env, nil
}

// nhostEngineConstellationEnv builds constellation's env, sourcing its settings
// from experimental.nhost.graphql (see nhostEngineGraphqlConfig).
func nhostEngineConstellationEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	env, err := ConstellationEnv(
		nhostEngineGraphqlConfig(cfg),
		ConstellationEnvInput{
			PostgresConnection: input.DatabaseURL,
			NhostAuthURL:       input.NhostAuthURL,
			NhostGraphqlURL:    input.NhostGraphqlURL,
			NhostStorageURL:    input.NhostStorageURL,
			NhostFunctionsURL:  input.NhostFunctionsURL,
			Subdomain:          input.Subdomain,
			Region:             input.Region,
			DashboardOrigin:    input.DashboardOrigin,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("could not build constellation env: %w", err)
	}

	// NHOST_JWT_SECRET remains available to metadata interpolation and carries
	// ConstellationEnv's verification-only JWT. It needs a distinct Secret key
	// because JWT_SECRET may additionally contain auth's signing material.
	for i := range env {
		if env[i].Name == envNhostJWTMetadata {
			env[i].SecretName = secretNhostEngineMetadataJWTSecret
		}
	}

	return env, nil
}

type nhostEngineFlagEnvContract struct {
	aliases []string
	strip   bool
}

type nhostEngineServiceEnvContract struct {
	flags      map[string]nhostEngineFlagEnvContract
	extraDrops []string
}

// nhostEngineNativeEnvContract associates each consolidated engine flag with
// its native service aliases. remapBundledEnv derives its production drop maps
// from this contract, so tests can detect both alias reassignment between flags
// and stale strip entries.
func nhostEngineNativeEnvContract() map[string]nhostEngineServiceEnvContract {
	return map[string]nhostEngineServiceEnvContract{
		"auth": {
			flags: map[string]nhostEngineFlagEnvContract{
				"hasura-admin-secret": {
					aliases: []string{"HASURA_GRAPHQL_ADMIN_SECRET"},
					strip:   true,
				},
				"hasura-graphql-jwt-secret": {
					aliases: []string{"HASURA_GRAPHQL_JWT_SECRET"},
					strip:   true,
				},
				"postgres": {
					aliases: []string{envAuthPostgresConnection, "HASURA_GRAPHQL_DATABASE_URL"},
					strip:   true,
				},
				"postgres-migrations": {
					aliases: []string{"POSTGRES_MIGRATIONS_CONNECTION"},
					strip:   true,
				},
			},
			extraDrops: []string{"AUTH_PORT", "AUTH_HOST"},
		},
		"storage": {
			flags: map[string]nhostEngineFlagEnvContract{
				"hasura-graphql-admin-secret": {
					aliases: []string{"HASURA_GRAPHQL_ADMIN_SECRET"},
					strip:   true,
				},
				"postgres-migrations-source": {
					aliases: []string{"POSTGRES_MIGRATIONS_SOURCE"},
					strip:   true,
				},
				"cors-allow-origins": {
					aliases: []string{envStorageCORSAllowOrigins},
					strip:   false,
				},
			},
			extraDrops: []string{"BIND"},
		},
		"graphql": {
			flags: map[string]nhostEngineFlagEnvContract{
				"admin-secret": {
					aliases: []string{"CONSTELLATION_ADMIN_SECRET"},
					strip:   true,
				},
				"jwt-secret": {
					aliases: []string{"CONSTELLATION_JWT_SECRET"},
					strip:   true,
				},
				"metadata-database-url": {
					aliases: []string{"CONSTELLATION_METADATA_DATABASE_URL"},
					strip:   true,
				},
				"cors-allowed-origins": {
					aliases: []string{envConstellationCORSAllowedOrigins},
					strip:   true,
				},
			},
			extraDrops: []string{envConstellationDebug},
		},
	}
}

func nhostEngineDropSets() map[string]map[string]struct{} {
	contracts := nhostEngineNativeEnvContract()
	drops := make(map[string]map[string]struct{}, len(contracts))

	for service, contract := range contracts {
		drop := make(map[string]struct{})

		for _, flag := range contract.flags {
			if !flag.strip {
				continue
			}

			for _, alias := range flag.aliases {
				drop[alias] = struct{}{}
			}
		}

		for _, alias := range contract.extraDrops {
			drop[alias] = struct{}{}
		}

		drops[service] = drop
	}

	return drops
}

// remapBundledEnv concatenates the three bundled services' env vars, dropping
// the native names the engine consolidates into shared globals or owns itself.
// It also returns their union so user-provided copies can be stripped.
func remapBundledEnv(
	authEnv, storageEnv, graphqlEnv []EnvVar,
) ([]EnvVar, map[string]struct{}) {
	drops := nhostEngineDropSets()
	authDrop := drops["auth"]
	storageDrop := drops["storage"]
	graphqlDrop := drops["graphql"]

	dropped := make(map[string]struct{}, len(authDrop)+len(storageDrop)+len(graphqlDrop))
	for _, drop := range []map[string]struct{}{authDrop, storageDrop, graphqlDrop} {
		for name := range drop {
			dropped[name] = struct{}{}
		}
	}

	out := make([]EnvVar, 0, len(authEnv)+len(storageEnv)+len(graphqlEnv))
	out = appendFiltered(out, authEnv, authDrop)
	out = appendFiltered(out, storageEnv, storageDrop)
	out = appendFiltered(out, graphqlEnv, graphqlDrop)

	return out, dropped
}

// nhostEngineGlobals returns the engine's shared globals plus the constellation
// Hasura-upstream pin, each emitted exactly once. graphqlDebug preserves the
// legacy experimental.nhost.graphql.settings.debug location; the promoted
// engine-wide field is authoritative whenever it is present, including when both
// locations are set.
func nhostEngineGlobals(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
	bind, graphqlDebug, corsAllowedOrigins, jwtSecret string,
) []EnvVar {
	debug := graphqlDebug
	if engineDebug := cfg.GetExperimental().GetNhost().GetDebug(); engineDebug != nil {
		debug = strconv.FormatBool(*engineDebug)
	}

	return []EnvVar{
		{
			Name:       envConstellationHasuraUpstreamURL,
			Value:      nhostEngineConstellationHasuraUpstream,
			IsSecret:   false,
			SecretName: "",
		},
		{Name: envEngineBind, Value: bind, IsSecret: false, SecretName: ""},
		{Name: envEngineDebug, Value: debug, IsSecret: false, SecretName: ""},
		{
			Name:       envEngineCORSAllowedOrigins,
			Value:      corsAllowedOrigins,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       envEngineAdminSecret,
			Value:      cfg.GetHasura().GetAdminSecret(),
			IsSecret:   true,
			SecretName: secretNhostEngineAdminSecret,
		},
		{
			Name:       envEngineJWTSecret,
			Value:      jwtSecret,
			IsSecret:   true,
			SecretName: secretNhostEngineJWTSecret,
		},
		{
			Name:       envEngineDatabaseURL,
			Value:      input.DatabaseURL,
			IsSecret:   true,
			SecretName: secretNhostEngineDatabaseURL,
		},
		{
			Name:       envEngineMigrationsDatabaseURL,
			Value:      input.MigrationsDatabaseURL,
			IsSecret:   true,
			SecretName: secretNhostEngineMigrationsDatabaseURL,
		},
	}
}

// nhostEngineGraphqlConfig returns a shallow copy of cfg whose
// experimental.constellation.settings mirror experimental.nhost.graphql.settings,
// so ConstellationEnv sources the legacy debug fallback plus the constellation-
// scoped devMode/pollInterval/corsAllowedOrigins settings from the engine's
// graphql config rather than the standalone constellation config (the two are
// mutually exclusive). Only Experimental is replaced; every other section is
// shared with cfg and left untouched.
func nhostEngineGraphqlConfig(cfg *model.ConfigConfig) *model.ConfigConfig {
	var settings *model.ConfigConstellationSettings
	if s := cfg.GetExperimental().GetNhost().GetGraphql().GetSettings(); s != nil {
		// This copy is exhaustive and MUST stay so: ConfigConstellationConfigSettings
		// and ConfigConstellationSettings are two Go structs generated from the same
		// CUE (#ConstellationConfig embedded in #Constellation), so a new
		// experimental.nhost.graphql.settings field compiles fine here yet would be
		// SILENTLY DROPPED on the engine path if not added below. When adding a
		// settings field, copy it here (and grant factorio SA perms for it, same as
		// other new nhost fields). TestNhostEngineGraphqlSettingsNoSilentDrift guards
		// this by failing when the settings shape changes.
		settings = &model.ConfigConstellationSettings{
			CorsAllowedOrigins:       s.GetCorsAllowedOrigins(),
			Debug:                    s.GetDebug(),
			DevMode:                  s.GetDevMode(),
			SubscriptionPollInterval: s.GetSubscriptionPollInterval(),
		}
	}

	out := *cfg
	out.Experimental = &model.ConfigExperimental{
		Constellation: &model.ConfigConstellation{
			Version:  nil,
			Settings: settings,
		},
		Nhost: cfg.GetExperimental().GetNhost(),
	}

	return &out
}

// appendFiltered appends every env var in src except those whose name is in drop.
func appendFiltered(dst, src []EnvVar, drop map[string]struct{}) []EnvVar {
	for _, e := range src {
		if _, dropped := drop[e.Name]; dropped {
			continue
		}

		dst = append(dst, e)
	}

	return dst
}

// envVarValue returns the value of the named env var, or "" if it is absent.
func envVarValue(env []EnvVar, name string) string {
	for _, e := range env {
		if e.Name == name {
			return e.Value
		}
	}

	return ""
}

// dedupeEnvByName removes duplicate env vars by name, keeping the first
// occurrence. User globals are appended after generated values, so first-wins
// preserves service authority and also handles repeated user names consistently.
func dedupeEnvByName(env []EnvVar) []EnvVar {
	seen := make(map[string]struct{}, len(env))
	out := make([]EnvVar, 0, len(env))

	for _, e := range env {
		if _, ok := seen[e.Name]; ok {
			continue
		}

		seen[e.Name] = struct{}{}
		out = append(out, e)
	}

	return out
}
