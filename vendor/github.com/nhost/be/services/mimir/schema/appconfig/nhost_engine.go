package appconfig

import (
	"fmt"

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
//     matching per-service flag, so the per-service copies must NOT be emitted.
//
// NhostEngineEnv therefore composes HasuraAuthEnv, HasuraStorageEnv and
// ConstellationEnv, drops the native vars the engine consolidates, and emits the
// shared globals once. remapBundledEnv holds the drop tables in one place so the
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

	envConstellationHasuraUpstreamURL = "CONSTELLATION_HASURA_UPSTREAM_URL"

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
func NhostEngineEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	authEnv, err := nhostEngineAuthEnv(cfg, input)
	if err != nil {
		return nil, err
	}

	storageEnv, err := nhostEngineStorageEnv(cfg, input)
	if err != nil {
		return nil, err
	}

	graphqlEnv, err := nhostEngineConstellationEnv(cfg, input)
	if err != nil {
		return nil, err
	}

	jwtSecret, err := marshalJWT(cfg.GetHasura().GetJwtSecrets()[0], true)
	if err != nil {
		return nil, fmt.Errorf("could not marshal JWT secret: %w", err)
	}

	bind := input.ListenAddress
	if bind == "" {
		bind = nhostEngineDefaultBind
	}

	// Hoist the CORS origins and debug flag constellation computed (from
	// experimental.nhost.graphql.settings, see nhostEngineGraphqlConfig) into the
	// shared globals before their per-service copies are dropped by remapBundledEnv.
	globals := nhostEngineGlobals(
		cfg,
		input,
		bind,
		envVarValue(graphqlEnv, envConstellationDebug),
		envVarValue(graphqlEnv, envConstellationCORSAllowedOrigins),
		string(jwtSecret),
	)

	out := remapBundledEnv(authEnv, storageEnv, graphqlEnv)

	// The engine globals are authoritative for their reserved names. Strip any
	// earlier occurrence carried in by the bundled builders — in particular a
	// user's cfg.global.environment entry named e.g. DATABASE_URL or ADMIN_SECRET
	// — so it cannot silently shadow the consolidated value once dedupeEnvByName
	// keeps the first copy. Only the reserved names are stripped; every other
	// global.environment entry keeps its original position.
	reserved := make(map[string]struct{}, len(globals))
	for _, g := range globals {
		reserved[g.Name] = struct{}{}
	}

	out = appendFiltered(make([]EnvVar, 0, len(out)+len(globals)), out, reserved)
	out = append(out, globals...)

	return dedupeEnvByName(out), nil
}

// nhostEngineAuthEnv builds hasura-auth's env with the graphql URL pinned to the
// standalone Hasura. The shared DB URLs are supplied here but dropped by
// remapBundledEnv in favour of the engine globals.
func nhostEngineAuthEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	env, err := HasuraAuthEnv(
		cfg,
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

	return env, nil
}

// remapBundledEnv concatenates the three bundled services' env vars, dropping the
// native names the engine consolidates into shared globals or owns itself. The
// drop tables are the single place to correct the mapping if the engine's skip
// sets change.
func remapBundledEnv(authEnv, storageEnv, graphqlEnv []EnvVar) []EnvVar {
	// hasura-auth: shared secrets/DB URLs -> globals; listener owned by engine.
	authDrop := map[string]struct{}{
		"HASURA_GRAPHQL_ADMIN_SECRET":    {}, // -> ADMIN_SECRET
		"HASURA_GRAPHQL_JWT_SECRET":      {}, // -> JWT_SECRET
		"HASURA_GRAPHQL_DATABASE_URL":    {}, // -> DATABASE_URL (constellation keeps its own copy)
		"POSTGRES_MIGRATIONS_CONNECTION": {}, // -> MIGRATIONS_DATABASE_URL
		"AUTH_PORT":                      {}, // engine owns the shared listener
		"AUTH_HOST":                      {}, // engine owns the shared listener
	}
	// hasura-storage: shared admin/migrations -> globals; listener owned by engine.
	storageDrop := map[string]struct{}{
		"HASURA_GRAPHQL_ADMIN_SECRET": {}, // -> ADMIN_SECRET
		"POSTGRES_MIGRATIONS_SOURCE":  {}, // -> MIGRATIONS_DATABASE_URL
		"BIND":                        {}, // engine owns the shared listener
	}
	// constellation: shared secrets/DB/CORS/debug -> globals. CORS and debug have
	// their computed value hoisted into the globals first. NHOST_JWT_SECRET
	// (verify-only) is dropped in favour of the single JWT_SECRET global.
	graphqlDrop := map[string]struct{}{
		"CONSTELLATION_ADMIN_SECRET":          {}, // -> ADMIN_SECRET
		"CONSTELLATION_JWT_SECRET":            {}, // -> JWT_SECRET
		"CONSTELLATION_METADATA_DATABASE_URL": {}, // -> DATABASE_URL
		envConstellationCORSAllowedOrigins:    {}, // -> CORS_ALLOWED_ORIGINS (hoisted)
		envConstellationDebug:                 {}, // -> DEBUG (hoisted)
		"NHOST_JWT_SECRET":                    {}, // -> JWT_SECRET
	}

	out := make([]EnvVar, 0, len(authEnv)+len(storageEnv)+len(graphqlEnv))
	out = appendFiltered(out, authEnv, authDrop)
	out = appendFiltered(out, storageEnv, storageDrop)
	out = appendFiltered(out, graphqlEnv, graphqlDrop)

	return out
}

// nhostEngineGlobals returns the engine's shared globals plus the constellation
// Hasura-upstream pin, each emitted exactly once.
func nhostEngineGlobals(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
	bind, debug, corsAllowedOrigins, jwtSecret string,
) []EnvVar {
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
// so ConstellationEnv sources debug/devMode/pollInterval/corsAllowedOrigins from
// the engine's graphql config rather than the standalone constellation config
// (the two are mutually exclusive). Only Experimental is replaced; every other
// section is shared with cfg and left untouched.
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
// occurrence. The bundled auth and constellation builders each append the user's
// global environment (cfg.global.environment); in a single engine container
// those must appear only once.
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
