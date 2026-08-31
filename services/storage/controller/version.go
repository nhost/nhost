package controller

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/api"
)

var buildVersion string

func Version() string {
	return buildVersion
}

// SetBuildVersion sets the reported build version when it was not injected at
// build time via ldflags. The ldflag value used by standalone builds takes
// precedence, so this is a no-op there. It lets the engine unified binary,
// which only sets its own main.Version, still report a storage version at
// /v1/version instead of an empty string.
func SetBuildVersion(version string) {
	if buildVersion == "" {
		buildVersion = version
	}
}

type VersionResponse struct {
	Version string `json:"version"`
}

func (ctrl *Controller) Version(ctx *gin.Context) {
	ctx.JSON(
		http.StatusOK,
		VersionResponse{
			Version: buildVersion,
		},
	)
}

func (ctrl *Controller) GetVersion( //nolint:ireturn
	_ context.Context,
	_ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{
		Version: buildVersion,
	}, nil
}
