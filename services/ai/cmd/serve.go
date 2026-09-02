package cmd

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	_ "github.com/lib/pq" // postgres driver for database/sql
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embeddings"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/migrations"
	"github.com/nhost/nhost/services/ai/openai"
	"github.com/urfave/cli/v2"
)

const (
	flagPathPrefix               = "path-prefix"
	flagBind                     = "bind"
	flagDebug                    = "debug"
	flagLogFormatJSON            = "log-format-json"
	flagAllowCORSOrigin          = "allow-cors-origin"
	flagNhostGraphqlURL          = "nhost-graphql-url"
	flagHasuraGraphqlAdminSecret = "hasura-graphql-admin-secret" //nolint: gosec
	flagOpenAIKey                = "openai-key"
	flagOpenAIOrg                = "openai-org"
	flagPostgresConnection       = "postgres"
	flagAIWebhookSecret          = "ai-webhook-secret" //nolint:gosec // CLI flag name, not a credential.
	flagAIBaseURL                = "ai-base-url"
	flagSynchPeriod              = "synch-period"
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
				Name:     flagAIWebhookSecret,
				Usage:    "AI secret used in webhooks",
				Value:    "",
				Category: "ai",
				EnvVars:  []string{"AI_WEBHOOK_SECRET"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagAIBaseURL,
				Usage:    "AI URL to use when generating webhooks",
				Value:    "http://localhost:8090",
				Category: "ai",
				EnvVars:  []string{"AI_BASE_URL"},
			},
			&cli.DurationFlag{ //nolint: exhaustruct
				Name:     flagSynchPeriod,
				Usage:    "Period to synch the auto embeddings",
				Value:    1 * time.Minute,
				Category: "ai",
				EnvVars:  []string{"SYNCH_PERIOD"},
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
		cCtx.String(flagAIBaseURL),
		logger,
	); err != nil {
		return fmt.Errorf("failed to apply hasura migrations: %w", err)
	}

	logger.InfoContext(cCtx.Context, "Migrations applied")

	return nil
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

func serve(cCtx *cli.Context) error { //nolint:funlen
	logger := getLogger(cCtx.Bool(flagDebug), cCtx.Bool(flagLogFormatJSON))
	logger.InfoContext(cCtx.Context, cCtx.App.Name+" v"+cCtx.App.Version)
	logFlags(logger, cCtx)

	hc := getHasuraClient(cCtx)
	autoAI := autoai.NewAutoAI(
		hc,
		cCtx.String(flagAIBaseURL),
		cCtx.String(flagAIWebhookSecret),
	)
	oai := openai.New(cCtx.String(flagOpenAIKey), cCtx.String(flagOpenAIOrg))

	db, err := openPostgres(cCtx.String(flagPostgresConnection))
	if err != nil {
		return err
	}
	defer db.Close()

	agentService := agents.NewService(
		hc,
		db,
		buildProviderConfig(cCtx),
		cCtx.String(flagAIBaseURL),
		cCtx.String(flagHasuraGraphqlAdminSecret),
		cCtx.String(flagNhostGraphqlURL),
	)

	if err := applyMigrations(
		cCtx,
		hc,
		cCtx.String(flagPostgresConnection),
		logger,
	); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	ctx, cancel := context.WithCancel(cCtx.Context)
	defer cancel()

	go func() {
		defer cancel()

		router := getRouter( //nolint:contextcheck
			cCtx,
			autoAI,
			oai,
			hc,
			agentService,
			logger,
		)
		logger.InfoContext(ctx, "starting server")

		if err := router.Run(cCtx.String(flagBind)); err != nil {
			logger.ErrorContext(ctx, "failed to run gin", slog.String("error", err.Error()))
		}
	}()

	if err := autoAI.Start(ctx, logger); err != nil {
		return fmt.Errorf("synchronizing auto embeddings configuration: %w", err)
	}

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
