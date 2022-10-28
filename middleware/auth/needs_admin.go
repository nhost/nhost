package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func isAdmin(hasuraAdminSecret string, header http.Header) bool {
	return header.Get("X-Hasura-Admin-Secret") == hasuraAdminSecret &&
		(header.Get("X-Hasura-Role") == "admin" ||
			header.Get("X-Hasura-Role") == "")
}

func NeedsAdmin(prefixPath, hasuraAdminSecret string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if strings.HasPrefix(ctx.Request.URL.Path, prefixPath) &&
			!isAdmin(hasuraAdminSecret, ctx.Request.Header) {
			ctx.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		ctx.Next()
	}
}
