package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/openai"
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

type loggerContextKey struct{}

//go:generate mockgen -package mock -destination mock/embeddings_generator.go . embeddingsGenerator
type embeddingsGenerator interface {
	EmbeddingsGenerate(
		ctx context.Context,
		input, embeddingsModel string,
	) ([]float64, error)
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
	embeddings embeddingsGenerator
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
	Query string `json:"query"`
	Model string `json:"model"`
}

func getRouter(
	cCtx *cli.Context,
	autoAI *autoai.AutoAI,
	embeddings *openai.Client,
	hasuraClient *hasura.Client,
	agentService *agents.Service,
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
	agentService *agents.Service,
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

	if agentService != nil {
		apiRoot.POST("/agents/sessions/:sessionID/messages", agentService.HandleStreamMessage)
		apiRoot.POST("/agents/sessions/:sessionID/approve-tools", agentService.HandleApproveTools)
	}

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

	if err := h.autoAI.SynchAutoEmbeddingsConfiguration(
		c.Request.Context(),
		config,
		remove,
		loggerFromContext(c.Request.Context()),
	); err != nil {
		webhookFail(
			c,
			http.StatusInternalServerError,
			fmt.Errorf("synchronizing auto embeddings configuration: %w", err),
		)

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
			return nil, false, fmt.Errorf("getting auto embeddings configuration: %w", err)
		}

		return response.GetAiAutoEmbeddingsConfiguration(), false, nil
	case deleteEvent:
		old := event.Event.Data.Old

		return &hasura.AiAutoEmbeddingsConfigurationFragment{
			ID:         old.ID,
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
		webhookFail(c, http.StatusBadRequest, err)
		return
	}

	embeddings, err := h.embeddings.EmbeddingsGenerate(
		c.Request.Context(),
		request.Query,
		request.Model,
	)
	if err != nil {
		webhookFail(
			c,
			http.StatusInternalServerError,
			fmt.Errorf("generating embeddings: %w", err),
		)

		return
	}

	c.JSON(http.StatusOK, gin.H{"embeddings": embeddings})
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
