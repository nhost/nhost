package logsapi

import (
	"net/http"
	"net/url"
	"strings"
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

// checkWebSocketOrigin only accepts WebSocket upgrades from the local dashboard
// hosts the configserver is exposed under, plus plain localhost. Without this
// any page the user visits during `nhost dev` could open a subscription and
// exfiltrate container logs, which routinely contain secrets.
func checkWebSocketOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}

	u, err := url.Parse(origin)
	if err != nil {
		return false
	}

	host := u.Hostname()

	return strings.HasSuffix(host, ".dashboard.local.nhost.run") ||
		host == "local.dashboard.nhost.run" ||
		host == "localhost" ||
		host == "127.0.0.1"
}

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
			CheckOrigin: checkWebSocketOrigin,
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
