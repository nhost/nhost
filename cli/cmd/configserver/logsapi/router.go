package logsapi

import (
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	nhhandler "github.com/nhost/be/lib/graphql/handler"
	"github.com/nhost/nhost/cli/cmd/configserver/logsapi/generated"
)

const (
	graphQLPath           = "/graphql"
	wsKeepAlivePingPeriod = 10 * time.Second
)

// AddRoutes adds the logs GraphQL endpoint to an existing gin engine.
func AddRoutes(
	r *gin.Engine,
	pathPrefix string,
	resolver *Resolver,
	enablePlayground bool,
	version string,
) {
	srv := handler.New(
		generated.NewExecutableSchema(generated.Config{ //nolint:exhaustruct
			Resolvers: resolver,
		}),
	)
	srv.AddTransport(transport.POST{})    //nolint:exhaustruct
	srv.AddTransport(transport.Websocket{ //nolint:exhaustruct
		KeepAlivePingInterval: wsKeepAlivePingPeriod,
		Upgrader: websocket.Upgrader{ //nolint:exhaustruct
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
	})
	srv.Use(extension.Introspection{})

	apiRoot := r.Group(pathPrefix)
	{
		apiRoot.POST(graphQLPath, nhhandler.Graphql(srv))
		apiRoot.GET(graphQLPath, nhhandler.Graphql(srv))

		if enablePlayground {
			apiRoot.GET("/", nhhandler.Playground(pathPrefix+graphQLPath))
		}

		apiRoot.GET("/version", nhhandler.Version(version))
	}
}
