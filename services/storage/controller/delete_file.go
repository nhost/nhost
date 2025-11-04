package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
	"github.com/nhost/nhost/services/storage/middleware/cdn/fastly"
)

func (ctrl *Controller) DeleteFile( //nolint:ireturn
	ctx context.Context,
	request api.DeleteFileRequestObject,
) (api.DeleteFileResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	apiErr := ctrl.metadataStorage.DeleteFileByID(ctx, request.Id, sessionHeaders)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "problem deleting file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	if apiErr := ctrl.contentStorage.DeleteFile(ctx, request.Id); apiErr != nil {
		logger.ErrorContext(
			ctx, "problem deleting file content", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	fastly.FileChangedToContext(ctx, request.Id)

	return api.DeleteFile204Response{}, nil
}
