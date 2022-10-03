package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ListBrokenMetadataResponse struct {
	Metadata []FileSummary `json:"metadata"`
}

func (ctrl *Controller) listBrokenMetadata(ctx *gin.Context) ([]FileSummary, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(ctx.Request.Context(), ctx.Request.Header)
	if apiErr != nil {
		return nil, apiErr
	}

	filesInS3, apiErr := ctrl.contentStorage.ListFiles()
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]FileSummary, 0, 10) //nolint: gomnd

	for _, fileHasura := range filesInHasura {
		found := false

		for _, fileS3 := range filesInS3 {
			if fileS3 == fileHasura.BucketID+"/"+fileHasura.ID || !fileHasura.IsUploaded {
				found = true
			}
		}

		if !found {
			missing = append(missing, fileHasura)
		}
	}

	return missing, nil
}

func (ctrl *Controller) ListBrokenMetadata(ctx *gin.Context) {
	files, apiErr := ctrl.listBrokenMetadata(ctx)
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
