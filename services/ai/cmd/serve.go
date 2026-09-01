package cmd

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Yamashou/gqlgenc/clientv2"
	_ "github.com/lib/pq" // postgres driver for database/sql
	"github.com/nhost/nhost/services/ai/agents"
	agentprovider "github.com/nhost/nhost/services/ai/agents/provider"
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
	flagAnthropicWorkspaceID     = "anthropic-workspace-id"
	flagGoogleKey                = "google-key"
	flagBraveKey                 = "brave-key"
	flagTavilyKey                = "tavily-key"
	flagOpenAICompatibleBaseURL  = "openai-compatible-base-url"
	flagOpenAICompatibleHeaders  = "openai-compatible-headers"
)

var (
	errInvalidOpenAICompatibleHeadersJSON = errors.New(
		"invalid OpenAI-compatible headers JSON",
	)
	errOpenAICompatibleBaseURLRequired = errors.New(
		"OpenAI-compatible base URL is required when headers are configured",
	)
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
				Name:     flagAnthropicWorkspaceID,
				Usage:    "Anthropic workspace ID",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"ANTHROPIC_WORKSPACE_ID"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagGoogleKey,
				Usage:    "Google AI API key",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"GOOGLE_AI_API_KEY"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagOpenAICompatibleBaseURL,
				Usage:    "OpenAI-compatible Chat Completions base URL",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"OPENAI_COMPATIBLE_BASE_URL"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagOpenAICompatibleHeaders,
				Usage:    "JSON object of static OpenAI-compatible request headers",
				Value:    "",
				Category: "agents",
				EnvVars:  []string{"OPENAI_COMPATIBLE_HEADERS"},
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
	agentProviders, err := buildAgentProviders(cCtx.Context, cCtx)
	if err != nil {
		return fmt.Errorf("configure agent providers: %w", err)
	}

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
		agentProviders,
		buildAgentToolConfig(cCtx),
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

// buildAgentProviders creates the configured provider clients once at service
// startup. Provider-specific options stay with their adapter instead of being
// threaded through a shared constructor.
func buildAgentProviders(
	ctx context.Context,
	cCtx *cli.Context,
) (agentprovider.Registry, error) {
	providers := agentprovider.Registry{}

	anthropicConfig := buildAnthropicConfig(cCtx)
	if anthropicConfig.APIKey != "" {
		anthropic, err := agentprovider.NewAnthropic(anthropicConfig)
		if err != nil {
			return nil, fmt.Errorf("create Anthropic client: %w", err)
		}

		providers[string(hasura.AiAgentProvidersEnumAnthropic)] = anthropic
	}

	if apiKey := cCtx.String(flagOpenAIKey); apiKey != "" {
		openAI, err := agentprovider.NewOpenAI(agentprovider.OpenAIConfig{APIKey: apiKey})
		if err != nil {
			return nil, fmt.Errorf("create OpenAI client: %w", err)
		}

		providers[string(hasura.AiAgentProvidersEnumOpenai)] = openAI
	}

	if apiKey := cCtx.String(flagGoogleKey); apiKey != "" {
		google, err := agentprovider.NewGoogle(ctx, agentprovider.GoogleConfig{APIKey: apiKey})
		if err != nil {
			return nil, fmt.Errorf("create Google client: %w", err)
		}

		providers[string(hasura.AiAgentProvidersEnumGoogle)] = google
	}

	if err := registerOpenAICompatibleProvider(cCtx, providers); err != nil {
		return nil, err
	}

	return providers, nil
}

func buildAnthropicConfig(cCtx *cli.Context) agentprovider.AnthropicConfig {
	return agentprovider.AnthropicConfig{
		APIKey:      cCtx.String(flagAnthropicKey),
		WorkspaceID: cCtx.String(flagAnthropicWorkspaceID),
	}
}

func buildAgentToolConfig(cCtx *cli.Context) agents.ToolConfig {
	return agents.ToolConfig{
		BraveKey:  cCtx.String(flagBraveKey),
		TavilyKey: cCtx.String(flagTavilyKey),
	}
}

func registerOpenAICompatibleProvider(
	cCtx *cli.Context,
	providers agentprovider.Registry,
) error {
	headers, err := parseOpenAICompatibleHeaders(cCtx.String(flagOpenAICompatibleHeaders))
	if err != nil {
		return fmt.Errorf("parse OpenAI-compatible headers: %w", err)
	}

	baseURL := cCtx.String(flagOpenAICompatibleBaseURL)
	if baseURL == "" {
		if len(headers) != 0 {
			return errOpenAICompatibleBaseURLRequired
		}

		return nil
	}

	config, err := agentprovider.NewOpenAIChatCompletionsConfig(baseURL, headers)
	if err != nil {
		return fmt.Errorf("validate OpenAI-compatible configuration: %w", err)
	}

	chatCompletions, err := agentprovider.NewOpenAIChatCompletions(config)
	if err != nil {
		return fmt.Errorf("create OpenAI-compatible client: %w", err)
	}

	providers[string(hasura.AiAgentProvidersEnumOpenaiCompatible)] = chatCompletions

	return nil
}

type openAICompatibleHeader struct {
	name  string
	value string
}

func parseOpenAICompatibleHeaders(raw string) (map[string]string, error) {
	if strings.TrimSpace(raw) == "" {
		return map[string]string{}, nil
	}

	// encoding/json replaces malformed UTF-8 with U+FFFD instead of rejecting
	// it, so validate the raw JSON before decoding and before the provider-level
	// header validation can lose that distinction.
	if !utf8.ValidString(raw) {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	decoder := json.NewDecoder(strings.NewReader(raw))

	parsed, err := decodeOpenAICompatibleHeaders(decoder)
	if err != nil {
		return nil, err
	}

	trailing, err := decoder.Token()
	if !errors.Is(err, io.EOF) || trailing != nil {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	headers := make(map[string]string, len(parsed))
	for _, header := range parsed {
		headers[header.name] = header.value
	}

	return headers, nil
}

func decodeOpenAICompatibleHeaders(
	decoder *json.Decoder,
) ([]openAICompatibleHeader, error) {
	opening, err := decoder.Token()
	if err != nil {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	openingDelimiter, ok := opening.(json.Delim)
	if !ok || openingDelimiter != '{' {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	parsed := make([]openAICompatibleHeader, 0)
	for decoder.More() {
		nameToken, err := decoder.Token()
		if err != nil {
			return nil, errInvalidOpenAICompatibleHeadersJSON
		}

		name, ok := nameToken.(string)
		if !ok || hasOpenAICompatibleHeaderName(parsed, name) {
			return nil, errInvalidOpenAICompatibleHeadersJSON
		}

		valueToken, err := decoder.Token()
		if err != nil {
			return nil, errInvalidOpenAICompatibleHeadersJSON
		}

		value, ok := valueToken.(string)
		if !ok {
			return nil, errInvalidOpenAICompatibleHeadersJSON
		}

		parsed = append(parsed, openAICompatibleHeader{name: name, value: value})
	}

	closing, err := decoder.Token()
	if err != nil {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	closingDelimiter, ok := closing.(json.Delim)
	if !ok || closingDelimiter != '}' {
		return nil, errInvalidOpenAICompatibleHeadersJSON
	}

	return parsed, nil
}

func hasOpenAICompatibleHeaderName(headers []openAICompatibleHeader, name string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.name, name) {
			return true
		}
	}

	return false
}
