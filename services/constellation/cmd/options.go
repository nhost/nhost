package cmd

import (
	"errors"
	"fmt"
	"time"

	"github.com/urfave/cli/v3"
)

var (
	errAdminSecretRequired = errors.New("AdminSecret is required")
	errJWTSecretRequired   = errors.New("JWTSecret is required")
	errMetadataRequired    = errors.New(
		"MetadataPath or MetadataDatabaseURL is required",
	)
	errPollIntervalNotPositive = errors.New(
		"SubscriptionPollInterval must be greater than 0",
	)
	errGraphQLBodyLimitNotPositive = errors.New(
		"GraphQLRequestBodyLimitBytes must be greater than 0",
	)
	errProxyBodyLimitNegative = errors.New(
		"HasuraProxyRequestBodyLimitBytes must be >= 0 (0 disables the limit)",
	)
)

// Options is everything NewService needs to build constellation. It carries no
// listener settings: whoever runs the service owns the listener, so the bind
// address and HTTP timeouts stay with the standalone serve command or the
// engine.
type Options struct {
	// Version is reported by the version endpoint.
	Version string

	// AdminSecret authorizes admin requests.
	AdminSecret string
	// JWTSecret is a JSON JWT secret, or a JSON array of them.
	JWTSecret string

	// MetadataDatabaseURL, when set, reads Hasura metadata from PostgreSQL;
	// otherwise it is read from the file at MetadataPath.
	MetadataDatabaseURL string
	MetadataPath        string

	// SubscriptionPollInterval is how often subscriptions re-run their query.
	SubscriptionPollInterval time.Duration
	// GraphQLRequestBodyLimitBytes caps the JSON body of a GraphQL POST.
	GraphQLRequestBodyLimitBytes int64

	// CORSAllowedOrigins may contain "*" wildcards. Empty denies every
	// cross-origin request.
	CORSAllowedOrigins []string

	// HasuraUpstreamURL is the Hasura instance that routes constellation does
	// not serve natively are proxied to. Empty disables the proxy, so those
	// routes return 404.
	HasuraUpstreamURL string
	// HasuraProxyRequestBodyLimitBytes caps the body forwarded to the Hasura
	// upstream. 0 disables the cap.
	HasuraProxyRequestBodyLimitBytes int64

	// EnablePlayground serves the GraphQL playground at /, which sends its
	// queries and subscriptions to PlaygroundGraphQLEndpoint.
	EnablePlayground          bool
	PlaygroundGraphQLEndpoint string
	// DevMode returns raw connector and database errors to clients. It leaks
	// schema and data, so it is for development only.
	DevMode bool
}

// Validate reports the settings NewService would reject before parsing or
// connecting to anything, so a caller running several services can check all
// of them before building any. A malformed JWTSecret or HasuraUpstreamURL, and
// an unreachable metadata database, are still only reported by NewService.
func (o Options) Validate() error {
	var errs []error

	if o.AdminSecret == "" {
		errs = append(errs, errAdminSecretRequired)
	}

	if o.JWTSecret == "" {
		errs = append(errs, errJWTSecretRequired)
	}

	if o.MetadataDatabaseURL == "" && o.MetadataPath == "" {
		errs = append(errs, errMetadataRequired)
	}

	if o.SubscriptionPollInterval <= 0 {
		errs = append(errs, errPollIntervalNotPositive)
	}

	if o.GraphQLRequestBodyLimitBytes <= 0 {
		errs = append(errs, errGraphQLBodyLimitNotPositive)
	}

	if o.HasuraProxyRequestBodyLimitBytes < 0 {
		errs = append(errs, fmt.Errorf(
			"%w, got %d", errProxyBodyLimitNegative, o.HasuraProxyRequestBodyLimitBytes,
		))
	}

	if _, err := corsOptions(o.CORSAllowedOrigins); err != nil {
		errs = append(errs, err)
	}

	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("invalid constellation options: %w", err)
	}

	return nil
}

// OptionsFromCommand maps the serve command's flags onto Options. It does not
// validate; NewService does. The standalone serve command and the engine both
// use it, so a service's flags, env vars and defaults resolve the same way in
// either.
func OptionsFromCommand(cmd *cli.Command) Options {
	return Options{
		Version:                          cmd.Root().Version,
		AdminSecret:                      cmd.String(flagAdminSecret),
		JWTSecret:                        cmd.String(flagJWTSecret),
		MetadataDatabaseURL:              cmd.String(flagMetadataDatabaseURL),
		MetadataPath:                     cmd.String(flagMetadataPath),
		SubscriptionPollInterval:         cmd.Duration(flagSubscriptionPollInterval),
		GraphQLRequestBodyLimitBytes:     cmd.Int64(flagGraphQLRequestBodyLimitBytes),
		CORSAllowedOrigins:               cmd.StringSlice(flagCORSAllowedOrigins),
		HasuraUpstreamURL:                cmd.String(flagHasuraUpstreamURL),
		HasuraProxyRequestBodyLimitBytes: cmd.Int64(flagHasuraProxyRequestBodyLimitBytes),
		EnablePlayground:                 cmd.Bool(flagEnablePlayground),
		PlaygroundGraphQLEndpoint:        cmd.String(flagPlaygroundGraphQLEndpoint),
		DevMode:                          cmd.Bool(flagDevMode),
	}
}
