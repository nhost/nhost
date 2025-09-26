package nhmiddleware

import (
	"github.com/gin-gonic/gin"
	nhtracing "github.com/nhost/be/lib/tracing"
)

func Tracing(ctx *gin.Context) {
	trace := nhtracing.FromHTTPHeaders(ctx.Request.Header)

	ctx.Request = ctx.Request.WithContext(
		nhtracing.ToContext(ctx.Request.Context(), trace),
	)

	ctx.Next()
}
