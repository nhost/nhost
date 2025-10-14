package controller

import (
	"context"
	"log/slog"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

func (ctrl *Controller) deleteOrphans(ctx context.Context) ([]string, *APIError) {
	toDelete, apiErr := ctrl.listOrphans(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	for _, f := range toDelete {
		if apiErr := ctrl.contentStorage.DeleteFile(ctx, f); apiErr != nil {
			return nil, apiErr
		}
	}

	return toDelete, nil
}

func (ctrl *Controller) DeleteOrphanedFiles( //nolint:ireturn
	ctx context.Context,
	_ api.DeleteOrphanedFilesRequestObject,
) (api.DeleteOrphanedFilesResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	files, apiErr := ctrl.deleteOrphans(ctx)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to delete orphaned files", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return api.DeleteOrphanedFiles200JSONResponse{
		Files: &files,
	}, nil
}
