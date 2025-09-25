package controller

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
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
	logger := middleware.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, true, sessionHeaders,
	)
	if apiErr != nil {
		logger.WithError(apiErr).Error("error getting file metadata")
		return apiErr, nil
	}

	if !bucketMetadata.PresignedURLsEnabled {
		err := errors.New( //nolint: err113
			"presigned URLs are not enabled on the bucket where this file is located in",
		)
		logger.WithError(err).Error("presigned URLs not enabled for bucket")

		return ForbiddenError(err, err.Error()), nil
	}

	signature, apiErr := ctrl.contentStorage.CreatePresignedURL(
		ctx,
		fileMetadata.Id,
		time.Duration(bucketMetadata.DownloadExpiration)*time.Second,
	)
	if apiErr != nil {
		logger.WithError(apiErr).Error("error creating presigned URL for file")
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
