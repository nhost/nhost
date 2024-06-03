package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/hibp"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	"github.com/urfave/cli/v2"
)

const (
	flagAPIPrefix                        = "api-prefix"
	flagPort                             = "port"
	flagDebug                            = "debug"
	flagLogFormatTEXT                    = "log-format-text"
	flagTrustedProxies                   = "trusted-proxies"
	flagPostgresConnection               = "postgres"
	flagPostgresMigrationsConnection     = "postgres-migrations"
	flagNodeServerPath                   = "node-server-path"
	flagDisableSignup                    = "disable-signup"
	flagConcealErrors                    = "conceal-errors"
	flagDefaultAllowedRoles              = "default-allowed-roles"
	flagDefaultRole                      = "default-role"
	flagDefaultLocale                    = "default-locale"
	flagAllowedLocales                   = "allowed-locales"
	flagDisableNewUsers                  = "disable-new-users"
	flagGravatarEnabled                  = "gravatar-enabled"
	flagGravatarDefault                  = "gravatar-default"
	flagGravatarRating                   = "gravatar-rating"
	flagRefreshTokenExpiresIn            = "refresh-token-expires-in"
	flagAccessTokensExpiresIn            = "access-tokens-expires-in"
	flagHasuraGraphqlJWTSecret           = "hasura-graphql-jwt-secret" //nolint:gosec
	flagEmailSigninEmailVerifiedRequired = "email-verification-required"
	flagSMTPHost                         = "smtp-host"
	flagSMTPPort                         = "smtp-port"
	flagSMTPSecure                       = "smtp-secure"
	flagSMTPUser                         = "smtp-user"
	flagSMTPPassword                     = "smtp-password"
	flagSMTPSender                       = "smtp-sender"
	flagSMTPAPIHedaer                    = "smtp-api-header"
	flagSMTPAuthMethod                   = "smtp-auth-method"
	flagClientURL                        = "client-url"
	flagServerURL                        = "server-url"
	flagAllowRedirectURLs                = "allow-redirect-urls"
	flagEnableChangeEnv                  = "enable-change-env"
	flagCustomClaims                     = "custom-claims"
	flagGraphqlURL                       = "graphql-url"
	flagHasuraAdminSecret                = "hasura-admin-secret" //nolint:gosec
	flagPasswordMinLength                = "password-min-length"
	flagPasswordHIBPEnabled              = "password-hibp-enabled"
	flagEmailTemplatesPath               = "templates-path"
	flagBlockedEmailDomains              = "block-email-domains"
	flagBlockedEmails                    = "block-emails"
	flagAllowedEmailDomains              = "allowed-email-domains"
	flagAllowedEmails                    = "allowed-emails"
	flagEmailPasswordlessEnabled         = "email-passwordless-enabled"
	flagRequireElevatedClaim             = "require-elevated-claim"
	flagWebauthnEnabled                  = "webauthn-enabled"
	flagWebauhtnRPName                   = "webauthn-rp-name"
	flagWebauthnRPID                     = "webauthn-rp-id"
	flagWebauthnRPOrigins                = "webauthn-rp-origins"
	flagWebauthnAttestationTimeout       = "webauthn-attestation-timeout"
)

