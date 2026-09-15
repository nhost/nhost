package appconfig

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

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
//     admin secret, the JWT secret, the runtime postgres URL, the CORS origins
//     and debug/log settings) are consolidated into engine globals that are set
//     exactly once. applySharedConfig then injects each global into the matching
//     per-service flag unless that service's native env set it first. Auth and
//     storage keep their distinct native migration variables because each uses
//     its own least-privilege PostgreSQL role.
//
// NhostEngineEnv therefore composes HasuraAuthEnv, HasuraStorageEnv and
// ConstellationEnv without their user globals, drops the native vars the engine
// consolidates, emits the shared globals, then appends the user globals once.
// Storage deliberately keeps its native CORS override to preserve standalone
// allow-all behaviour. remapBundledEnv holds the drop tables in one place so the
// mapping can be corrected if the engine's skip sets change.
const (
	// engineDefaultBind is the engine's shared listener address, used when
	// the caller does not override it.
	engineDefaultBind = ":8080"

	// The bundled services keep talking to the standalone Hasura deployment
	// (hasura is deliberately not part of the engine — it still serves
	// migrations/metadata/actions). Each service wants a different path under
	// input.HasuraURL: auth queries the GraphQL endpoint, storage the v1 API, and
	// constellation reverse-proxies the root for routes it does not serve
	// natively (matching constellation's own default).
	engineAuthHasuraPath          = "/v1/graphql"
	engineStorageHasuraPath       = "/v1"
	engineConstellationHasuraPath = "/"

	envAuthPostgresConnection           = "POSTGRES_CONNECTION"
	envAuthPostgresMigrationsConnection = "POSTGRES_MIGRATIONS_CONNECTION"
	envConstellationHasuraUpstreamURL   = "CONSTELLATION_HASURA_UPSTREAM_URL"
	envStorageCDNCacheControl           = "CDN_CACHE_CONTROL"
	envStorageCORSAllowOrigins          = "CORS_ALLOW_ORIGINS"
	envStoragePostgresMigrationsSource  = "POSTGRES_MIGRATIONS_SOURCE"
	envNhostJWTMetadata                 = "NHOST_JWT_SECRET"

	// Engine shared globals (set once).
	envEngineBind               = "BIND"
	envEngineDebug              = "DEBUG"
	envEngineCORSAllowedOrigins = "CORS_ALLOWED_ORIGINS"
	envEngineAuthCompatHosts    = "AUTH_COMPAT_HOSTS"
	envEngineMountPrefixHosts   = "MOUNT_PREFIX_HOSTS"
	envEngineDisableAuth        = "DISABLE_AUTH"
	envEngineAdminSecret        = "ADMIN_SECRET"
	envEngineJWTSecret          = "JWT_SECRET"
	envEngineDatabaseURL        = "DATABASE_URL"

	// Secret keys for the single engine Secret produced by convertEnvVars.
	secretNhostEngineAdminSecret        = "adminSecret"
	secretNhostEngineJWTSecret          = "jwtSecret"
	secretNhostEngineMetadataJWTSecret  = "nhostJwtSecret"
	secretNhostEngineDatabaseURL        = "databaseUrl"
	secretNhostEngineStorageDatabaseURL = "storageDatabaseUrl"

	// Constellation vars whose computed value the engine hoists into a global.
	envConstellationCORSAllowedOrigins = "CONSTELLATION_CORS_ALLOWED_ORIGINS"
	envConstellationDebug              = "CONSTELLATION_DEBUG"
)

