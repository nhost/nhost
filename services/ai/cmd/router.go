package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/urfave/cli/v2"
)

const (
	deleteEvent = "DELETE"
	insertEvent = "INSERT"
	updateEvent = "UPDATE"
)

var errUnknownAutoEmbeddingsEventOperation = errors.New(
	"unknown auto-embeddings event operation",
)

var (
	errInvalidSearchJSON = errors.New("invalid request JSON")
	errOldSearchContract = errors.New(
		"search function was deployed by an older ai service; " +
			"restart the service to redeploy it and check the configuration's last_error",
	)
	errInvalidConfigurationID      = errors.New("invalid configuration_id")
	errConfigurationLookup         = errors.New("configuration lookup failed")
	errConfigurationNotFound       = errors.New("configuration not found")
	errEmbeddingProviderUndeclared = errors.New("embedding provider is not declared")
	errEmbeddingProviderRequest    = errors.New("embedding provider request failed")
)

const searchRequestTimeout = 4 * time.Second

// searchRetry absorbs brief rate limits and 5xx errors inside the search deadline,
// as the OpenAI SDK used by the previous client did (two retries). A longer
// Retry-After exceeds the wait budget and fails the search immediately.
const (
	searchRetryAttempts = 3
	searchRetryWait     = 1500 * time.Millisecond
	searchRetryDelay    = 200 * time.Millisecond
)

func searchRetry() embedder.RetryPolicy {
	return embedder.RetryPolicy{
		MaxAttempts:  searchRetryAttempts,
		MaxWait:      searchRetryWait,
		InitialDelay: searchRetryDelay,
		MaxDelay:     time.Second,
		Clock:        nil,
		Jitter:       nil,
	}
}

type loggerContextKey struct{}

//go:generate mockgen -package mock -destination mock/agent_handlers.go . agentHandlers
type agentHandlers interface {
	HandleStreamMessage(c *gin.Context)
	HandleApproveTools(c *gin.Context)
}

//go:generate mockgen -package mock -destination mock/embeddings_configuration_getter.go . autoEmbeddingsConfigurationGetter
type autoEmbeddingsConfigurationGetter interface {
	GetAiAutoEmbeddingsConfiguration(
		ctx context.Context,
		id string,
		interceptors ...clientv2.RequestInterceptor,
	) (*hasura.GetAiAutoEmbeddingsConfiguration, error)
}

//go:generate mockgen -package mock -destination mock/embeddings_synchronizer.go . autoEmbeddingsSynchronizer
type autoEmbeddingsSynchronizer interface {
	SynchAutoEmbeddingsConfiguration(
		ctx context.Context,
		config *hasura.AiAutoEmbeddingsConfigurationFragment,
		remove bool,
		logger *slog.Logger,
	) error
}

type webhookHandler struct {
	autoAI     autoEmbeddingsSynchronizer
	embeddings embedder.Registry
	hasura     autoEmbeddingsConfigurationGetter
}

//nolint:tagliatelle
type autoEmbeddingsConfigurationWebhookEvent struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			New struct {
				ID string `json:"id"`
			} `json:"new"`
			Old struct {
				ID         string `json:"id"`
				Name       string `json:"name"`
				Model      string `json:"model"`
				SchemaName string `json:"schema_name"`
				TableName  string `json:"table_name"`
				ColumnName string `json:"column_name"`
			} `json:"old"`
		} `json:"data"`
	} `json:"event"`
	ID      string `json:"id"`
	Trigger struct {
		Name string `json:"name"`
	} `json:"trigger"`
}

type generateEmbeddingsWebhookRequest struct {
	Query           string          `json:"query"`
	Model           json.RawMessage `json:"model"`
	ConfigurationID string          `json:"configuration_id"`
}

func getRouter(
	cCtx *cli.Context,
	autoAI *autoai.AutoAI,
	embeddings embedder.Registry,
	hasuraClient *hasura.Client,
	agentService agentHandlers,
	logger *slog.Logger,
) *gin.Engine {
	return setupRouter(
		cCtx.String(flagPathPrefix),
		cCtx.App.Version,
		cCtx.String(flagAIWebhookSecret),
		cCtx.StringSlice(flagAllowCORSOrigin),
		&webhookHandler{
			autoAI:     autoAI,
			embeddings: embeddings,
			hasura:     hasuraClient,
		},
		agentService,
		logger,
	)
}

