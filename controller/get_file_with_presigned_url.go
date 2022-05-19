package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	amzDateFormat = "20060102T150405Z"
)

type GetFileWithPresignedURLRequest struct {
	fileID    string
	signature string
	headers   getFileInformationHeaders
	Expires   int
}

type File struct {
	ContentType   string
	ContentLength int64
	Etag          string
	StatusCode    int
	Body          io.ReadCloser
	ExtraHeaders  http.Header
}

func expiresIn(urlValues url.Values) (int, *APIError) {
	amzExpires, err := strconv.Atoi(urlValues.Get("X-Amz-Expires"))
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("problem parsing X-Amz-Expires: %s", err))
	}

	date, err := time.Parse(amzDateFormat, urlValues.Get("X-Amz-Date"))
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("problem parsing X-Amz-Date: %s", err))
	}

	expires := time.Second*time.Duration(amzExpires) - time.Since(date)

	if expires <= 0 {
		return 0, BadDataError(errors.New("signature already expired"), "signature already expired") // nolint: goerr113
	}

	return int(expires.Seconds()), nil
}

func (ctrl *Controller) getFileWithPresignedURLParse(ctx *gin.Context) (GetFileWithPresignedURLRequest, *APIError) {
	var headers getFileInformationHeaders
	if err := ctx.ShouldBindHeader(&headers); err != nil {
		return GetFileWithPresignedURLRequest{}, InternalServerError(fmt.Errorf("problem parsing request headers: %w", err))
	}

	expires, apiErr := expiresIn(ctx.Request.URL.Query())
	if apiErr != nil {
		return GetFileWithPresignedURLRequest{}, apiErr
	}

	return GetFileWithPresignedURLRequest{
		fileID:    ctx.Param("id"),
		signature: ctx.Request.URL.RawQuery,
		headers:   headers,
		Expires:   expires,
	}, nil
}

func (ctrl *Controller) getFileWithPresignedURL(ctx *gin.Context) (*FileResponse, *APIError) {
	req, apiErr := ctrl.getFileWithPresignedURLParse(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	fileMetadata, _, apiErr := ctrl.getFileMetadata(
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
		fmt.Sprintf("max-age=%d", req.Expires),
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
