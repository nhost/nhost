package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (ctrl *Controller) listNotUploaded(ctx *gin.Context) ([]FileSummary, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(
		ctx.Request.Context(),
		ctx.Request.Header,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]FileSummary, 0, 10) //nolint: mnd

	for _, fileHasura := range filesInHasura {
		if !fileHasura.IsUploaded {
			missing = append(missing, fileHasura)
		}
	}

	return missing, nil
}

func (ctrl *Controller) ListNotUploaded(ctx *gin.Context) {
	files, apiErr := ctrl.listNotUploaded(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, apiErr.PublicResponse())

		return
	}

	ctx.JSON(
		http.StatusOK,
		ListBrokenMetadataResponse{
			files,
		},
	)
}
