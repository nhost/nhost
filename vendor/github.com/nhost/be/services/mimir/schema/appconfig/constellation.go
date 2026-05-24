package appconfig

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/nhost/be/services/mimir/model"
)

const (
	secretConstellationAdminSecret    = "adminSecret"
	secretConstellationWebhookSecret  = "webhookSecret"
	secretConstellationJWTSecret      = "jwtSecret"
	secretConstellationDatabaseURL    = "databaseUrl"
	secretConstellationGraphiteSecret = "graphiteWebhookSecret"
)

var errURLMissingSchemeOrHost = errors.New("url is missing scheme or host")

// corsOriginFromURL extracts the scheme+host CORS origin from rawURL. It
// returns ("", nil) when the URL uses a scheme other than http/https (e.g.
// custom mobile redirect schemes like myapp://callback) so callers can skip
// the entry without erroring — browsers ignore non-http(s) Origin headers
// anyway, so propagating them into CONSTELLATION_CORS_ALLOWED_ORIGINS is useless.
func corsOriginFromURL(rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse url %q: %w", rawURL, err)
	}

	if u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("%w: %q", errURLMissingSchemeOrHost, rawURL)
	}

	if u.Scheme != schemeHTTP && u.Scheme != schemeHTTPS {
		return "", nil
	}

	return u.Scheme + "://" + u.Host, nil
}

type corsOriginCollector struct {
	seen    map[string]struct{}
	origins []string
}

func newCORSOriginCollector() *corsOriginCollector {
	return &corsOriginCollector{
		seen:    make(map[string]struct{}),
		origins: make([]string, 0),
	}
}

func (c *corsOriginCollector) add(rawURL string) error {
	origin, err := corsOriginFromURL(rawURL)
	if err != nil {
		return err
	}

	if origin == "" {
		return nil
	}

	if _, ok := c.seen[origin]; ok {
		return nil
	}

	c.seen[origin] = struct{}{}
	c.origins = append(c.origins, origin)

	return nil
}

func (c *corsOriginCollector) addAll(urls []string) error {
	for _, u := range urls {
		if u == "" {
			continue
		}

		if err := c.add(u); err != nil {
			return err
		}
	}

	return nil
}

func (c *corsOriginCollector) join() string {
	return strings.Join(c.origins, ",")
}

const constellationDefaultSubscriptionPollInterval = "1s"

type constellationRuntimeSettings struct {
	debug                    bool
	devMode                  bool
	subscriptionPollInterval string
}

func constellationSettings(cfg *model.ConfigConfig) constellationRuntimeSettings {
	settings := cfg.GetExperimental().GetConstellation().GetSettings()

	out := constellationRuntimeSettings{
		debug:                    false,
		devMode:                  false,
		subscriptionPollInterval: constellationDefaultSubscriptionPollInterval,
	}

	if v := settings.GetDebug(); v != nil {
		out.debug = *v
	}

	if v := settings.GetDevMode(); v != nil {
		out.devMode = *v
	}

	if v := settings.GetSubscriptionPollInterval(); v != nil && *v != "" {
		out.subscriptionPollInterval = *v
	}

	return out
}

func constellationCORSOrigins(cfg *model.ConfigConfig, dashboardOrigin string) (string, error) {
	collector := newCORSOriginCollector()

	// The dashboard origin is added in every case so that the Nhost dashboard
	// can issue requests to constellation regardless of what the user has
	// configured in settings.corsAllowedOrigins or auth.redirections.
	if dashboardOrigin != "" {
		if err := collector.add(dashboardOrigin); err != nil {
			return "", err
		}
	}

	settings := cfg.GetExperimental().GetConstellation().GetSettings()
	if settings != nil && settings.GetCorsAllowedOrigins() != nil {
		if err := collector.addAll(settings.GetCorsAllowedOrigins()); err != nil {
			return "", err
		}

		return collector.join(), nil
	}

	redirections := cfg.GetAuth().GetRedirections()
	if redirections == nil {
		return collector.join(), nil
	}

	if clientURL := redirections.GetClientUrl(); clientURL != nil && *clientURL != "" {
		if err := collector.add(*clientURL); err != nil {
			return "", err
		}
	}

	if err := collector.addAll(redirections.GetAllowedUrls()); err != nil {
		return "", err
	}

	return collector.join(), nil
}

