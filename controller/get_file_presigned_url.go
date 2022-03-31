package controller

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type GetFilePresignedURLResponse struct {
	Error      *ErrorResponse `json:"error"`
	URL        string         `json:"url"`
	Expiration int            `json:"expiration"`
}

type GetFilePresignedURLRequest struct {
	FileID string
}

func (ctrl *Controller) getFilePresignedURLParse(ctx *gin.Context) GetFilePresignedURLRequest {
	return GetFilePresignedURLRequest{
		FileID: ctx.Param("id"),
	}
}

func (ctrl *Controller) getFilePresignedURL(ctx *gin.Context) (GetFilePresignedURLResponse, *APIError) {
	req := ctrl.getFilePresignedURLParse(ctx)

	fileMetadata, apiErr := ctrl.metadataStorage.GetFileByID(ctx.Request.Context(), req.FileID, ctx.Request.Header)
	if apiErr != nil {
		return GetFilePresignedURLResponse{}, apiErr
	}

	if !fileMetadata.Bucket.PresignedURLsEnabled {
		err := errors.New("presigned URLs are not enabled on the bucket where this file is located in") // nolint: goerr113
		return GetFilePresignedURLResponse{}, ForbiddenError(err, err.Error())
	}

	url, apiErr := ctrl.contentStorage.CreatePresignedURL(
		fileMetadata.ID,
		time.Duration(fileMetadata.Bucket.DownloadExpiration)*time.Minute,
	)
	if apiErr != nil {
		return GetFilePresignedURLResponse{},
			apiErr.ExtendError(fmt.Sprintf("problem creating presigned URL for file %s", fileMetadata.Name))
	}

	return GetFilePresignedURLResponse{nil, url, fileMetadata.Bucket.DownloadExpiration}, nil
}

func (ctrl *Controller) GetFilePresignedURL(ctx *gin.Context) {
	resp, apiErr := ctrl.getFilePresignedURL(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, GetFilePresignedURLResponse{Error: apiErr.PublicResponse()})

		return
	}

	ctx.JSON(http.StatusOK, resp)
}