var (
	errNhostEngineHasuraURLRequired = errors.New(
		"hasura URL is required: the bundled services proxy and query the standalone hasura",
	)
	errNhostEngineHasuraURLNotAbsolute = errors.New(
		"hasura URL must be absolute, including the scheme",
	)

	errNhostEngineAuthConfigRequired  = errors.New("auth config is required")
	errNhostEngineAuthVersionRequired = errors.New(
		"auth.version is required",
	)
	errNhostEngineAuthSessionAccessTokenRequired = errors.New(
		"auth.session.accessToken is required",
	)
	errNhostEngineAuthUserRolesDefaultRequired = errors.New(
		"auth.user.roles.default is required",
	)
	errNhostEngineAuthMethodEmailPasswordHIBPEnabledRequired = errors.New(
		"auth.method.emailPassword.hibpEnabled is required",
	)
	errNhostEngineAuthMethodEmailPasswordMinLengthRequired = errors.New(
		"auth.method.emailPassword.passwordMinLength is required",
	)
	errNhostEngineAuthTotpEnabledRequired = errors.New(
		"auth.totp.enabled is required",
	)
	errNhostEngineAuthMethodEmailPasswordlessEnabledRequired = errors.New(
		"auth.method.emailPasswordless.enabled is required",
	)
	errNhostEngineAuthMethodEmailVerificationRequired = errors.New(
		"auth.method.emailPassword.emailVerificationRequired is required",
	)
)