func CommandServe() *cli.Command { //nolint:funlen,maintidx
	return &cli.Command{ //nolint: exhaustruct
		Name:  "serve",
		Usage: "Serve the application",
		//nolint:lll
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagAPIPrefix,
				Usage:    "prefix for all routes",
				Value:    "/",
				Category: "server",
				EnvVars:  []string{"AUTH_API_PREFIX"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPort,
				Usage:    "Port to bind to",
				Value:    "4000",
				Category: "server",
				EnvVars:  []string{"AUTH_PORT"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagDebug,
				Usage:    "enable debug logging",
				Category: "general",
				EnvVars:  []string{"AUTH_DEBUG"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagLogFormatTEXT,
				Usage:    "format logs in plain text",
				Category: "general",
				EnvVars:  []string{"AUTH_LOG_FORMAT_TEXT"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPostgresConnection,
				Usage:    "PostgreSQL connection URI: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
				Value:    "postgres://postgres:postgres@localhost:5432/local?sslmode=disable",
				Category: "postgres",
				EnvVars:  []string{"POSTGRES_CONNECTION", "HASURA_GRAPHQL_DATABASE_URL"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPostgresMigrationsConnection,
				Usage:    "PostgreSQL connection URI for running migrations: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING. Required to inject the `auth` schema into the database. If not specied, the `postgres connection will be used",
				Category: "postgres",
				EnvVars:  []string{"POSTGRES_MIGRATIONS_CONNECTION"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagNodeServerPath,
				Usage:    "Path to the node server",
				Value:    ".",
				Category: "node",
				EnvVars:  []string{"AUTH_NODE_SERVER_PATH"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagDisableSignup,
				Usage:    "If set to true, all signup methods will throw an unauthorized error",
				Value:    false,
				Category: "signup",
				EnvVars:  []string{"AUTH_DISABLE_SIGNUP"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagConcealErrors,
				Usage:    "Conceal sensitive error messages to avoid leaking information about user accounts to attackers",
				Value:    false,
				Category: "server",
				EnvVars:  []string{"AUTH_CONCEAL_ERRORS"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagDefaultAllowedRoles,
				Usage:    "Comma-separated list of default allowed user roles",
				Category: "signup",
				Value:    cli.NewStringSlice("me"),
				EnvVars:  []string{"AUTH_USER_DEFAULT_ALLOWED_ROLES"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagDefaultRole,
				Usage:    "Default user role for registered users",
				Category: "signup",
				Value:    "user",
				EnvVars:  []string{"AUTH_USER_DEFAULT_ROLE"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagDefaultLocale,
				Usage:    "Default locale",
				Category: "signup",
				Value:    "en",
				EnvVars:  []string{"AUTH_LOCALE_DEFAULT"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagAllowedLocales,
				Usage:    "Allowed locales",
				Category: "signup",
				Value:    cli.NewStringSlice("en"),
				EnvVars:  []string{"AUTH_LOCALE_ALLOWED_LOCALES"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagDisableNewUsers,
				Usage:    "If set, new users will be disabled after finishing registration and won't be able to sign in",
				Category: "signup",
				EnvVars:  []string{"AUTH_DISABLE_NEW_USERS"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagGravatarEnabled,
				Usage:    "Enable gravatar",
				Category: "signup",
				Value:    true,
				EnvVars:  []string{"AUTH_GRAVATAR_ENABLED"},
			},
			&cli.GenericFlag{ //nolint: exhaustruct
				Name: flagGravatarDefault,
				Value: &EnumValue{ //nolint: exhaustruct
					Enum: []string{
						"blank",
						"identicon",
						"monsterid",
						"wavatar",
						"retro",
						"robohash",
						"mp",
						"404",
					},
					Default: "blank",
				},
				Usage:    "Gravatar default",
				Category: "signup",
				EnvVars:  []string{"AUTH_GRAVATAR_DEFAULT"},
			},
			&cli.GenericFlag{ //nolint: exhaustruct
				Name: flagGravatarRating,
				Value: &EnumValue{ //nolint: exhaustruct
					Enum: []string{
						"g",
						"pg",
						"r",
						"x",
					},
					Default: "g",
				},
				Usage:    "Gravatar rating",
				Category: "signup",
				EnvVars:  []string{"AUTH_GRAVATAR_RATING"},
			},
			&cli.IntFlag{ //nolint: exhaustruct
				Name:     flagRefreshTokenExpiresIn,
				Usage:    "Refresh token expires in (seconds)",
				Value:    2592000, //nolint:mnd
				Category: "jwt",
				EnvVars:  []string{"AUTH_REFRESH_TOKEN_EXPIRES_IN"},
			},
			&cli.IntFlag{ //nolint: exhaustruct
				Name:     flagAccessTokensExpiresIn,
				Usage:    "Access tokens expires in (seconds)",
				Value:    900, //nolint:mnd
				Category: "jwt",
				EnvVars:  []string{"AUTH_ACCESS_TOKEN_EXPIRES_IN"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagHasuraGraphqlJWTSecret,
				Usage:    "Key used for generating JWTs. Must be `HMAC-SHA`-based and the same as configured in Hasura. More info: https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt.html#running-with-jwt",
				Required: true,
				Category: "jwt",
				EnvVars:  []string{"HASURA_GRAPHQL_JWT_SECRET"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagEmailSigninEmailVerifiedRequired,
				Usage:    "Require email to be verified for email signin",
				Category: "signup",
				Value:    true,
				EnvVars:  []string{"AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagSMTPHost,
				Usage:    "SMTP Host. If the host is 'postmark' then the Postmark API will be used. Use AUTH_SMTP_PASS as the server token, other SMTP options are ignored",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_HOST"},
			},
			&cli.UintFlag{ //nolint: exhaustruct
				Name:     flagSMTPPort,
				Usage:    "SMTP port",
				Category: "smtp",
				Value:    587, //nolint:mnd
				EnvVars:  []string{"AUTH_SMTP_PORT"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagSMTPSecure,
				Usage:    "Connect over TLS. Deprecated: It is recommended to use port 587 with STARTTLS instead of this option.",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_SECURE"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagSMTPUser,
				Usage:    "SMTP user",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_USER"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagSMTPPassword,
				Usage:    "SMTP password",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_PASS"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagSMTPSender,
				Usage:    "SMTP sender",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_SENDER"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagSMTPAPIHedaer,
				Usage:    "SMTP API Header. Maps to header X-SMTPAPI",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_X_SMTPAPI_HEADER"},
			},
			&cli.GenericFlag{ //nolint: exhaustruct
				Name: flagSMTPAuthMethod,
				Value: &EnumValue{ //nolint: exhaustruct
					Enum: []string{
						"LOGIN",
						"PLAIN",
						"CRAM-MD5",
					},
					Default: "PLAIN",
				},
				Usage:    "SMTP Authentication method",
				Category: "smtp",
				EnvVars:  []string{"AUTH_SMTP_AUTH_METHOD"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagClientURL,
				Usage:    "URL of your frontend application. Used to redirect users to the right page once actions based on emails or OAuth succeed",
				Category: "application",
				EnvVars:  []string{"AUTH_CLIENT_URL"},
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:     flagAllowRedirectURLs,
				Usage:    "Allowed redirect URLs",
				Category: "application",
				EnvVars:  []string{"AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagServerURL,
				Usage:    "Server URL of where Hasura Backend Plus is running. This value is to used as a callback in email templates and for the OAuth authentication process",
				Category: "server",
				EnvVars:  []string{"AUTH_SERVER_URL"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagEnableChangeEnv,
				Usage:    "Enable change env. Do not do this in production!",
				Category: "server",
				EnvVars:  []string{"AUTH_ENABLE_CHANGE_ENV"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagCustomClaims,
				Usage:    "Custom claims",
				Category: "jwt",
				EnvVars:  []string{"AUTH_JWT_CUSTOM_CLAIMS"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagGraphqlURL,
				Usage:    "Hasura GraphQL endpoint. Required for custom claims",
				Category: "jwt",
				EnvVars:  []string{"HASURA_GRAPHQL_GRAPHQL_URL"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagHasuraAdminSecret,
				Usage:    "Hasura admin secret. Required for custom claims",
				Category: "jwt",
				EnvVars:  []string{"HASURA_GRAPHQL_ADMIN_SECRET"},
			},
			&cli.IntFlag{ //nolint: exhaustruct
				Name:     flagPasswordMinLength,
				Usage:    "Minimum password length",
				Value:    3, //nolint:mnd
				Category: "signup",
				EnvVars:  []string{"AUTH_PASSWORD_MIN_LENGTH"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagPasswordHIBPEnabled,
				Usage:    "Check user's password against Pwned Passwords https://haveibeenpwned.com/Passwords",
				Category: "signup",
				EnvVars:  []string{"AUTH_PASSWORD_HIBP_ENABLED"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagEmailTemplatesPath,
				Usage:    "Path to the email templates. Default to included ones if path isn't found",
				Value:    "/app/email-templates",
				Category: "email",
				EnvVars:  []string{"AUTH_EMAIL_TEMPLATES_PATH"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagBlockedEmailDomains,
				Usage:    "Comma-separated list of email domains that cannot register",
				Category: "signup",
				EnvVars:  []string{"AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagBlockedEmails,
				Usage:    "Comma-separated list of email domains that cannot register",
				Category: "signup",
				EnvVars:  []string{"AUTH_ACCESS_CONTROL_BLOCKED_EMAILS"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagAllowedEmailDomains,
				Usage:    "Comma-separated list of email domains that can register",
				Category: "signup",
				EnvVars:  []string{"AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagAllowedEmails,
				Usage:    "Comma-separated list of emails that can register",
				Category: "signup",
				EnvVars:  []string{"AUTH_ACCESS_CONTROL_ALLOWED_EMAILS"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagEmailPasswordlessEnabled,
				Usage:    "Enables passwordless authentication by email. SMTP must be configured",
				Value:    false,
				Category: "signin",
				EnvVars:  []string{"AUTH_EMAIL_PASSWORDLESS_ENABLED"},
			},
			&cli.GenericFlag{ //nolint: exhaustruct
				Name: flagRequireElevatedClaim,
				Value: &EnumValue{ //nolint: exhaustruct
					Enum: []string{
						"disabled",
						"recommended",
						"required",
					},
					Default: "disabled",
				},
				Usage:    "Require x-hasura-auth-elevated claim to perform certain actions: create PATs, change email and/or password, enable/disable MFA and add security keys. If set to `recommended` the claim check is only performed if the user has a security key attached. If set to `required` the only action that won't require the claim is setting a security key for the first time.",
				Category: "security",
				EnvVars:  []string{"AUTH_REQUIRE_ELEVATED_CLAIM"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagWebauthnEnabled,
				Usage:    "When enabled, passwordless Webauthn authentication can be done via device supported strong authenticators like fingerprint, Face ID, etc.",
				Value:    false,
				Category: "webauthn",
				EnvVars:  []string{"AUTH_WEBAUTHN_ENABLED"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagWebauhtnRPName,
				Usage:    "Relying party name. Friendly name visual to the user informing who requires the authentication. Probably your app's name",
				Category: "webauthn",
				EnvVars:  []string{"AUTH_WEBAUTHN_RP_NAME"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagWebauthnRPID,
				Usage:    "Relying party id. If not set `AUTH_CLIENT_URL` will be used as a default",
				Category: "webauthn",
				EnvVars:  []string{"AUTH_WEBAUTHN_RP_ID"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagWebauthnRPOrigins,
				Usage:    "Array of URLs where the registration is permitted and should have occurred on. `AUTH_CLIENT_URL` will be automatically added to the list of origins if is set",
				Category: "webauthn",
				EnvVars:  []string{"AUTH_WEBAUTHN_RP_ORIGINS"},
			},
			&cli.IntFlag{ //nolint: exhaustruct
				Name:     flagWebauthnAttestationTimeout,
				Usage:    "Timeout for the attestation process in milliseconds",
				Value:    60000, //nolint:mnd
				Category: "webauthn",
				EnvVars:  []string{"AUTH_WEBAUTHN_ATTESTATION_TIMEOUT"},
			},
		},
		Action: serve,
	}
}

func getNodeServer(cCtx *cli.Context) *exec.Cmd {
	env := os.Environ()
	found := false
	authPort := strconv.Itoa(cCtx.Int(flagPort) + 1)
	for i, v := range env {
		if strings.HasPrefix(v, "AUTH_PORT=") {
			found = true
			env[i] = "AUTH_PORT=" + authPort
		}
	}
	if !found {
		env = append(env, "AUTH_PORT="+authPort)
	}
	env = append(env, "NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-bundle.crt")
	env = append(env, "PWD="+cCtx.String(flagNodeServerPath))
	env = append(env, "AUTH_VERSION="+cCtx.App.Version)

	if cCtx.Bool(flagEnableChangeEnv) {
		env = append(env, "NODE_ENV=development")
	}

	if cCtx.String(flagPostgresMigrationsConnection) != "" {
		for i, v := range env {
			if strings.HasPrefix(v, "HASURA_GRAPHQL_DATABASE_URL=") {
				env[i] = "HASURA_GRAPHQL_DATABASE_URL=" + cCtx.String(
					flagPostgresMigrationsConnection,
				)
			}
		}
	}

	cmd := exec.CommandContext(cCtx.Context, "node", "./dist/start.js")
	cmd.Dir = cCtx.String(flagNodeServerPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = env
	return cmd
}

func getGoServer( //nolint:funlen
	cCtx *cli.Context, db *sql.Queries, logger *slog.Logger,
) (*http.Server, error) {
	router := gin.New()

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(api.OpenAPISchema)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI schema: %w", err)
	}
	doc.AddServer(&openapi3.Server{ //nolint:exhaustruct
		URL: cCtx.String(flagAPIPrefix),
	})

	router.Use(
		// ginmiddleware.OapiRequestValidator(doc),
		gin.Recovery(),
		cors(),
		middleware.Logger(logger),
	)

	emailer, err := getEmailer(cCtx, logger)
	if err != nil {
		return nil, fmt.Errorf("problem creating emailer: %w", err)
	}

	config, err := getConfig(cCtx)
	if err != nil {
		return nil, fmt.Errorf("problem creating config: %w", err)
	}

	jwtGetter, err := getJWTGetter(cCtx, db)
	if err != nil {
		return nil, fmt.Errorf("problem creating jwt getter: %w", err)
	}

	ctrl, err := controller.New(db, config, jwtGetter, emailer, hibp.NewClient(), cCtx.App.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to create controller: %w", err)
	}
	handler := api.NewStrictHandler(ctrl, []api.StrictMiddlewareFunc{})
	mw := api.MiddlewareFunc(ginmiddleware.OapiRequestValidatorWithOptions(
		doc,
		&ginmiddleware.Options{ //nolint:exhaustruct
			Options: openapi3filter.Options{ //nolint:exhaustruct
				AuthenticationFunc: jwtGetter.MiddlewareFunc,
			},
			SilenceServersWarning: true,
		},
	))
	api.RegisterHandlersWithOptions(
		router,
		handler,
		api.GinServerOptions{
			BaseURL:      cCtx.String(flagAPIPrefix),
			Middlewares:  []api.MiddlewareFunc{mw},
			ErrorHandler: nil,
		},
	)

	nodejsHandler, err := nodejsHandler()
	if err != nil {
		return nil, fmt.Errorf("failed to create nodejs handler: %w", err)
	}
	router.NoRoute(nodejsHandler)

	if cCtx.Bool(flagEnableChangeEnv) {
		router.POST(cCtx.String(flagAPIPrefix)+"/change-env", ctrl.PostChangeEnv(nodejsHandler))
	}

	server := &http.Server{ //nolint:exhaustruct
		Addr:              ":" + cCtx.String(flagPort),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
	}

	return server, nil
}

func serve(cCtx *cli.Context) error {
	logger := getLogger(cCtx.Bool(flagDebug), cCtx.Bool(flagLogFormatTEXT))
	logger.Info(cCtx.App.Name + " v" + cCtx.App.Version)
	logFlags(logger, cCtx)

	ctx, cancel := context.WithCancel(cCtx.Context)
	defer cancel()

	nodeServer := getNodeServer(cCtx)
	go func() {
		defer cancel()
		if err := nodeServer.Run(); err != nil {
			logger.Error("node server failed", slog.String("error", err.Error()))
		}
	}()

	pool, err := getDBPool(cCtx)
	if err != nil {
		return fmt.Errorf("failed to create database pool: %w", err)
	}
	defer pool.Close()

	server, err := getGoServer(cCtx, sql.New(pool), logger)
	if err != nil {
		return fmt.Errorf("failed to create server: %w", err)
	}

	go func() {
		defer cancel()
		if err := server.ListenAndServe(); err != nil {
			logger.Error("server failed", slog.String("error", err.Error()))
		}
	}()

	<-ctx.Done()

	logger.Info("shutting down server")
	if err := server.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown server: %w", err)
	}

	return nil
}
