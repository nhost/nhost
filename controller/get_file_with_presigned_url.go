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
		return 0, BadDataError(
			errors.New("signature already expired"), //nolint: goerr113
			"signature already expired",
		)
	}

	return int(expires.Seconds()), nil
}

func (ctrl *Controller) getFileWithPresignedURLParse(
	ctx *gin.Context,
) (GetFileWithPresignedURLRequest, *APIError) {
	var headers getFileInformationHeaders
	if err := ctx.ShouldBindHeader(&headers); err != nil {
		return GetFileWithPresignedURLRequest{}, //nolint: exhaustruct
			InternalServerError(fmt.Errorf("problem parsing request headers: %w", err))
	}

	expires, apiErr := expiresIn(ctx.Request.URL.Query())
	if apiErr != nil {
		return GetFileWithPresignedURLRequest{}, apiErr //nolint: exhaustruct
	}

	signature := make(url.Values, len(ctx.Request.URL.Query()))
	for k, v := range ctx.Request.URL.Query() {
		switch k {
		case "w", "h", "q", "b", "f":
		default:
			signature[k] = v
		}
	}

	return GetFileWithPresignedURLRequest{
		fileID:    ctx.Param("id"),
		signature: signature.Encode(),
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
		true,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return nil, apiErr
	}

	downloadFunc := func() (*File, *APIError) {
		return ctrl.contentStorage.GetFileWithPresignedURL(
			ctx.Request.Context(),
			req.fileID,
			req.signature,
			ctx.Request.Header,
		)
	}
	if apiErr != nil {
		return nil, apiErr
	}

	return ctrl.processFileToDownload(
		ctx,
		downloadFunc,
		fileMetadata,
		fmt.Sprintf("max-age=%d", req.Expires),
		nil,
	)
}

func (ctrl *Controller) GetFileWithPresignedURL(ctx *gin.Context) {
	fileResponse, apiErr := ctrl.getFileWithPresignedURL(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, GetFileResponse{apiErr.PublicResponse()})

		return
	}

	defer fileResponse.body.Close()

	fileResponse.disableSurrageControlHeader = true
	fileResponse.Write(ctx)
}
