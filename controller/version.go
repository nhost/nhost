package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

var (
	buildVersion string
	buildCommit  string
	buildDate    string
	buildBranch  string
	buildUser    string
)

func Version() string {
	if buildBranch == "main" {
		return buildVersion
	}
	return fmt.Sprintf("%s+%s.%s", buildVersion, buildDate, buildBranch)
}

type VersionResponse struct {
	BuildVersion string `json:"buildVersion"`
	BuildDate    string `json:"buildDate"`
	BuildCommit  string `json:"buildCommit"`
	BuildBranch  string `json:"buildBranch"`
	BuildUser    string `json:"buildUser"`
}

func (ctrl *Controller) Version(ctx *gin.Context) {
	ctx.JSON(
		http.StatusOK,
		VersionResponse{
			BuildVersion: buildVersion,
			BuildDate:    buildDate,
			BuildCommit:  buildCommit,
			BuildBranch:  buildBranch,
			BuildUser:    buildUser,
		},
	)
}
