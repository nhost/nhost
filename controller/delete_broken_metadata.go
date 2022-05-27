package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (ctrl *Controller) deleteBrokenMetadata(ctx *gin.Context) ([]FileSummary, *APIError) {
	missing, apiErr := ctrl.listBrokenMetadata(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	for _, m := range missing {
		if apiErr := ctrl.metadataStorage.DeleteFileByID(ctx.Request.Context(), m.ID, ctx.Request.Header); apiErr != nil {
			return nil, apiErr
		}
	}

	return missing, nil
}

func (ctrl *Controller) DeleteBrokenMetadata(ctx *gin.Context) {
	files, apiErr := ctrl.deleteBrokenMetadata(ctx)
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