func constellationBaseEnv( //nolint:funlen
	cfg *model.ConfigConfig,
	jwtSecret []byte,
	postgresConnection,
	nhostAuthURL,
	nhostGraphqlURL,
	nhostStorageURL,
	nhostFunctionsURL,
	subdomain,
	region,
	corsAllowedOrigins string,
	settings constellationRuntimeSettings,
) []EnvVar {
	return []EnvVar{
		{
			Name:       "NHOST_GRAPHQL_DATABASE_URL",
			Value:      postgresConnection,
			SecretName: secretConstellationDatabaseURL,
			IsSecret:   true,
		},
		{
			Name:       "HASURA_GRAPHQL_DATABASE_URL",
			Value:      postgresConnection,
			SecretName: secretConstellationDatabaseURL,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_FUNCTIONS_URL",
			Value:      nhostFunctionsURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_AUTH_URL",
			Value:      nhostAuthURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_GRAPHQL_URL",
			Value:      nhostGraphqlURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_STORAGE_URL",
			Value:      nhostStorageURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_ADMIN_SECRET",
			Value:      cfg.GetHasura().GetAdminSecret(),
			SecretName: secretConstellationAdminSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_WEBHOOK_SECRET",
			Value:      cfg.GetHasura().GetWebhookSecret(),
			SecretName: secretConstellationWebhookSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_JWT_SECRET",
			Value:      string(jwtSecret),
			SecretName: secretConstellationJWTSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_REGION",
			Value:      region,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_SUBDOMAIN",
			Value:      subdomain,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "GRAPHITE_WEBHOOK_SECRET",
			Value:      cfg.GetAi().GetWebhookSecret(),
			SecretName: secretConstellationGraphiteSecret,
			IsSecret:   true,
		},
		{
			Name:       "CONSTELLATION_ADMIN_SECRET",
			Value:      cfg.GetHasura().GetAdminSecret(),
			SecretName: secretConstellationAdminSecret,
			IsSecret:   true,
		},
		{
			Name:       "CONSTELLATION_JWT_SECRET",
			Value:      string(jwtSecret),
			SecretName: secretConstellationJWTSecret,
			IsSecret:   true,
		},
		{
			Name:       "CONSTELLATION_METADATA_DATABASE_URL",
			Value:      postgresConnection,
			SecretName: secretConstellationDatabaseURL,
			IsSecret:   true,
		},
		{
			Name:       "CONSTELLATION_CORS_ALLOWED_ORIGINS",
			Value:      corsAllowedOrigins,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "CONSTELLATION_DEBUG",
			Value:      strconv.FormatBool(settings.debug),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "CONSTELLATION_DEV_MODE",
			Value:      strconv.FormatBool(settings.devMode),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL",
			Value:      settings.subscriptionPollInterval,
			IsSecret:   false,
			SecretName: "",
		},
	}
}

func ConstellationEnv(
	cfg *model.ConfigConfig,
	postgresConnection,
	nhostAuthURL,
	nhostGraphqlURL,
	nhostStorageURL,
	nhostFunctionsURL,
	subdomain,
	region,
	dashboardOrigin string,
) ([]EnvVar, error) {
	jwtSecret, err := marshalJWT(cfg.GetHasura().GetJwtSecrets()[0], false)
	if err != nil {
		return nil, fmt.Errorf("could not marshal JWT secret: %w", err)
	}

	corsAllowedOrigins, err := constellationCORSOrigins(cfg, dashboardOrigin)
	if err != nil {
		return nil, err
	}

	env := constellationBaseEnv(
		cfg,
		jwtSecret,
		postgresConnection,
		nhostAuthURL,
		nhostGraphqlURL,
		nhostStorageURL,
		nhostFunctionsURL,
		subdomain,
		region,
		corsAllowedOrigins,
		constellationSettings(cfg),
	)

	for _, e := range cfg.GetGlobal().GetEnvironment() {
		env = append(env, EnvVar{
			Name:       e.Name,
			Value:      e.Value,
			IsSecret:   false,
			SecretName: "",
		})
	}

	return env, nil
}
