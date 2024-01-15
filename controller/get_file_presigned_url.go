package controller

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type GetFilePresignedURLResponse struct {
	Error      *ErrorResponse `json:"error,omitempty"`
	URL        string         `json:"url,omitempty"`
	Expiration int            `json:"expiration,omitempty"`
}

type GetFilePresignedURLRequest struct {
	FileID string
}

func (ctrl *Controller) getFilePresignedURLParse(ctx *gin.Context) GetFilePresignedURLRequest {
	return GetFilePresignedURLRequest{
		FileID: ctx.Param("id"),
	}
}

func (ctrl *Controller) getFilePresignedURL(
	ctx *gin.Context,
) (GetFilePresignedURLResponse, *APIError) {
	req := ctrl.getFilePresignedURLParse(ctx)

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx.Request.Context(), req.FileID, true, ctx.Request.Header,
	)
	if apiErr != nil {
		return GetFilePresignedURLResponse{}, apiErr
	}

	if !bucketMetadata.PresignedURLsEnabled {
		err := errors.New( //nolint: goerr113
			"presigned URLs are not enabled on the bucket where this file is located in",
		)
		return GetFilePresignedURLResponse{}, ForbiddenError(err, err.Error())
	}

	signature, apiErr := ctrl.contentStorage.CreatePresignedURL(
		ctx,
		fileMetadata.ID,
		time.Duration(bucketMetadata.DownloadExpiration)*time.Second,
	)
	if apiErr != nil {
		return GetFilePresignedURLResponse{},
			apiErr.ExtendError(
				fmt.Sprintf("problem creating presigned URL for file %s", fileMetadata.Name),
			)
	}

	url := fmt.Sprintf(
		"%s%s/files/%s/presignedurl/content?%s",
		ctrl.publicURL, ctrl.apiRootPrefix, fileMetadata.ID, signature,
	)
	return GetFilePresignedURLResponse{nil, url, bucketMetadata.DownloadExpiration}, nil
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