func setupRouter(
	pathPrefix, version, webhookSecret string,
	allowedOrigins []string,
	webhooks *webhookHandler,
	agentService agentHandlers,
	logger *slog.Logger,
) *gin.Engine {
	router := gin.New()
	router.Use(
		gin.Recovery(),
		requestLogger(logger),
		cors.New(cors.Config{ //nolint:exhaustruct
			AllowOrigins: allowedOrigins,
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

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"healthz": "ok"})
	})

	apiRoot := router.Group(pathPrefix)
	apiRoot.GET("/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"version": version})
	})

	apiRoot.POST("/agents/sessions/:sessionID/messages", agentService.HandleStreamMessage)
	apiRoot.POST("/agents/sessions/:sessionID/approve-tools", agentService.HandleApproveTools)

	webhookRoutes := apiRoot.Group("/webhooks")
	webhookRoutes.Use(needsWebhookSecret(webhookSecret))
	webhookRoutes.POST(
		"/auto-embeddings-configuration",
		webhooks.handleAutoEmbeddingsConfiguration,
	)
	webhookRoutes.POST("/generate-embeddings", webhooks.handleGenerateEmbeddings)

	return router
}

func (h *webhookHandler) handleAutoEmbeddingsConfiguration(c *gin.Context) {
	var event autoEmbeddingsConfigurationWebhookEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		webhookFail(c, http.StatusBadRequest, err)
		return
	}

	config, remove, err := h.resolveAutoEmbeddingsConfiguration(c.Request.Context(), &event)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errUnknownAutoEmbeddingsEventOperation) {
			status = http.StatusBadRequest
		}

		webhookFail(c, status, err)

		return
	}

	if config == nil {
		loggerFromContext(
			c.Request.Context(),
		).InfoContext(c.Request.Context(), "ignoring stale auto-embeddings event")
		c.JSON(http.StatusOK, gin.H{"message": "ok"})

		return
	}

	if err := h.autoAI.SynchAutoEmbeddingsConfiguration(
		c.Request.Context(),
		config,
		remove,
		loggerFromContext(c.Request.Context()),
	); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, autoai.ErrInvalidConfiguration) {
			status = http.StatusUnprocessableEntity
		}

		webhookFail(c, status, err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *webhookHandler) resolveAutoEmbeddingsConfiguration(
	ctx context.Context,
	event *autoEmbeddingsConfigurationWebhookEvent,
) (*hasura.AiAutoEmbeddingsConfigurationFragment, bool, error) {
	switch event.Event.Op {
	case insertEvent, updateEvent:
		response, err := h.hasura.GetAiAutoEmbeddingsConfiguration(
			ctx,
			event.Event.Data.New.ID,
		)
		if err != nil {
			return nil, false, errConfigurationLookup
		}

		return response.GetAiAutoEmbeddingsConfiguration(), false, nil
	case deleteEvent:
		old := event.Event.Data.Old

		return &hasura.AiAutoEmbeddingsConfigurationFragment{
			ID:         old.ID,
			Provider:   "",
			Dimensions: 0,
			LastError:  nil,
			Name:       old.Name,
			Model:      old.Model,
			SchemaName: old.SchemaName,
			TableName:  old.TableName,
			ColumnName: old.ColumnName,
			Query:      nil,
			Mutation:   nil,
			LastRun:    nil,
		}, true, nil
	default:
		return nil, false, fmt.Errorf(
			"%w: %q",
			errUnknownAutoEmbeddingsEventOperation,
			event.Event.Op,
		)
	}
}

