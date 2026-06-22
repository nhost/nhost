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
