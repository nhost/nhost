package cdncachecontrol

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	headerCDNCacheControl   = "CDN-Cache-Control"
	headerAuthorization     = "Authorization"
	headerHasuraAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec
	cacheControlPrivate     = "must-revalidate, no-cache"
)

func hasAuthHeaders(r *http.Request) bool {
	return r.Header.Get(headerAuthorization) != "" ||
		r.Header.Get(headerHasuraAdminSecret) != ""
}

type writer struct {
	gin.ResponseWriter

	value string
	wrote bool
}

func (w *writer) setHeader() {
	if !w.wrote {
		w.wrote = true

		if w.Status() < http.StatusBadRequest && w.value != "" {
			w.Header().Set(headerCDNCacheControl, w.value)
		}
	}
}

func (w *writer) Write(data []byte) (int, error) {
	w.setHeader()

	return w.ResponseWriter.Write(data) //nolint:wrapcheck
}

func (w *writer) WriteString(s string) (int, error) {
	w.setHeader()

	return w.ResponseWriter.WriteString(s) //nolint:wrapcheck
}

func (w *writer) WriteHeaderNow() {
	w.setHeader()
	w.ResponseWriter.WriteHeaderNow()
}

func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var value string
		if hasAuthHeaders(ctx.Request) {
			value = cacheControlPrivate
		}

		ctx.Writer = &writer{
			ResponseWriter: ctx.Writer,
			value:          value,
			wrote:          false,
		}

		ctx.Next()
	}
}
