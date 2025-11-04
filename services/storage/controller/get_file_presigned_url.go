package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

type GetFilePresignedURLResponse struct {
	Error      *ErrorResponse `json:"error,omitempty"`
	URL        string         `json:"url,omitempty"`
	Expiration int            `json:"expiration,omitempty"`
}

type GetFilePresignedURLRequest struct {
	FileID string
}

func (ctrl *Controller) GetFilePresignedURL( //nolint:ireturn
	ctx context.Context, request api.GetFilePresignedURLRequestObject,
) (api.GetFilePresignedURLResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	logger = logger.With("file_id", request.Id)

	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, true, sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "error getting file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	if !bucketMetadata.PresignedURLsEnabled {
		err := errors.New( //nolint: err113
			"presigned URLs are not enabled on the bucket where this file is located in",
		)

		logger.ErrorContext(ctx, "presigned URLs not enabled for bucket")

		return ForbiddenError(err, err.Error()), nil
	}

	signature, apiErr := ctrl.contentStorage.CreatePresignedURL(
		ctx,
		fileMetadata.Id,
		time.Duration(bucketMetadata.DownloadExpiration)*time.Second,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "error creating presigned URL for file", slog.String("error", apiErr.Error()))

		return apiErr, nil
	}

	url := fmt.Sprintf(
		"%s%s/files/%s/presignedurl/contents?%s",
		ctrl.publicURL, ctrl.apiRootPrefix, fileMetadata.Id, signature,
	)

	return api.GetFilePresignedURL200JSONResponse{
		Expiration: bucketMetadata.DownloadExpiration,
		Url:        url,
	}, nil
}