// NhostEngineEnvInput carries the runtime URLs, secrets and tenant identity the
// bundled auth/storage/constellation builders need, in addition to the app
// config. DatabaseURL is emitted as the shared DATABASE_URL global, while each
// service's migrations connection remains under its native environment name.
type NhostEngineEnvInput struct {
	// ListenAddress is the engine's shared HTTP listener. Defaults to ":8080".
	ListenAddress string

	// HasuraURL is the base URL of the standalone hasura deployment the bundled
	// services query and reverse-proxy to, without a trailing slash (for example
	// "http://hasura-service:8080" in the platform, or the compose service name
	// locally). Hasura is not part of the engine, and its address depends on the
	// deployment topology, so callers must supply it.
	HasuraURL string

	// DatabaseURL is the shared PostgreSQL connection (the standalone-hasura
	// database) used by auth's main connection and the graphql engine's metadata
	// database. Emitted once as DATABASE_URL.
	DatabaseURL string
	// AuthMigrationsDatabaseURL must use auth's least-privilege PostgreSQL role.
	// It is emitted as auth's native POSTGRES_MIGRATIONS_CONNECTION variable.
	AuthMigrationsDatabaseURL string
	// StorageDatabaseURL must use storage's least-privilege PostgreSQL role. The
	// same connection serves storage at runtime and applies its migrations through
	// the native POSTGRES_MIGRATIONS_SOURCE variable.
	StorageDatabaseURL string

	// DisableAuth sets the engine's DISABLE_AUTH global and omits hasura-auth's
	// env for apps whose first JWT secret is not hasura-auth compatible (or that
	// configure an auth hook / external auth). Storage and constellation are still
	// emitted, and JWT_SECRET remains set so constellation can validate tokens.
	// This mirrors the standalone path, where hasura-auth is simply not deployed.
	DisableAuth bool

	// AuthCompatHosts are bare DNS hostnames whose root-relative requests should
	// reach auth without the engine's /auth mount prefix.
	AuthCompatHosts []string
	// MountPrefixHosts are bare DNS hostnames where the engine's /auth, /storage,
	// and /graphql mount prefixes are externally visible and must be restored on
	// root-relative redirects.
	MountPrefixHosts []string

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
// their native names, and the shared globals are emitted exactly once. Values
// derived from app config take precedence over same-named global.environment
// entries. This reverses standalone-container precedence deliberately so users
// cannot replace consolidated secrets, least-privilege database connections, or
// other authoritative engine values through the generic environment escape hatch.
// The AUTH_ prefix is reserved as a namespace policy: every AUTH_-prefixed user
// global is stripped even when hasura-auth does not currently emit that name.
// S3_ACCESS_KEY, S3_SECRET_KEY, CLAMAV_SERVER,
// IMAGE_TRANSFORMER_MAX_DIMENSION, and IMAGE_TRANSFORMER_MAX_BLUR_SIGMA are also
// reserved when their storage features are disabled. The auth configuration
// required by HasuraAuthEnv is validated even when DisableAuth is true because
// its environment names remain reserved when the service is not emitted.
func NhostEngineEnv( //nolint:funlen // Keep precedence-sensitive environment assembly linear.
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	// Validate once here rather than letting three malformed URLs reach three
	// different services.
	if err := validateEngineHasuraURL(input.HasuraURL); err != nil {
		return nil, err
	}

	// Auth and constellation append global.environment themselves for standalone
	// deployments. Build every bundled service without that environment so user
	// globals can be appended once, after all authoritative engine values.
	serviceCfg := *cfg
	serviceCfg.Global = &model.ConfigGlobal{Environment: nil}

	// Build hasura-auth's env even when the service is disabled. The values are
	// omitted below, but their names remain authoritative and must still be
	// protected from global.environment overrides.
	authEnv, err := engineAuthEnv(&serviceCfg, input)
	if err != nil {
		return nil, err
	}

	emittedAuthEnv := authEnv
	if input.DisableAuth {
		emittedAuthEnv = nil
	}

	storageEnv, err := engineStorageEnv(&serviceCfg, input)
	if err != nil {
		return nil, err
	}

	graphqlEnv, err := engineConstellationEnv(&serviceCfg, input)
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
		bind = engineDefaultBind
	}

	// Hoist constellation's computed CORS origins and debug fallback into shared
	// globals before their per-service copies are dropped by remapBundledEnv.
	// engineGlobals replaces the legacy debug fallback when the promoted
	// experimental.nhost.debug field is present.
	globals := engineGlobals(
		cfg,
		input,
		bind,
		envVarValue(graphqlEnv, envConstellationDebug),
		envVarValue(graphqlEnv, envConstellationCORSAllowedOrigins),
		jwtSecret,
	)

	out, bundledDrop := remapBundledEnv(emittedAuthEnv, storageEnv, graphqlEnv)

	// Strip service copies of engine globals and replaced native names before
	// adding the authoritative globals. This set must not contain retained native
	// service vars, otherwise it would remove their generated values as well.
	out = appendFiltered(
		make([]EnvVar, 0, len(out)+len(globals)+len(cfg.GetGlobal().GetEnvironment())),
		out,
		engineOutputStripSet(globals, bundledDrop),
	)
	out = append(out, globals...)

	// The user-global strip set additionally includes every name produced by all
	// bundled builders. authEnv is included even when auth is disabled, preventing
	// that configuration switch from transferring ownership to the user.
	strip := engineUserGlobalStripSet(
		globals,
		bundledDrop,
		cfg.GetGlobal().GetEnvironment(),
		authEnv,
		storageEnv,
		graphqlEnv,
	)
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

// engineOutputStripSet contains only names that must be removed from
// generated bundled output before the engine globals are appended. It is
// intentionally weaker than engineUserGlobalStripSet.
func engineOutputStripSet(
	globals []EnvVar,
	bundledDrop map[string]struct{},
) map[string]struct{} {
	strip := engineBaseStripSet(globals, bundledDrop, 0)

	// Constellation emits this native name for metadata interpolation, so keep its
	// real, first-occurring generated value in bundled output.
	delete(strip, "HASURA_GRAPHQL_DATABASE_URL")

	return strip
}

// engineUserGlobalStripSet protects every name owned by an engine global
// or any bundled service configuration, including generated names that are not
// emitted for the current configuration.
func engineUserGlobalStripSet(
	globals []EnvVar,
	bundledDrop map[string]struct{},
	userEnvironment []*model.ConfigGlobalEnvironmentVariable,
	authoritativeEnv ...[]EnvVar,
) map[string]struct{} {
	capacity := len(userEnvironment)
	for _, env := range authoritativeEnv {
		capacity += len(env)
	}

	strip := engineBaseStripSet(globals, bundledDrop, capacity)

	for _, env := range authoritativeEnv {
		for _, envVar := range env {
			strip[envVar.Name] = struct{}{}
		}
	}

	// Some service settings emit variables only when their corresponding feature
	// is configured. Reserve those names rather than deriving their ownership from
	// one particular config's output.
	for _, envVar := range userEnvironment {
		if engineConditionallyAuthoritativeEnvName(envVar.Name) {
			strip[envVar.Name] = struct{}{}
		}
	}

	return strip
}

func engineBaseStripSet(
	globals []EnvVar,
	bundledDrop map[string]struct{},
	extraCapacity int,
) map[string]struct{} {
	strip := make(map[string]struct{}, len(globals)+len(bundledDrop)+1+extraCapacity)
	for name := range bundledDrop {
		strip[name] = struct{}{}
	}

	for _, global := range globals {
		strip[global.Name] = struct{}{}
	}

	// A single migrations global cannot represent auth's and storage's distinct
	// least-privilege roles. Reject legacy user-provided copies as well.
	strip["MIGRATIONS_DATABASE_URL"] = struct{}{}

	return strip
}

func engineConditionallyAuthoritativeEnvName(name string) bool {
	if strings.HasPrefix(name, "AUTH_") {
		return true
	}

	switch name {
	case "CLAMAV_SERVER",
		"IMAGE_TRANSFORMER_MAX_BLUR_SIGMA",
		"IMAGE_TRANSFORMER_MAX_DIMENSION",
		"S3_ACCESS_KEY",
		"S3_SECRET_KEY":
		return true
	default:
		return false
	}
}

// engineAuthEnv builds hasura-auth's env with the graphql URL pinned to the
// standalone Hasura. Its runtime DB uses the shared engine global, while its
// migrations DB remains under auth's native environment variable.
func engineAuthEnv(
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

	authConfig := cfg.GetAuth()
	if err := validateEngineAuthConfig(authConfig); err != nil {
		return nil, fmt.Errorf("could not build hasura-auth env: %w", err)
	}

	authCfg := *cfg
	auth := *authConfig

	authResources := authConfig.GetResources()
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
		engineHasuraURL(input.HasuraURL, engineAuthHasuraPath),
		input.AuthServerURL,
		input.DatabaseURL,
		input.AuthMigrationsDatabaseURL,
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

// validateEngineAuthConfig guards the config paths HasuraAuthEnv
// dereferences without nil checks. Keep this validation local to the engine path
// so standalone hasura-auth retains its existing configuration contract.
func validateEngineAuthConfig(authConfig *model.ConfigAuth) error {
	if authConfig == nil {
		return errNhostEngineAuthConfigRequired
	}

	if authConfig.GetVersion() == nil {
		return errNhostEngineAuthVersionRequired
	}

	if authConfig.GetSession().GetAccessToken() == nil {
		return errNhostEngineAuthSessionAccessTokenRequired
	}

	if authConfig.GetUser().GetRoles().GetDefault() == nil {
		return errNhostEngineAuthUserRolesDefaultRequired
	}

	emailPassword := authConfig.GetMethod().GetEmailPassword()
	if emailPassword.GetHibpEnabled() == nil {
		return errNhostEngineAuthMethodEmailPasswordHIBPEnabledRequired
	}

	if emailPassword.GetPasswordMinLength() == nil {
		return errNhostEngineAuthMethodEmailPasswordMinLengthRequired
	}

	if authConfig.GetTotp().GetEnabled() == nil {
		return errNhostEngineAuthTotpEnabledRequired
	}

	if authConfig.GetMethod().GetEmailPasswordless().GetEnabled() == nil {
		return errNhostEngineAuthMethodEmailPasswordlessEnabledRequired
	}

	if emailPassword.GetEmailVerificationRequired() == nil {
		return errNhostEngineAuthMethodEmailVerificationRequired
	}

	return nil
}

// engineHasuraURL joins the caller-supplied hasura base URL with the path one
// bundled service needs. The base is validated by validateEngineHasuraURL
// before any of these are built.
func engineHasuraURL(base, path string) string {
	return strings.TrimSuffix(base, "/") + path
}

// validateEngineHasuraURL rejects bases that would produce unusable service
// URLs. A relative or scheme-less value is the likely mistake, and it fails at
// request time inside a bundled service rather than at config-build time.
func validateEngineHasuraURL(base string) error {
	trimmed := strings.TrimSuffix(base, "/")
	if trimmed == "" {
		return errNhostEngineHasuraURLRequired
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return fmt.Errorf("could not parse hasura URL %q: %w", base, err)
	}

	if parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("%w: %q", errNhostEngineHasuraURLNotAbsolute, base)
	}

	return nil
}

// engineStorageEnv builds hasura-storage's env with the Hasura endpoint
// pinned to the standalone Hasura. Its native migrations source is also its
// runtime PostgreSQL connection and uses storage's least-privilege role.
func engineStorageEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	env, err := HasuraStorageEnv(
		cfg,
		engineHasuraURL(input.HasuraURL, engineStorageHasuraPath),
		input.StorageDatabaseURL,
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

	for i := range env {
		if env[i].Name == envStoragePostgresMigrationsSource {
			// Storage's standalone secret key is databaseUrl, which would collide
			// with the shared Hasura-role DATABASE_URL in the engine Secret.
			env[i].SecretName = secretNhostEngineStorageDatabaseURL
		}
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

// engineConstellationEnv builds constellation's env, sourcing its settings
// from experimental.nhost.graphql (see engineGraphqlConfig).
func engineConstellationEnv(
	cfg *model.ConfigConfig,
	input NhostEngineEnvInput,
) ([]EnvVar, error) {
	env, err := ConstellationEnv(
		engineGraphqlConfig(cfg),
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

type engineFlagEnvContract struct {
	aliases []string
	strip   bool
}

type engineServiceEnvContract struct {
	flags      map[string]engineFlagEnvContract
	extraDrops []string
}

// engineNativeEnvContract associates each consolidated engine flag with
// its native service aliases. remapBundledEnv derives its production drop maps
// from this contract. Contract tests compare flag aliases with an engine-source
// manifest and verify extraDrops against standalone builder output.
func engineNativeEnvContract() map[string]engineServiceEnvContract {
	return map[string]engineServiceEnvContract{
		"auth": {
			flags: map[string]engineFlagEnvContract{
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
					aliases: []string{envAuthPostgresMigrationsConnection},
					strip:   false,
				},
			},
			extraDrops: []string{"AUTH_PORT", "AUTH_HOST"},
		},
		"storage": {
			flags: map[string]engineFlagEnvContract{
				"hasura-graphql-admin-secret": {
					aliases: []string{"HASURA_GRAPHQL_ADMIN_SECRET"},
					strip:   true,
				},
				"postgres-migrations-source": {
					aliases: []string{envStoragePostgresMigrationsSource},
					strip:   false,
				},
				"cors-allow-origins": {
					aliases: []string{envStorageCORSAllowOrigins},
					strip:   false,
				},
			},
			extraDrops: []string{"BIND"},
		},
		"graphql": {
			flags: map[string]engineFlagEnvContract{
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

func engineDropSets() map[string]map[string]struct{} {
	contracts := engineNativeEnvContract()
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
	drops := engineDropSets()
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

// engineGlobals returns the engine's shared globals plus the constellation
// Hasura-upstream pin, each emitted exactly once. graphqlDebug preserves the
// legacy experimental.nhost.graphql.settings.debug location; the promoted
// engine-wide field is authoritative whenever it is present, including when both
// locations are set.
func engineGlobals(
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
			Value:      engineHasuraURL(input.HasuraURL, engineConstellationHasuraPath),
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
			Name:       envEngineAuthCompatHosts,
			Value:      strings.Join(input.AuthCompatHosts, ","),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       envEngineMountPrefixHosts,
			Value:      strings.Join(input.MountPrefixHosts, ","),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       envEngineDisableAuth,
			Value:      strconv.FormatBool(input.DisableAuth),
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
	}
}

// engineGraphqlConfig returns a shallow copy of cfg whose
// experimental.constellation.settings mirror experimental.nhost.graphql.settings,
// so ConstellationEnv sources the legacy debug fallback plus the constellation-
// scoped devMode/pollInterval/corsAllowedOrigins settings from the engine's
// graphql config rather than the standalone constellation config (the two are
// mutually exclusive). Only Experimental is replaced; every other section is
// shared with cfg and left untouched.
func engineGraphqlConfig(cfg *model.ConfigConfig) *model.ConfigConfig {
	var settings *model.ConfigConstellationSettings
	if s := cfg.GetExperimental().GetNhost().GetGraphql().GetSettings(); s != nil {
		// This copy is exhaustive and MUST stay so: ConfigConstellationConfigSettings
		// and ConfigConstellationSettings are two Go structs generated from the same
		// CUE (#ConstellationConfig embedded in #Constellation), so a new
		// experimental.nhost.graphql.settings field compiles fine here yet would be
		// SILENTLY DROPPED on the engine path if not added below. When adding a
		// settings field, copy it here (and grant factorio SA perms for it, same as
		// other new nhost fields). TestEngineGraphqlSettingsNoSilentDrift guards
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
