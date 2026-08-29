package cmd

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq" // postgres driver for database/sql
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embeddings"
	"github.com/nhost/nhost/services/ai/graph"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/migrations"
	"github.com/nhost/nhost/services/ai/openai"
	"github.com/nhost/nhost/services/ai/openai/api"
	sapi "github.com/nhost/nhost/services/ai/storage/api"
	"github.com/urfave/cli/v2"
)

const (
	licensePublicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA9jeVBVcZII1Nqf3e2HzCVa2gm8jge6NkCX/XH4cKglg=
-----END PUBLIC KEY-----`
)

const (
	flagPathPrefix               = "path-prefix"
	flagBind                     = "bind"
	flagDebug                    = "debug"
	flagLogFormatJSON            = "log-format-json"
	flagEnablePlayground         = "enable-playground"
	flagTrustedProxies           = "trusted-proxies"
	flagAllowCORSOrigin          = "allow-cors-origin"
	flagDisableAuhtorization     = "disable-authorization"
	flagNhostGraphqlURL          = "nhost-graphql-url"
	flagHasuraGraphqlAdminSecret = "hasura-graphql-admin-secret" //nolint: gosec
	flagNhostStorageURL          = "nhost-storage-url"
	flagOpenAIKey                = "openai-key"
	flagOpenAIOrg                = "openai-org"
	flagPostgresConnection       = "postgres"
	flagGraphiteWebhookSecret    = "graphite-webhook-secret"
	flagGraphiteBaseURL          = "graphite-base-url"
	flagSynchPeriod              = "synch-period"
	flagLicense                  = "license"
	flagAnthropicKey             = "anthropic-key"
	flagGoogleKey                = "google-key"
	flagBraveKey                 = "brave-key"
	flagTavilyKey                = "tavily-key"
)

const (
	maxOpenConns    = 10
	maxIdleConns    = 5
	connMaxLifetime = 1 * time.Minute
)

func CommandServe() *cli.Command { //nolint:funlen
	return &cli.Command{ //nolint: exhaustruct
		Name:  "serve",
		Usage: "Serve the application",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPathPrefix,
				Usage:    "prefix for all routes",
				Value:    "/v1",
				Category: "server",
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagBind,
				Usage:    "bind address",
				Value:    ":8090",
				Category: "server",
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagDebug,
				Usage:    "enable debug logging",
				Category: "general",
				EnvVars:  []string{"DEBUG"},
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagLogFormatJSON,
				Usage:    "format logs in JSON",
				Category: "general",
			},
			&cli.BoolFlag{ //nolint: exhaustruct
				Name:     flagEnablePlayground,
				Usage:    "enable graphql playground (under /v1)",
				Category: "server",
				EnvVars:  []string{"ENABLE_PLAYGROUND"},
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagTrustedProxies,
				Usage:    "Trust this proxies only",
				Value:    &cli.StringSlice{},
				Category: "server",
			},
			&cli.StringSliceFlag{ //nolint: exhaustruct
				Name:     flagAllowCORSOrigin,
				Usage:    "Allow CORS from these origins",
				Value:    cli.NewStringSlice("*"),
				Category: "server",
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagNhostGraphqlURL,
				Usage:    "URL of the nhost graphql server",
				Value:    "https://local.hasura.nhost.run/v1/graphql",
				Category: "nhost",
				EnvVars:  []string{"NHOST_GRAPHQL_URL"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagHasuraGraphqlAdminSecret,
				Usage:    "secret for the hasura graphql admin user",
				Value:    "nhost-admin-secret",
				Category: "nhost",
				EnvVars:  []string{"HASURA_GRAPHQL_ADMIN_SECRET"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagNhostStorageURL,
				Usage:    "URL of the nhost storage server",
				Value:    "https://local.storage.nhost.run/v1",
				Category: "nhost",
				EnvVars:  []string{"NHOST_STORAGE_URL"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagOpenAIKey,
				Usage:    "OpenAI API key",
				Value:    "",
				Category: "openai",
				EnvVars:  []string{"OPENAI_API_KEY"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagOpenAIOrg,
				Usage:    "OpenAI organization",
				Value:    "",
				Category: "openai",
				EnvVars:  []string{"OPENAI_ORG"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagPostgresConnection,
				Usage:    "Postgres connection string",
				Value:    "postgres://postgres:postgres@localhost:5432/local?sslmode=disable",
				Category: "postgres",
				EnvVars:  []string{"POSTGRES_CONNECTION"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagGraphiteWebhookSecret,
				Usage:    "Graphite secret used in webhooks",
				Value:    "",
				Category: "graphite",
				EnvVars:  []string{"GRAPHITE_WEBHOOK_SECRET"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagGraphiteBaseURL,
				Usage:    "Graphite URL to use when generating webhooks",
				Value:    "http://localhost:8090",
				Category: "graphite",
				EnvVars:  []string{"GRAPHITE_BASE_URL"},
			},
			&cli.DurationFlag{ //nolint: exhaustruct
				Name:     flagSynchPeriod,
				Usage:    "Period to synch the auto embeddings",
				Value:    1 * time.Minute,
				Category: "graphite",
				EnvVars:  []string{"SYNCH_PERIOD"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagLicense,
				Usage:    "License",
				Value:    "",
				Category: "general",
				EnvVars:  []string{"LICENSE"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagAnthropicKey,
				Usage:    "Anthropic API key",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"ANTHROPIC_API_KEY"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagGoogleKey,
				Usage:    "Google AI API key",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"GOOGLE_AI_API_KEY"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagBraveKey,
				Usage:    "Brave Search API key",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"BRAVE_API_KEY"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagTavilyKey,
				Usage:    "Tavily Search API key",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"TAVILY_API_KEY"},
			},
		},
		Action: serve,
	}
}

func applyMigrations(
	cCtx *cli.Context,
	nhost *hasura.Client,
	postgresURL string,
	logger *slog.Logger,
) error {
	logger.InfoContext(cCtx.Context, "Applying postgres migrations")

	if err := migrations.ApplyPostgresMigration(cCtx.Context, postgresURL); err != nil {
		return fmt.Errorf("failed to apply postgres migrations: %w", err)
	}

	logger.InfoContext(cCtx.Context, "Migrations applied")

	logger.InfoContext(cCtx.Context, "Applying hasura migrations")

	if err := migrations.ApplyHasuraMetadata(
		cCtx.Context,
		nhost,
		cCtx.String(flagGraphiteBaseURL),
		logger,
	); err != nil {
		return fmt.Errorf("failed to apply hasura migrations: %w", err)
	}

	logger.InfoContext(cCtx.Context, "Migrations applied")

	return nil
}

func getRouter(
	cCtx *cli.Context,
	resolver *graph.Resolver,
	agentService *agents.Service,
	logger *slog.Logger,
) *gin.Engine {
	return graph.SetupRouter(
		cCtx.String(flagPathPrefix),
		resolver,
		agentService,
		cCtx.Bool(flagEnablePlayground),
		cCtx.App.Version,
		[]gin.HandlerFunc{
			middleware.NeedsWebhookSecret(cCtx.String(flagGraphiteWebhookSecret)),
		},
		gin.Recovery(),
		middleware.GinContext,
		middleware.Logger(logger),
		cors.New(cors.Config{ //nolint: exhaustruct
			AllowOrigins: cCtx.StringSlice(flagAllowCORSOrigin),
			AllowHeaders: []string{
				"Origin",
				"Content-Type",
				"Authorization",
				"X-Hasura-Admin-Secret",
				"X-Hasura-User-Id",
				"X-Hasura-Role",
			},
			AllowMethods:     []string{"GET", "POST"},
			AllowCredentials: true,
		}),
	)
}

func getHasuraClient(cCtx *cli.Context) *hasura.Client {
	return hasura.NewClient(
		&http.Client{}, //nolint:exhaustruct
		cCtx.String(flagNhostGraphqlURL),
		&clientv2.Options{
			ParseDataAlongWithErrors: false,
		},
		hasura.WithAdminSecret(cCtx.String(flagHasuraGraphqlAdminSecret)),
	)
}

func getStorageClient(cCtx *cli.Context) (*sapi.ClientWithResponses, error) {
	sc, err := sapi.NewClientWithResponses(
		cCtx.String(flagNhostStorageURL),
		sapi.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Add("X-Hasura-Admin-Secret", cCtx.String(flagHasuraGraphqlAdminSecret))
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating storage client: %w", err)
	}

	return sc, nil
}

func openPostgres(pgConnStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", pgConnStr)
	if err != nil {
		return nil, fmt.Errorf("problem opening postgres connection: %w", err)
	}

	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(connMaxLifetime)

	return db, nil
}

func getOAI(apiKey, org, graphqlURL, adminSecret, pgConnStr string) (*openai.Client, error) {
	oai, err := api.NewClientWithResponses(
		"https://api.openai.com/v1/",
		api.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Add("Authorization", "Bearer "+apiKey)
			req.Header.Add("OpenAI-Organization", org)     //nolint:canonicalheader
			req.Header.Add("OpenAI-Beta", "assistants=v2") //nolint:canonicalheader

			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating OpenAI client: %w", err)
	}

	coai, err := api.NewCustomClientWithResponses(
		"https://api.openai.com/v1/",
		api.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Add("Authorization", "Bearer "+apiKey)
			req.Header.Add("OpenAI-Organization", org)     //nolint:canonicalheader
			req.Header.Add("OpenAI-Beta", "assistants=v2") //nolint:canonicalheader

			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating custom OpenAI client: %w", err)
	}

	return openai.New(oai, coai, graphqlURL, adminSecret, pgConnStr), nil
}

func devInstanceLogger(ctx context.Context, logger *slog.Logger) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		//nolint:lll
		logger.WarnContext(
			ctx,
			"⚠️ ⚠️ ⚠️ This is a development instance of graphite. It is intended to be used exclussively as part of the nhost cli for development purposes. Any other use is strictly forbidden. If you need a production instance of graphite, please contact us at https://nhost.io",
		)

		time.Sleep(5 * time.Minute) //nolint:mnd
	}
}

func serve(cCtx *cli.Context) error { //nolint:funlen
	logger := getLogger(cCtx.Bool(flagDebug), cCtx.Bool(flagLogFormatJSON))
	logger.InfoContext(cCtx.Context, cCtx.App.Name+" v"+cCtx.App.Version)
	logFlags(logger, cCtx)

	if err := VerifyLicense([]byte(licensePublicKey), cCtx.String(flagLicense)); err != nil {
		logger.WarnContext(
			cCtx.Context,
			"License verification failed, assuming nhost cli dev instance",
			slog.String("error", err.Error()),
		)

		go devInstanceLogger(cCtx.Context, logger)
	} else {
		logger.InfoContext(cCtx.Context, "License verified")
	}

	hc := getHasuraClient(cCtx)

	ai := autoai.NewAutoAI(
		hc, cCtx.String(flagGraphiteBaseURL), cCtx.String(flagGraphiteWebhookSecret),
	)

	oai, err := getOAI(
		cCtx.String(flagOpenAIKey),
		cCtx.String(flagOpenAIOrg),
		cCtx.String(flagNhostGraphqlURL),
		cCtx.String(flagHasuraGraphqlAdminSecret),
		cCtx.String(flagPostgresConnection),
	)
	if err != nil {
		return err
	}

	sc, err := getStorageClient(cCtx)
	if err != nil {
		return err
	}

	db, err := openPostgres(cCtx.String(flagPostgresConnection))
	if err != nil {
		return err
	}
	defer db.Close()

	agentService := agents.NewService(
		hc,
		db,
		buildProviderConfig(cCtx),
		cCtx.String(flagGraphiteBaseURL),
		cCtx.String(flagHasuraGraphqlAdminSecret),
		cCtx.String(flagNhostGraphqlURL),
	)

	resolver := graph.NewResolver(
		ai,
		oai,
		hc,
		sc,
	)

	ctx, cancel := context.WithCancel(cCtx.Context)
	defer cancel()

	logger.InfoContext(ctx, "starting auto embeddings process")
	pool := embeddings.New(
		cCtx.Duration(flagSynchPeriod),
		hc,
		oai,
		logger.With("component", "autoai.auto_embeddings_process"),
	)

	go func() {
		pool.Run(ctx)
		cancel()
	}()

	if err := applyMigrations(
		cCtx,
		hc,
		cCtx.String(flagPostgresConnection),
		logger,
	); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	go func() {
		defer cancel()

		r := getRouter(cCtx, resolver, agentService, logger) //nolint:contextcheck
		logger.InfoContext(ctx, "starting server")

		if err := r.Run(cCtx.String(flagBind)); err != nil {
			logger.ErrorContext(ctx, "failed to run gin", slog.String("error", err.Error()))
		}
	}()

	for {
		logger.InfoContext(ctx, "adding remote schema")

		if err := migrations.AddRemoteSchema(
			ctx, hc, cCtx.String(flagGraphiteBaseURL),
		); err != nil {
			logger.WarnContext(
				ctx, "failed to add remote schema, retrying", slog.String("error", err.Error()),
			)
		} else {
			logger.InfoContext(ctx, "remote schema added")
			break
		}

		time.Sleep(5 * time.Second) //nolint:mnd
	}

	if err := ai.Start(cCtx.Context, logger); err != nil {
		return fmt.Errorf("failed to synch auto embeddings configuration: %w", err)
	}

	if err := migrateAssistantsToNewFormat(cCtx.Context, hc, oai, logger); err != nil {
		return fmt.Errorf("failed to migrate old assistants format: %w", err)
	}

	<-ctx.Done()

	return nil
}

// buildProviderConfig reads the agent-provider flags off the CLI context.
// Extracted so the flag-name → struct-field mapping is testable without
// booting the full serve action — a regression where a flag is renamed and
// the agent service silently disables itself would otherwise only surface as
// a 404 against /v1/agents/... at runtime.
func buildProviderConfig(cCtx *cli.Context) agents.ProviderConfig {
	return agents.ProviderConfig{
		AnthropicKey: cCtx.String(flagAnthropicKey),
		OpenAIKey:    cCtx.String(flagOpenAIKey),
		GoogleKey:    cCtx.String(flagGoogleKey),
		BraveKey:     cCtx.String(flagBraveKey),
		TavilyKey:    cCtx.String(flagTavilyKey),
	}
}
