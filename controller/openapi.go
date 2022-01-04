package controller

import (
	"bytes"
	_ "embed"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

//go:embed openapi.yaml
var openapi []byte

func (ctrl *Controller) OpenAPI(ctx *gin.Context) {
	content := bytes.NewReader(openapi)
	http.ServeContent(
		ctx.Writer,
		ctx.Request,
		"openapi.yaml",
		time.Now(), // we should inject this at compile time
		content,
	)
}