func (h *webhookHandler) handleGenerateEmbeddings(c *gin.Context) {
	var request generateEmbeddingsWebhookRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		webhookFail(c, http.StatusBadRequest, errInvalidSearchJSON)
		return
	}

	if request.ConfigurationID == "" && len(request.Model) > 0 {
		loggerFromContext(
			c.Request.Context(),
		).WarnContext(
			c.Request.Context(),
			"old search function contract; restart the ai service to redeploy and check last_error",
		)
		webhookFail(
			c,
			http.StatusBadRequest,
			errOldSearchContract,
		)

		return
	}

	if _, err := uuid.Parse(request.ConfigurationID); err != nil {
		webhookFail(c, http.StatusBadRequest, errInvalidConfigurationID)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), searchRequestTimeout)
	defer cancel()

	response, err := h.hasura.GetAiAutoEmbeddingsConfiguration(ctx, request.ConfigurationID)
	if err != nil {
		loggerFromContext(ctx).WarnContext(ctx, "search configuration lookup failed",
			slog.String("configuration_id", request.ConfigurationID),
			slog.String("error", errConfigurationLookup.Error()))
		webhookFail(c, http.StatusBadGateway, errConfigurationLookup)

		return
	}

	if response == nil || response.AiAutoEmbeddingsConfiguration == nil {
		webhookFail(c, http.StatusNotFound, errConfigurationNotFound)
		return
	}

	config := response.AiAutoEmbeddingsConfiguration

	provider, ok := h.embeddings[config.Provider]
	if !ok {
		webhookFail(
			c,
			http.StatusUnprocessableEntity,
			errEmbeddingProviderUndeclared,
		)

		return
	}

	embeddings, err := generateSearchEmbedding(ctx, provider, config, request.Query)
	if err != nil {
		webhookFail(c, http.StatusBadGateway, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"embeddings": embeddings})
}

func generateSearchEmbedding(
	ctx context.Context,
	provider embedder.Embedder,
	config *hasura.AiAutoEmbeddingsConfigurationFragment,
	query string,
) ([]float32, error) {
	req := embedder.Request{
		Model:      config.Model,
		Inputs:     []string{query},
		Dimensions: int(config.Dimensions),
		Kind:       embedder.Query,
	}

	// Embed validates the response itself: on success it returns one vector of
	// the requested size.
	var vectors [][]float32

	err := embedder.WithRetry(ctx, searchRetry(), func() error {
		var embedErr error

		vectors, embedErr = provider.Embed(ctx, req)

		return embedErr //nolint:wrapcheck // WithRetry classifies provider errors.
	})
	if err != nil {
		fields := []slog.Attr{slog.String("configuration_id", config.ID)}
		if classified, ok := errors.AsType[*embedder.StatusError](err); ok {
			fields = append(
				fields,
				slog.String("error", classified.Error()),
				slog.String("class", string(classified.Class)),
				slog.Int("status", classified.StatusCode),
			)
		} else {
			fields = append(fields, slog.String("error", errEmbeddingProviderRequest.Error()))
		}

		loggerFromContext(ctx).LogAttrs(ctx, slog.LevelWarn, "search embedding failed", fields...)

		return nil, errEmbeddingProviderRequest
	}

	return vectors[0], nil
}

func needsWebhookSecret(webhookSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("X-AI-Webhook-Secret") != webhookSecret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "not authorized"})
			return
		}

		c.Next()
	}
}

func requestLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		requestLogger := logger.With(slog.Group(
			"trace",
			slog.String("trace_id", traceID(c.Request.Header)),
			slog.String("span_id", c.GetHeader("X-B3-SpanId")),
			slog.String("parent_span_id", c.GetHeader("X-B3-ParentSpanId")),
		))
		ctx := context.WithValue(
			c.Request.Context(),
			loggerContextKey{},
			requestLogger.WithGroup("workflow_data"),
		)
		c.Request = c.Request.WithContext(ctx)
		c.Next()

		fields := slog.Group(
			"request",
			slog.Int("status_code", c.Writer.Status()),
			slog.Duration("latency_time", time.Since(startTime)),
			slog.String("client_ip", c.ClientIP()),
			slog.String("method", c.Request.Method),
			slog.String("url", c.Request.RequestURI),
			slog.Any("errors", c.Errors.Errors()),
		)
		if len(c.Errors) > 0 {
			requestLogger.LogAttrs(c, slog.LevelError, "call completed with errors", fields)
			return
		}

		requestLogger.LogAttrs(c, slog.LevelInfo, "call completed", fields)
	}
}

func traceID(headers http.Header) string {
	traceID := headers.Get("X-B3-TraceId")
	if traceID == "" {
		return uuid.NewString()
	}

	return traceID
}

func loggerFromContext(ctx context.Context) *slog.Logger {
	logger, ok := ctx.Value(loggerContextKey{}).(*slog.Logger)
	if !ok {
		return slog.Default()
	}

	return logger
}

func webhookFail(c *gin.Context, status int, err error) {
	c.Error(err) //nolint:errcheck // Gin records the error for request logging.
	c.JSON(status, gin.H{"error": err.Error()})
}
