package dockercompose //nolint:testpackage

import (
	"encoding/json"
	"errors"
	"maps"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

// engineTestConfig returns getConfig() with its root auth/storage sections
// mirrored into experimental.engine.settings, so engine() — which sources
// bundled-service config from those settings — reproduces the environment the
// standalone services would. graphql uses empty settings, exercising the
// constellation defaults.
func engineTestConfig() *model.ConfigConfig {
	cfg := getConfig()

	authSettings := &model.ConfigAuthSettings{}
	mirrorEngineSettings(cfg.Auth, authSettings)

	storageSettings := &model.ConfigStorageSettings{}
	mirrorEngineSettings(cfg.Storage, storageSettings)

	cfg.Experimental = &model.ConfigExperimental{
		Constellation: nil,
		Engine: &model.ConfigEngine{
			Version: new("0.0.1"),
			Settings: &model.ConfigEngineSettings{
				Auth:    authSettings,
				Storage: storageSettings,
				Graphql: &model.ConfigConstellationConfig{},
			},
		},
	}

	return cfg
}

// mirrorEngineSettings copies a root service config into its settings
// counterpart via a JSON round-trip (settings share field names minus
// version/resources), the inverse of engine.go's overlayEngineSettings.
func mirrorEngineSettings(src, dst any) {
	b, err := json.Marshal(src)
	if err != nil {
		panic(err)
	}

	if err := json.Unmarshal(b, dst); err != nil {
		panic(err)
	}
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

// engineModeConfig returns a config that opts into the bundled engine with auth
// and storage selected via experimental.engine.settings. It deliberately leaves
// settings.graphql unset to prove the constellation GraphQL engine runs by
// default with the engine, without an explicit opt-in.
func engineModeConfig() *model.ConfigConfig {
	// Settings are mirrored from the fully-defaulted root config: the appconfig
	// env builders assume a cue-defaulted service config (real `auth = {}` etc.
	// configs are defaulted by cue), so raw empty settings structs would panic.
	cfg := engineTestConfig()
	cfg.Hasura.Version = new("v2.25.0")
	cfg.Experimental.Engine.Settings.Graphql = nil

	return cfg
}

// TestGetServicesEngineMode locks in that experimental.engine runs a single
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
		t.Error("engine service should be present when experimental.engine is set")
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
// both experimental.engine and experimental.constellation is rejected.
func TestGetServicesEngineConstellationMutuallyExclusive(t *testing.T) {
	t.Parallel()

	cfg := engineModeConfig()
	cfg.Experimental.Constellation = &model.ConfigConstellation{
		Version:  new("0.1.0"),
		Settings: nil,
	}

	if _, err := runGetServices(t, cfg, "darwin"); !errors.Is(err, errEngineConstellationExclusive) {
		t.Errorf("getServices error = %v; want errEngineConstellationExclusive", err)
	}
}

// engineAuthEnv is hasura-auth's native environment as produced for the engine
// (subdomain "dev", httpPort 1336, useTLS true). It matches the standalone auth
// container's environment because the engine runs auth's own CLI, which reads
// these same variables.
func engineAuthEnv() map[string]string {
	return map[string]string{ //nolint:dupl // mirrors the standalone auth golden env
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS":        "asd@asd.com",
		"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS": "asd.com",
		"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS": "http://localhost:3000",
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS":        "qwe@wqe.com",
		"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS": "qwe.com",
		"AUTH_ACCESS_TOKEN_EXPIRES_IN":              "900",
		"AUTH_ANONYMOUS_USERS_ENABLED":              "true",
		"AUTH_API_PREFIX":                           "/v1",
		"AUTH_CLIENT_URL":                           "http://localhost:3000",
		"AUTH_CONCEAL_ERRORS":                       "true",
		"AUTH_DISABLE_AUTO_SIGNUP":                  "false",
		"AUTH_TURNSTILE_SECRET":                     "turnstileSecretKey",
		"AUTH_DISABLE_NEW_USERS":                    "false",
		"AUTH_DISABLE_SIGNUP":                       "false",
		"AUTH_EMAIL_PASSWORDLESS_ENABLED":           "true",
		"AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED": "true",
		"AUTH_ENCRYPTION_KEY":                       "5181f67e2844e4b60d571fa346cac9c37fc00d1ff519212eae6cead138e639ba",
		"AUTH_GRAVATAR_DEFAULT":                     "gravatarDefault",
		"AUTH_GRAVATAR_ENABLED":                     "true",
		"AUTH_GRAVATAR_RATING":                      "gravatarRating",
		"AUTH_HOST":                                 "0.0.0.0",
		"AUTH_JWT_CUSTOM_CLAIMS":                    `{"customClaimKey":"customClaimValue"}`,
		"AUTH_JWT_CUSTOM_CLAIMS_DEFAULTS":           `{}`,
		"AUTH_LOCALE_ALLOWED_LOCALES":               "en,se,ca,es",
		"AUTH_LOCALE_DEFAULT":                       "en",
		"AUTH_MFA_ENABLED":                          "true",
		"AUTH_MFA_TOTP_ISSUER":                      "totpIssuer",
		"AUTH_OTP_EMAIL_ENABLED":                    "true",
		"AUTH_PASSWORD_HIBP_ENABLED":                "true",
		"AUTH_PASSWORD_MIN_LENGTH":                  "12",
		"AUTH_PORT":                                 "4000",
		"AUTH_PROVIDER_APPLE_AUDIENCE":              "audience",
		"AUTH_PROVIDER_APPLE_CLIENT_ID":             "appleClientId",
		"AUTH_PROVIDER_APPLE_ENABLED":               "true",
		"AUTH_PROVIDER_APPLE_KEY_ID":                "appleKeyId",
		"AUTH_PROVIDER_APPLE_PRIVATE_KEY":           "applePrivateKey",
		"AUTH_PROVIDER_APPLE_SCOPE":                 "",
		"AUTH_PROVIDER_APPLE_TEAM_ID":               "appleTeamId",
		"AUTH_PROVIDER_AZUREAD_CLIENT_ID":           "azureadClientId",
		"AUTH_PROVIDER_AZUREAD_CLIENT_SECRET":       "azureadClientSecret",
		"AUTH_PROVIDER_AZUREAD_ENABLED":             "true",
		"AUTH_PROVIDER_AZUREAD_TENANT":              "azureadTenant",
		"AUTH_PROVIDER_BITBUCKET_CLIENT_ID":         "bitbucketClientId",
		"AUTH_PROVIDER_BITBUCKET_CLIENT_SECRET":     "bitbucketClientSecret",
		"AUTH_PROVIDER_BITBUCKET_ENABLED":           "true",
		"AUTH_PROVIDER_DISCORD_AUDIENCE":            "audience",
		"AUTH_PROVIDER_DISCORD_CLIENT_ID":           "discordClientId",
		"AUTH_PROVIDER_DISCORD_CLIENT_SECRET":       "discordClientSecret",
		"AUTH_PROVIDER_DISCORD_ENABLED":             "true",
		"AUTH_PROVIDER_DISCORD_SCOPE":               "identify,email",
		"AUTH_PROVIDER_ENTRAID_CLIENT_ID":           "entraidClientId",
		"AUTH_PROVIDER_ENTRAID_CLIENT_SECRET":       "entraidClientSecret",
		"AUTH_PROVIDER_ENTRAID_ENABLED":             "true",
		"AUTH_PROVIDER_ENTRAID_TENANT":              "entraidTenant",
		"AUTH_PROVIDER_FACEBOOK_AUDIENCE":           "audience",
		"AUTH_PROVIDER_FACEBOOK_CLIENT_ID":          "facebookClientId",
		"AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET":      "facebookClientSecret",
		"AUTH_PROVIDER_FACEBOOK_ENABLED":            "true",
		"AUTH_PROVIDER_FACEBOOK_SCOPE":              "email",
		"AUTH_PROVIDER_GITHUB_AUDIENCE":             "audience",
		"AUTH_PROVIDER_GITHUB_CLIENT_ID":            "githubClientId",
		"AUTH_PROVIDER_GITHUB_CLIENT_SECRET":        "githubClientSecret",
		"AUTH_PROVIDER_GITHUB_ENABLED":              "true",
		"AUTH_PROVIDER_GITHUB_SCOPE":                "user:email",
		"AUTH_PROVIDER_GITLAB_AUDIENCE":             "audience",
		"AUTH_PROVIDER_GITLAB_CLIENT_ID":            "gitlabClientId",
		"AUTH_PROVIDER_GITLAB_CLIENT_SECRET":        "gitlabClientSecret",
		"AUTH_PROVIDER_GITLAB_ENABLED":              "true",
		"AUTH_PROVIDER_GITLAB_SCOPE":                "read_user",
		"AUTH_PROVIDER_GOOGLE_AUDIENCE":             "audience",
		"AUTH_PROVIDER_GOOGLE_CLIENT_ID":            "googleClientId",
		"AUTH_PROVIDER_GOOGLE_CLIENT_SECRET":        "googleClientSecret",
		"AUTH_PROVIDER_GOOGLE_ENABLED":              "true",
		"AUTH_PROVIDER_GOOGLE_SCOPE":                "openid,profile,email",
		"AUTH_PROVIDER_LINKEDIN_AUDIENCE":           "audience",
		"AUTH_PROVIDER_LINKEDIN_CLIENT_ID":          "linkedinClientId",
		"AUTH_PROVIDER_LINKEDIN_CLIENT_SECRET":      "linkedinClientSecret",
		"AUTH_PROVIDER_LINKEDIN_ENABLED":            "true",
		"AUTH_PROVIDER_LINKEDIN_SCOPE":              "r_liteprofile,r_emailaddress",
		"AUTH_PROVIDER_SPOTIFY_AUDIENCE":            "audience",
		"AUTH_PROVIDER_SPOTIFY_CLIENT_ID":           "spotifyClientId",
		"AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET":       "spotifyClientSecret",
		"AUTH_PROVIDER_SPOTIFY_ENABLED":             "true",
		"AUTH_PROVIDER_SPOTIFY_SCOPE":               "user-read-email",
		"AUTH_PROVIDER_STRAVA_AUDIENCE":             "audience",
		"AUTH_PROVIDER_STRAVA_CLIENT_ID":            "stravaClientId",
		"AUTH_PROVIDER_STRAVA_CLIENT_SECRET":        "stravaClientSecret",
		"AUTH_PROVIDER_STRAVA_ENABLED":              "true",
		"AUTH_PROVIDER_STRAVA_SCOPE":                "read_all",
		"AUTH_PROVIDER_TWITCH_AUDIENCE":             "audience",
		"AUTH_PROVIDER_TWITCH_CLIENT_ID":            "twitchClientId",
		"AUTH_PROVIDER_TWITCH_CLIENT_SECRET":        "twitchClientSecret",
		"AUTH_PROVIDER_TWITCH_ENABLED":              "true",
		"AUTH_PROVIDER_TWITCH_SCOPE":                "user:email",
		"AUTH_PROVIDER_TWITTER_CONSUMER_KEY":        "twitterConsumerKey",
		"AUTH_PROVIDER_TWITTER_CONSUMER_SECRET":     "twitterConsumerSecret",
		"AUTH_PROVIDER_TWITTER_ENABLED":             "true",
		"AUTH_PROVIDER_WINDOWS_LIVE_AUDIENCE":       "audience",
		"AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID":      "windowsliveClientId",
		"AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET":  "windowsliveClientSecret",
		"AUTH_PROVIDER_WINDOWS_LIVE_ENABLED":        "true",
		"AUTH_PROVIDER_WINDOWS_LIVE_SCOPE":          "wl.emails",
		"AUTH_PROVIDER_WORKOS_CLIENT_ID":            "workosClientId",
		"AUTH_PROVIDER_WORKOS_CLIENT_SECRET":        "workosClientSecret",
		"AUTH_PROVIDER_WORKOS_DEFAULT_CONNECTION":   "workosConnection",
		"AUTH_PROVIDER_WORKOS_DEFAULT_ORGANIZATION": "workosOrganization",
		"AUTH_PROVIDER_WORKOS_ENABLED":              "true",
		"AUTH_RATE_LIMIT_BRUTE_FORCE_BURST":         "3",
		"AUTH_RATE_LIMIT_BRUTE_FORCE_INTERVAL":      "5m",
		"AUTH_RATE_LIMIT_EMAIL_BURST":               "3",
		"AUTH_RATE_LIMIT_EMAIL_INTERVAL":            "5m",
		"AUTH_RATE_LIMIT_EMAIL_IS_GLOBAL":           "true",
		"AUTH_RATE_LIMIT_ENABLE":                    "true",
		"AUTH_RATE_LIMIT_GLOBAL_BURST":              "33",
		"AUTH_RATE_LIMIT_GLOBAL_INTERVAL":           "15m",
		"AUTH_OAUTH2_PROVIDER_ACCESS_TOKEN_TTL":     "900",
		"AUTH_OAUTH2_PROVIDER_CIMD_ENABLED":         "true",
		"AUTH_OAUTH2_PROVIDER_ENABLED":              "true",
		"AUTH_OAUTH2_PROVIDER_LOGIN_URL":            "https://example.com/oauth2/login",
		"AUTH_OAUTH2_PROVIDER_REFRESH_TOKEN_TTL":    "2592000",
		"AUTH_RATE_LIMIT_OAUTH2_SERVER_BURST":       "33",
		"AUTH_RATE_LIMIT_OAUTH2_SERVER_INTERVAL":    "5m",
		"AUTH_RATE_LIMIT_SIGNUPS_BURST":             "3",
		"AUTH_RATE_LIMIT_SIGNUPS_INTERVAL":          "5m",
		"AUTH_RATE_LIMIT_SMS_BURST":                 "3",
		"AUTH_RATE_LIMIT_SMS_INTERVAL":              "5m",
		"AUTH_REFRESH_TOKEN_EXPIRES_IN":             "99",
		"AUTH_REQUIRE_ELEVATED_CLAIM":               "required",
		"AUTH_SERVER_URL":                           "https://dev.auth.local.nhost.run:1336/v1",
		"AUTH_SMS_PASSWORDLESS_ENABLED":             "true",
		"AUTH_SMS_PROVIDER":                         "twilio",
		"AUTH_SMS_TWILIO_ACCOUNT_SID":               "smsAccountSid",
		"AUTH_SMS_TWILIO_AUTH_TOKEN":                "smsAuthToken",
		"AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID":      "smsMessagingServiceId",
		"AUTH_SMTP_AUTH_METHOD":                     "LOGIN",
		"AUTH_SMTP_HOST":                            "mailhog",
		"AUTH_SMTP_PASS":                            "password",
		"AUTH_SMTP_PORT":                            "1025",
		"AUTH_SMTP_SECURE":                          "false",
		"AUTH_SMTP_SENDER":                          "auth@example.com",
		"AUTH_SMTP_USER":                            "user",
		"AUTH_USER_DEFAULT_ALLOWED_ROLES":           "user,admin",
		"AUTH_USER_DEFAULT_ROLE":                    "user",
		"AUTH_WEBAUTHN_ATTESTATION_TIMEOUT":         "60000",
		"AUTH_WEBAUTHN_ENABLED":                     "true",
		"AUTH_WEBAUTHN_RP_ID":                       "webauthnRelyingPartyId",
		"AUTH_WEBAUTHN_RP_NAME":                     "webauthnRelyingPartyName",
		"AUTH_WEBAUTHN_RP_ORIGINS":                  "http://localhost:3000",
		"ENV1":                                      "VALUE1",
		"ENV2":                                      "VALUE2",
		"HASURA_GRAPHQL_ADMIN_SECRET":               "adminSecret",
		"HASURA_GRAPHQL_DATABASE_URL":               "postgres://nhost_hasura@postgres:5432/local",
		"POSTGRES_MIGRATIONS_CONNECTION":            "postgres://nhost_auth_admin@postgres:5432/local",
		"HASURA_GRAPHQL_GRAPHQL_URL":                "http://graphql:8080/v1/graphql",
		"HASURA_GRAPHQL_JWT_SECRET":                 `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}`,
	}
}

// engineStorageEnv is hasura-storage's native environment as produced for the
// engine (subdomain "dev", httpPort 1336, useTLS true), with BIND pointed at
// the shared engine listener rather than storage's own port.
func engineStorageEnv() map[string]string {
	return map[string]string{
		"BIND":                        ":8080",
		"HASURA_ENDPOINT":             "http://graphql:8080/v1",
		"HASURA_GRAPHQL_ADMIN_SECRET": "adminSecret",
		"HASURA_METADATA":             "1",
		"POSTGRES_MIGRATIONS":         "1",
		"POSTGRES_MIGRATIONS_SOURCE":  "postgres://nhost_storage_admin@postgres:5432/local?sslmode=disable",
		"PUBLIC_URL":                  "https://dev.storage.local.nhost.run:1336",
		"S3_ACCESS_KEY":               "minioaccesskey123123",
		"S3_BUCKET":                   "nhost",
		"S3_ENDPOINT":                 "http://minio:9000",
		"S3_REGION":                   "",
		"S3_ROOT_FOLDER":              "",
		"S3_SECRET_KEY":               "minioaccesskey123123",
		"CLAMAV_SERVER":               "tcp://run-clamav:3310",
	}
}

// engineConstellationEnv is constellation's native environment as produced for
// the engine (subdomain "dev", httpPort 1336, useTLS true), plus the
// engine-pinned metadata path. HASURA_GRAPHQL_DATABASE_URL is included as
// constellation emits it (postgres superuser), but auth overrides it in the
// merged result.
func engineConstellationEnv() map[string]string {
	return map[string]string{
		"CONSTELLATION_ADMIN_SECRET":               "adminSecret",
		"CONSTELLATION_CORS_ALLOWED_ORIGINS":       "https://dev.dashboard.local.nhost.run:1336,http://localhost:3000",
		"CONSTELLATION_DEBUG":                      "false",
		"CONSTELLATION_DEV_MODE":                   "false",
		"CONSTELLATION_JWT_SECRET":                 constellationJWTSecret,
		"CONSTELLATION_METADATA_DATABASE_URL":      "postgres://postgres:postgres@postgres:5432/local",
		"CONSTELLATION_METADATA_PATH":              "/metadata/metadata.yaml",
		"CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL": "1s",
		"GRAPHITE_WEBHOOK_SECRET":                  "webhookSecret",
		"HASURA_GRAPHQL_DATABASE_URL":              "postgres://postgres:postgres@postgres:5432/local",
		"NHOST_ADMIN_SECRET":                       "adminSecret",
		"NHOST_AUTH_URL":                           "https://dev.auth.local.nhost.run:1336/v1",
		"NHOST_FUNCTIONS_URL":                      "http://functions:3000",
		"NHOST_GRAPHQL_DATABASE_URL":               "postgres://postgres:postgres@postgres:5432/local",
		"NHOST_GRAPHQL_URL":                        "https://dev.graphql.local.nhost.run:1336/v1",
		"NHOST_JWT_SECRET":                         constellationJWTSecret,
		"NHOST_REGION":                             "local",
		"NHOST_STORAGE_URL":                        "https://dev.storage.local.nhost.run:1336/v1",
		"NHOST_SUBDOMAIN":                          "dev",
		"NHOST_WEBHOOK_SECRET":                     "webhookSecret",
	}
}

func engineLabels(withAuth, withStorage, withGraphql bool) map[string]string {
	labels := map[string]string{
		"traefik.enable": "true",
		"traefik.http.routers.engine.entrypoints":               "web",
		"traefik.http.routers.engine.rule":                      "(HostRegexp(`^.+\\.engine\\.local\\.nhost\\.run$`) || Host(`local.engine.nhost.run`))",
		"traefik.http.routers.engine.service":                   "engine",
		"traefik.http.routers.engine.tls":                       "true",
		"traefik.http.services.engine.loadbalancer.server.port": "8080",
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

func expectedEngine() *Service {
	env := engineStorageEnv()
	maps.Copy(env, engineAuthEnv())

	return &Service{
		Image:   "nhost/nhost-engine:0.0.1",
		Command: []string{"serve", "--disable-graphql"},
		DependsOn: map[string]DependsOn{
			"graphql":  {Condition: "service_healthy"},
			"minio":    {Condition: "service_started"},
			"postgres": {Condition: "service_healthy"},
		},
		EntryPoint:  nil,
		Environment: env,
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
				svc.Environment = engineStorageEnv()
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

				env := engineConstellationEnv()
				maps.Copy(env, engineAuthEnv())
				env["BIND"] = ":8080"
				svc.Environment = env

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
			name:          "auth, storage and constellation",
			cfg:           engineTestConfig,
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   true,
			withGraphql:   true,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Command = []string{"serve"}

				env := engineStorageEnv()
				maps.Copy(env, engineConstellationEnv())
				maps.Copy(env, engineAuthEnv())
				svc.Environment = env

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

				return svc
			},
		},
		{
			name: "pinned engine version",
			cfg: func() *model.ConfigConfig {
				cfg := engineTestConfig()
				cfg.Experimental.Engine.Version = new("1.2.3")

				return cfg
			},
			authExpose:    0,
			storageExpose: 0,
			withAuth:      true,
			withStorage:   true,
			withGraphql:   false,
			expected: func() *Service {
				svc := expectedEngine()
				svc.Image = "nhost/nhost-engine:1.2.3"

				return svc
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := engine(
				tc.cfg(), "dev", true, 1336, "/tmp/nhost",
				tc.authExpose, tc.storageExpose,
				tc.withAuth, tc.withStorage, tc.withGraphql, "darwin",
			)
			if err != nil {
				t.Errorf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
