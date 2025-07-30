package nhcontext

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gin-gonic/gin"
)

type contextKey string

const (
	ginContextKey         = contextKey("gin.Context")
	initPayloadHeadersKey = contextKey("init_payload_http_headers")
)

// gin middleware to store the gin.Context in the context
// the purpose is to be able to retrieve the gin.Context from other parts
// in the graphql code as the gin context may have useful information (i.e. http headers).
func GinContextToContextMiddleware(c *gin.Context) {
	ctx := context.WithValue(c.Request.Context(), ginContextKey, c)
	c.Request = c.Request.WithContext(ctx)
	c.Next()
}

// GinContextToContext adds gin.Context to the context.
func GinContextToContext(ctx context.Context, ginCtx *gin.Context) context.Context {
	return context.WithValue(ctx, ginContextKey, ginCtx)
}

// ginContextFromContext returns the gin.Context from the context.
func GinContextFromContext(ctx context.Context) (*gin.Context, error) {
	ginContext := ctx.Value(ginContextKey)
	if ginContext == nil {
		err := errors.New("could not retrieve gin.Context") //nolint: err113
		return nil, err
	}

	gc, ok := ginContext.(*gin.Context)
	if !ok {
		err := errors.New("gin.Context has wrong type") //nolint: err113
		return nil, err
	}

	return gc, nil
}

// Gets the HTTP headers from a gin context embedded in the context.
func HTTPHeaderFromGinContext(ctx context.Context) (http.Header, error) {
	raw := ctx.Value(initPayloadHeadersKey)
	if raw != nil {
		headers, ok := raw.(http.Header)
		if !ok {
			return nil, ErrWrongTypeHTTPHeader
		}

		return headers, nil
	}

	ginContext, err := GinContextFromContext(ctx)
	if err != nil {
		return nil, err
	}

	return ginContext.Request.Header, nil
}

// This is meant to be used as a transport.WebsocketInitFunc. It will store the "headers"
// in the init payload in the context so that they can be retrieved later using HTTPHeaderFromGinContext.
func WebSocketInit(
	ctx context.Context,
	initPayload transport.InitPayload,
) (context.Context, *transport.InitPayload, error) {
	raw, found := initPayload["headers"]
	if !found {
		return ctx, nil, nil
	}

	data, ok := raw.(map[string]any)
	if !ok {
		return ctx, nil, ErrWrongTypeHTTPHeader
	}

	headers := http.Header{}

	for k, v := range data {
		headers.Set(k, fmt.Sprintf("%v", v))
	}

	return context.WithValue(ctx, initPayloadHeadersKey, headers), nil, nil
}
