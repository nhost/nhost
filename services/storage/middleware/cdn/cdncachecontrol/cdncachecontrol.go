package cdncachecontrol

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	headerCDNCacheControl   = "CDN-Cache-Control"
	headerAuthorization     = "Authorization"
	headerHasuraAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec
	cacheControl            = "must-revalidate, no-cache"
)

func hasAuthHeaders(r *http.Request) bool {
	return r.Header.Get(headerAuthorization) != "" ||
		r.Header.Get(headerHasuraAdminSecret) != ""
}

func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Next()

		if hasAuthHeaders(ctx.Request) {
			ctx.Writer.Header().Set(headerCDNCacheControl, cacheControl)
		}
	}
}
