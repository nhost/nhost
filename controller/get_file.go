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
		if _, e := io.Copy(ctx.Writer, object); e != nil {
			_ = ctx.Error(fmt.Errorf("problem writing response: %w", e))

			ctx.JSON(apiErr.statusCode, getFileResponse{apiErr.PublicResponse()})

			return
		}
	}

	ctx.AbortWithStatus(statusCode)
}
