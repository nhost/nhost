package controller

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/api"
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

func (ctrl *Controller) GetVersion( //nolint:ireturn
	_ context.Context,
	_ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{
		BuildVersion: buildVersion,
	}, nil
}
