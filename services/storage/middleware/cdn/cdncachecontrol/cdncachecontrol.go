package cdncachecontrol

import (
	"github.com/gin-gonic/gin"
)

const (
	headerCDNCacheControl = "CDN-Cache-Control"
	cacheControl          = "must-revalidate, no-cache"
)

func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Next()

		ctx.Writer.Header().Set(headerCDNCacheControl, cacheControl)
	}
}
