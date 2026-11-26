package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const oidcRequestBodyLimit = 32 << 10

// OIDCRequests controls caching, referrers and request size for the OIDC routes.
func OIDCRequests(prefix string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if strings.HasPrefix(ctx.Request.URL.Path, prefix+"/signin/oidc/") ||
			strings.HasPrefix(ctx.Request.URL.Path, prefix+"/signup/oidc/") {
			ctx.Header("Cache-Control", "no-store")
			ctx.Header("Referrer-Policy", "no-referrer")

			if ctx.Request.Method == http.MethodPost {
				ctx.Request.Body = http.MaxBytesReader(
					ctx.Writer,
					ctx.Request.Body,
					oidcRequestBodyLimit,
				)
			}
		}

		ctx.Next()
	}
}
