package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// this type is used to ensure we respond consistently no matter the case.
type DeleteFileResponse struct {
	ProcessedFile FileMetadata `json:"processedFile,omitempty"`
}

func (ctrl *Controller) deleteFile(ctx *gin.Context) (FileMetadata, *APIError) {
	id := ctx.Param("id")

	fileMetadata, apiErr := ctrl.metadataStorage.DeleteFileByID(ctx.Request.Context(), id, ctx.Request.Header)
	if apiErr != nil {
		return FileMetadata{}, apiErr
	}

	if apiErr := ctrl.contentStorage.DeleteFile(fileMetadata.ID); apiErr != nil {
		return FileMetadata{}, apiErr
	}

	ctx.Set("FileChanged", id)

	return fileMetadata.FileMetadata, nil
}

func (ctrl *Controller) DeleteFile(ctx *gin.Context) {
	fileMetadata, apiErr := ctrl.deleteFile(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, apiErr.PublicResponse())

		return
	}

	ctx.JSON(http.StatusNoContent, DeleteFileResponse{fileMetadata})
}
