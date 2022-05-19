package controller

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type GetFileWithPresignedURLRequest struct {
	fileID    string
	signature string
	headers   getFileInformationHeaders
}

type File struct {
	ContentType   string
	ContentLength int64
	Etag          string
	StatusCode    int
	Body          io.ReadCloser
	ExtraHeaders  http.Header
}

func (ctrl *Controller) getFileWithPresignedURLParse(ctx *gin.Context) (GetFileWithPresignedURLRequest, *APIError) {
	var headers getFileInformationHeaders
	if err := ctx.ShouldBindHeader(&headers); err != nil {
		return GetFileWithPresignedURLRequest{}, InternalServerError(fmt.Errorf("problem parsing request headers: %w", err))
	}

	return GetFileWithPresignedURLRequest{
		fileID:    ctx.Param("id"),
		signature: ctx.Request.URL.RawQuery,
		headers:   headers,
	}, nil
}

func (ctrl *Controller) getFileWithPresignedURL(ctx *gin.Context) (*FileResponse, *APIError) {
	req, apiErr := ctrl.getFileWithPresignedURLParse(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx.Request.Context(),
		req.fileID,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return nil, apiErr
	}

	download, apiErr := ctrl.contentStorage.GetFileWithPresignedURL(
		ctx.Request.Context(),
		req.fileID,
		req.signature,
		ctx.Request.Header,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	opts, apiErr := getImageManipulationOptions(ctx, fileMetadata.MimeType)
	if apiErr != nil {
		return nil, apiErr
	}

	updateAt, apiErr := timeFromRFC3339ToRFC1123(fileMetadata.UpdatedAt)
	if apiErr != nil {
		return nil, apiErr
	}
	if !opts.IsEmpty() {
		defer download.Body.Close()

		download.Body, download.ContentLength, download.Etag, apiErr = ctrl.manipulateImage(
			download.Body, uint64(fileMetadata.Size), opts)
		if apiErr != nil {
			return nil, apiErr
		}

		updateAt = time.Now().Format(time.RFC3339)
	}

	response := NewFileResponse(
		download.ContentType,
		download.ContentLength,
		download.Etag,
		bucketMetadata.CacheControl,
		updateAt,
		download.StatusCode,
		download.Body,
		fileMetadata.Name,
		download.ExtraHeaders,
	)

	return response, nil
}

func (ctrl *Controller) GetFileWithPresignedURL(ctx *gin.Context) {
	fileResponse, apiErr := ctrl.getFileWithPresignedURL(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, GetFileResponse{apiErr.PublicResponse()})

		return
	}

	defer fileResponse.body.Close()

	fileResponse.Write(ctx)
}
