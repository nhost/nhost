package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
)

type ginCtxKey struct{}

// GinToContext stores the gin context in the context.
func GinToContext(ctx context.Context, c *gin.Context) context.Context {
	return context.WithValue(ctx, ginCtxKey{}, c)
}

// GinFromContext retrieves the gin context from the context, returns nil if not found.
func GinFromContext(ctx context.Context) *gin.Context {
	c, ok := ctx.Value(ginCtxKey{}).(*gin.Context)
	if !ok {
		return nil
	}

	return c
}

func GinContext(ctx *gin.Context) {
	ctx.Request = ctx.Request.WithContext(
		GinToContext(ctx.Request.Context(), ctx),
	)
	ctx.Next()
}
