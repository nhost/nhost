package controller

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Only used if the request fails.
type getFileResponse struct {
	Error *ErrorResponse `json:"error"`
}

func (ctrl *Controller) GetFile(ctx *gin.Context) {
	filepath, statusCode, apiErr := ctrl.getFileInformationProcess(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, getFileResponse{apiErr.PublicResponse()})

		return
	}

	object, apiErr := ctrl.contentStorage.GetFile(filepath)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem getting file: %w", apiErr))

		ctx.JSON(apiErr.statusCode, getFileResponse{apiErr.PublicResponse()})

		return
	}
	defer object.Close()

	if statusCode == http.StatusOK {
		if _, err := io.Copy(ctx.Writer, object); err != nil {
			_ = ctx.Error(fmt.Errorf("problem writing response: %w", err))

			ctx.JSON(http.StatusInternalServerError, getFileResponse{InternalServerError(err).PublicResponse()})

			return
		}
	}

	ctx.AbortWithStatus(statusCode)
}
