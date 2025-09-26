// Package cors/wrapper/gin provides gin.HandlerFunc to handle CORS related
// requests as a wrapper of github.com/rs/cors handler.
package gin

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
)

// Options is a configuration container to setup the CORS middleware.
type Options = cors.Options

// corsWrapper is a wrapper of cors.Cors handler which preserves information
// about configured 'optionPassthrough' option.
type corsWrapper struct {
	*cors.Cors
	optionsSuccessStatus int
	optionsPassthrough   bool
}

// build transforms wrapped cors.Cors handler into Gin middleware.
func (c corsWrapper) build() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		c.HandlerFunc(ctx.Writer, ctx.Request)
		if !c.optionsPassthrough &&
			ctx.Request.Method == http.MethodOptions &&
			ctx.GetHeader("Access-Control-Request-Method") != "" {
			// Abort processing next Gin middlewares.
			ctx.AbortWithStatus(c.optionsSuccessStatus)
		}
	}
}

// AllowAll creates a new CORS Gin middleware with permissive configuration
// allowing all origins with all standard methods with any header and
// credentials.
func AllowAll() gin.HandlerFunc {
	return corsWrapper{Cors: cors.AllowAll()}.build()
}

// Default creates a new CORS Gin middleware with default options.
func Default() gin.HandlerFunc {
	return corsWrapper{Cors: cors.Default()}.build()
}

// New creates a new CORS Gin middleware with the provided options.
func New(options Options) gin.HandlerFunc {
	status := options.OptionsSuccessStatus
	if status == 0 {
		status = http.StatusNoContent
	}
	wrapper := corsWrapper{
		Cors:                 cors.New(options),
		optionsSuccessStatus: status,
		optionsPassthrough:   options.OptionsPassthrough,
	}
	return wrapper.build()
}
