// Package requestcontext stores request-scoped HTTP client headers in a
// [context.Context], with awareness of [*gin.Context] so values stashed on the
// underlying [*http.Request] context are still retrievable when callers pass the
// gin context directly. Context keys are unexported, so external callers cannot
// install a wrong-typed value under these keys; a failed type assertion
// therefore means "not present" and is surfaced as a nil header map.
//
// The request logger lives in [github.com/nhost/nhost/internal/lib/oapi/middleware]
// (LoggerToContext/LoggerFromContext/AddLoggerAttrs); use that directly.
package requestcontext

import (
	"context"
	"net/http"
	"slices"
	"sync"

	"github.com/gin-gonic/gin"
)

// clientHeadersCtxKey keys the [http.Header] stashed by [ClientHeadersToContext]
// and read back by [ClientHeadersFromContext].
type clientHeadersCtxKey struct{}

// ClientHeadersFromContext retrieves the client HTTP headers from context.
func ClientHeadersFromContext(
	ctx context.Context, //nolint:contextcheck // gin.Context unwrap to request ctx is intentional; see package doc
) http.Header {
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	headers, ok := ctx.Value(clientHeadersCtxKey{}).(http.Header)
	if !ok {
		return nil
	}

	return headers
}

// ClientHeadersToContext stores the client HTTP headers in the context.
func ClientHeadersToContext(ctx context.Context, headers http.Header) context.Context {
	return context.WithValue(ctx, clientHeadersCtxKey{}, headers)
}

// responseHeaderCollectorCtxKey keys the [*ResponseHeaderCollector] stashed by
// [ResponseHeaderCollectorToContext] and read back by
// [ResponseHeaderCollectorFromContext].
type responseHeaderCollectorCtxKey struct{}

// ResponseHeaderCollector accumulates Set-Cookie values that action webhooks
// want forwarded to the GraphQL client. Only Set-Cookie is collected, mirroring
// Hasura's mkSetCookieHeaders (graphql-engine GraphQL.Execute.Action): arbitrary
// webhook response headers are never relayed to the client. It is safe for
// concurrent use because a single GraphQL operation may fan out to several
// connectors.
type ResponseHeaderCollector struct {
	mu      sync.Mutex
	cookies []string
}

// AddSetCookies records the Set-Cookie values from a webhook response. A nil
// collector is a no-op, so callers can unconditionally collect even when no
// collector was installed in the context.
func (c *ResponseHeaderCollector) AddSetCookies(header http.Header) {
	if c == nil {
		return
	}

	values := header.Values("Set-Cookie")
	if len(values) == 0 {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cookies = append(c.cookies, values...)
}

// SetCookies returns a copy of the accumulated Set-Cookie values in collection
// order. A nil collector returns nil.
func (c *ResponseHeaderCollector) SetCookies() []string {
	if c == nil {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	return slices.Clone(c.cookies)
}

// ResponseHeaderCollectorToContext stores the collector in the context so
// downstream connectors can record headers to forward to the client.
func ResponseHeaderCollectorToContext(
	ctx context.Context, collector *ResponseHeaderCollector,
) context.Context {
	return context.WithValue(ctx, responseHeaderCollectorCtxKey{}, collector)
}

// ResponseHeaderCollectorFromContext retrieves the collector from context, or
// nil if none is present. A nil result is safe to call AddSetCookies on.
func ResponseHeaderCollectorFromContext(
	ctx context.Context, //nolint:contextcheck // gin.Context unwrap to request ctx is intentional; see package doc
) *ResponseHeaderCollector {
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	collector, ok := ctx.Value(responseHeaderCollectorCtxKey{}).(*ResponseHeaderCollector)
	if !ok {
		return nil
	}

	return collector
}

// graphQLQueryCtxKey keys the original GraphQL document string stashed by
// [GraphQLQueryToContext] and read back by [GraphQLQueryFromContext].
type graphQLQueryCtxKey struct{}

// GraphQLQueryToContext stores the original client GraphQL document string in
// the context. Action webhooks forward it as the request payload's query field.
func GraphQLQueryToContext(ctx context.Context, query string) context.Context {
	return context.WithValue(ctx, graphQLQueryCtxKey{}, query)
}

// GraphQLQueryFromContext retrieves the original client GraphQL document string
// from context, or "" if none is present.
func GraphQLQueryFromContext(
	ctx context.Context, //nolint:contextcheck // gin.Context unwrap to request ctx is intentional; see package doc
) string {
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	query, ok := ctx.Value(graphQLQueryCtxKey{}).(string)
	if !ok {
		return ""
	}

	return query
}
