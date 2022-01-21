package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ListOrphansResponse struct {
	Files []string `json:"files"`
}

func (ctrl *Controller) listOrphans(ctx *gin.Context) ([]string, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(ctx.Request.Context(), ctx.Request.Header)
	if apiErr != nil {
		return nil, apiErr
	}

	filesInS3, apiErr := ctrl.contentStorage.ListFiles()
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]string, 0, 10) // nolint: gomnd

	for _, fileS3 := range filesInS3 {
		found := false
		for _, fileHasura := range filesInHasura {
			if fileS3 == fileHasura.BucketID+"/"+fileHasura.ID {
				found = true
				break
			}
		}
		if !found {
			missing = append(missing, fileS3)
		}
	}

	return missing, nil
}

func (ctrl *Controller) ListOrphans(ctx *gin.Context) {
	files, apiErr := ctrl.listOrphans(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, apiErr.PublicResponse())

		return
	}

	ctx.JSON(
		http.StatusOK,
		ListOrphansResponse{
			files,
		},
	)
}
