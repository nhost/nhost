package controller

import (
	"context"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
	"github.com/nhost/hasura-storage/middleware/cdn/fastly"
)

func (ctrl *Controller) DeleteFile( //nolint:ireturn
	ctx context.Context,
	request api.DeleteFileRequestObject,
) (api.DeleteFileResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	apiErr := ctrl.metadataStorage.DeleteFileByID(ctx, request.Id, sessionHeaders)
	if apiErr != nil {
		logger.WithError(apiErr).Error("problem deleting file metadata")
		return apiErr, nil
	}

	if apiErr := ctrl.contentStorage.DeleteFile(ctx, request.Id); apiErr != nil {
		logger.WithError(apiErr).Error("problem deleting file content")
		return apiErr, nil
	}

	fastly.FileChangedToContext(ctx, request.Id)

	return api.DeleteFile204Response{}, nil
}
