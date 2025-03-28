package graph

import (
	"context"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gin-gonic/gin"
	nhgraphql "github.com/nhost/be/lib/graphql"
	nhhandler "github.com/nhost/be/lib/graphql/handler"
	"github.com/nhost/be/services/mimir/graph/generated"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	graphQLPath = "/graphql"
)

func SetupRouter(
	pathPrefix string,
	resolver *Resolver,
	hasAppVisibilityFunc nhgraphql.Directive,
	hasRole func(context.Context, any, graphql.Resolver, []string) (any, error),
	enablePlayground bool,
	version string,
	fieldMiddleWareList []graphql.FieldMiddleware,
	handlers ...gin.HandlerFunc,
) *gin.Engine {
	r := gin.New()

	for _, handler := range handlers {
		r.Use(handler)
	}

	srv := handler.New(
		generated.NewExecutableSchema(generated.Config{ //nolint: exhaustruct
			Resolvers: resolver,
			Directives: generated.DirectiveRoot{
				HasAppVisibility: hasAppVisibilityFunc,
				HasRole:          hasRole,
			},
		},
		),
	)
	srv.AddTransport(transport.POST{}) //nolint:exhaustruct
	srv.Use(extension.Introspection{})

	for _, middleware := range fieldMiddleWareList {
		srv.AroundFields(middleware)
	}

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	r.GET("/healthz", nhhandler.Healthz(func() error { return nil }))

	apiRoot := r.Group(pathPrefix)
	{
		apiRoot.POST(graphQLPath, nhhandler.Graphql(srv))
		apiRoot.GET(graphQLPath, nhhandler.Graphql(srv))
		if enablePlayground {
			apiRoot.GET("/", nhhandler.Playground(pathPrefix+graphQLPath))
		}
		apiRoot.GET("/version", nhhandler.Version(version))
	}
	return r
}
