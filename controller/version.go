package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var buildVersion string

func Version() string {
	return buildVersion
}

type VersionResponse struct {
	BuildVersion string `json:"buildVersion"`
}

func (ctrl *Controller) Version(ctx *gin.Context) {
	ctx.JSON(
		http.StatusOK,
		VersionResponse{
			BuildVersion: buildVersion,
		},
	)
}
