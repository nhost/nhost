package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

const (
	amzDateFormat = "20060102T150405Z"
)

type File struct {
	ContentType   string
	ContentLength int64
	Etag          string
	StatusCode    int
	Body          io.ReadCloser
	ExtraHeaders  http.Header
}

func expiresIn(xAmzExpires string, datestr string) (int, *APIError) {
	amzExpires, err := strconv.Atoi(xAmzExpires)
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("problem parsing X-Amz-Expires: %s", err))
	}

	date, err := time.Parse(amzDateFormat, datestr)
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("problem parsing X-Amz-Date: %s", err))
	}

	expires := time.Second*time.Duration(amzExpires) - time.Since(date)

	if expires <= 0 {
		return 0, BadDataError(
			errors.New("signature already expired"), //nolint: err113
			"signature already expired",
		)
	}

	return int(expires.Seconds()), nil
}

func getAmazonSignature(request api.GetFileWithPresignedURLRequestObject) string {
	if request.Params.XAmzSecurityToken == nil {
		return fmt.Sprintf(
			"X-Amz-Algorithm=%s&X-Amz-Credential=%s&X-Amz-Date=%s&X-Amz-Expires=%s&X-Amz-Signature=%s&X-Amz-SignedHeaders=%s&X-Amz-Checksum-Mode=%s&x-id=%s", //nolint:lll
			url.QueryEscape(request.Params.XAmzAlgorithm),
			url.QueryEscape(request.Params.XAmzCredential),
			url.QueryEscape(request.Params.XAmzDate),
			url.QueryEscape(request.Params.XAmzExpires),
			url.QueryEscape(request.Params.XAmzSignature),
			url.QueryEscape(request.Params.XAmzSignedHeaders),
			url.QueryEscape(request.Params.XAmzChecksumMode),
			url.QueryEscape(request.Params.XId),
		)
	}

	return fmt.Sprintf(
		"X-Amz-Algorithm=%s&X-Amz-Credential=%s&X-Amz-Date=%s&X-Amz-Expires=%s&X-Amz-Signature=%s&X-Amz-SignedHeaders=%s&X-Amz-Security-Token=%s&X-Amz-Checksum-Mode=%s&x-id=%s", //nolint:lll
		url.QueryEscape(request.Params.XAmzAlgorithm),
		url.QueryEscape(request.Params.XAmzCredential),
		url.QueryEscape(request.Params.XAmzDate),
		url.QueryEscape(request.Params.XAmzExpires),
		url.QueryEscape(request.Params.XAmzSignature),
		url.QueryEscape(request.Params.XAmzSignedHeaders),
		url.QueryEscape(deptr(request.Params.XAmzSecurityToken)),
		url.QueryEscape(request.Params.XAmzChecksumMode),
		url.QueryEscape(request.Params.XId),
	)
}

func (ctrl *Controller) getFileWithPresignedURLResponseObject( //nolint: ireturn,dupl
	ctx context.Context,
	file *processedFile,
	logger *slog.Logger,
) api.GetFileWithPresignedURLResponseObject {
	switch file.statusCode {
	case http.StatusOK:
		return api.GetFileWithPresignedURL200ApplicationoctetStreamResponse{
			Body: file.body,
			Headers: api.GetFileWithPresignedURL200ResponseHeaders{
				AcceptRanges: "bytes",
				CacheControl: file.cacheControl,
				ContentDisposition: fmt.Sprintf(
					`inline; filename="%s"`,
					url.QueryEscape(file.filename),
				),
				ContentType:      file.mimeType,
				Etag:             file.fileMetadata.Etag,
				LastModified:     api.RFC2822Date(file.fileMetadata.UpdatedAt),
				SurrogateControl: file.cacheControl,
				SurrogateKey:     file.fileMetadata.Id,
			},
			ContentLength: file.contentLength,
		}
	case http.StatusPartialContent:
		return api.GetFileWithPresignedURL206ApplicationoctetStreamResponse{
			Body: file.body,
			Headers: api.GetFileWithPresignedURL206ResponseHeaders{
				CacheControl: file.cacheControl,
				ContentDisposition: fmt.Sprintf(
					`inline; filename="%s"`,
					url.QueryEscape(file.filename),
				),
				ContentRange:     file.extraHeaders.Get("Content-Range"),
				ContentType:      file.mimeType,
				Etag:             file.fileMetadata.Etag,
				LastModified:     api.RFC2822Date(file.fileMetadata.UpdatedAt),
				SurrogateControl: file.cacheControl,
				SurrogateKey:     file.fileMetadata.Id,
			},
			ContentLength: file.contentLength,
		}
	case http.StatusNotModified:
		return api.GetFileWithPresignedURL304Response{
			Headers: api.GetFileWithPresignedURL304ResponseHeaders{
				CacheControl:     file.cacheControl,
				Etag:             file.fileMetadata.Etag,
				SurrogateControl: file.cacheControl,
			},
		}
	case http.StatusPreconditionFailed:
		return api.GetFileWithPresignedURL412Response{
			Headers: api.GetFileWithPresignedURL412ResponseHeaders{
				CacheControl:     file.cacheControl,
				Etag:             file.fileMetadata.Etag,
				SurrogateControl: file.cacheControl,
			},
		}
	default:
		logger.ErrorContext(
			ctx, "unexpected status code from download", slog.Int("statusCode", file.statusCode),
		)

		return ErrUnexpectedStatusCode
	}
}

func (ctrl *Controller) GetFileWithPresignedURL( //nolint: ireturn
	ctx context.Context,
	request api.GetFileWithPresignedURLRequestObject,
) (api.GetFileWithPresignedURLResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	acceptHeader := middleware.AcceptHeaderFromContext(ctx)

	fileMetadata, _, apiErr := ctrl.getFileMetadata(
		ctx,
		request.Id,
		true,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to get file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	var httpHeaders http.Header
	if request.Params.Range != nil && !request.Params.HasImageManipulationOptions() {
		httpHeaders = http.Header{
			"Range": []string{*request.Params.Range},
		}
	}

	expires, apiErr := expiresIn(request.Params.XAmzExpires, request.Params.XAmzDate)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to parse expiration time", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	downloadFunc := func() (*File, *APIError) {
		return ctrl.contentStorage.GetFileWithPresignedURL(
			ctx,
			request.Id,
			getAmazonSignature(request),
			httpHeaders,
		)
	}

	processedFile, apiErr := ctrl.processFileToDownload(
		downloadFunc,
		fileMetadata,
		fmt.Sprintf("max-age=%d", expires),
		request.Params,
		acceptHeader,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to process file for download", slog.String("error", apiErr.Error()),
		)

		return nil, apiErr
	}

	return ctrl.getFileWithPresignedURLResponseObject(ctx, processedFile, logger), nil
}
