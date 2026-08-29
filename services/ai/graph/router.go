package graph

import (
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/graph/generated"
	"github.com/nhost/nhost/services/ai/graph/middleware"
)

const (
	graphQLPath = "/graphql"
)

func healthzHandler() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"healthz": "ok",
		})
	}
}

func graphqlHandler(srv *handler.Server) gin.HandlerFunc {
	return func(c *gin.Context) {
		srv.ServeHTTP(c.Writer, c.Request)
	}
}

func playgroundHandler(path string) gin.HandlerFunc {
	h := playground.Handler("GraphQL", path)

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func versionHandler(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(
			http.StatusOK,
			struct {
				Version string `json:"version"`
			}{
				Version: version,
			},
		)
	}
}

func SetupRouter(
	pathPrefix string,
	resolver *Resolver,
	agentService *agents.Service,
	enablePlayground bool,
	version string,
	webhookHandlers []gin.HandlerFunc,
	handlers ...gin.HandlerFunc,
) *gin.Engine {
	r := gin.New()

	for _, handler := range handlers {
		r.Use(handler)
	}

	srv := handler.New(
		generated.NewExecutableSchema(
			generated.Config{
				Schema:    nil,
				Resolvers: resolver,
				Directives: generated.DirectiveRoot{
					IsAdmin: middleware.IsAdminDirective,
				},
				Complexity: generated.ComplexityRoot{}, //nolint:exhaustruct
			},
		),
	)
	srv.AddTransport(transport.POST{}) //nolint:exhaustruct
	srv.Use(extension.Introspection{})

	r.GET("/healthz", healthzHandler())

	apiRoot := r.Group(pathPrefix)
	apiRoot.POST(graphQLPath, graphqlHandler(srv))
	apiRoot.GET(graphQLPath, graphqlHandler(srv))

	if enablePlayground {
		apiRoot.GET("/", playgroundHandler(pathPrefix+graphQLPath))
	}

	apiRoot.GET("/version", versionHandler(version))

	if agentService != nil {
		apiRoot.POST("/agents/sessions/:sessionID/messages", agentService.HandleStreamMessage)
		apiRoot.POST("/agents/sessions/:sessionID/approve-tools", agentService.HandleApproveTools)
	}

	webhooks := apiRoot.Group("/webhooks")
	webhooks.Use(webhookHandlers...)
	webhooks.POST(
		"/auto-embeddings-configuration",
		resolver.HandleAutoEmbeddingsConfigurationWebhook,
	)
	webhooks.POST("/generate-embeddings", resolver.HandleGenerateEmbeddingsWebhook)
	webhooks.POST("/storage-files", resolver.HandleStorageFilesWebhook)
	webhooks.POST("/file-store-buckets", resolver.HandleFileStoreBucketsWebhook)

	return r
}
