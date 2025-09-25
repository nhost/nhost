package controller

import (
	"context"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
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
		logger.WithError(apiErr).Error("failed to delete orphaned files")
		return apiErr, nil
	}

	return api.DeleteOrphanedFiles200JSONResponse{
		Files: &files,
	}, nil
}
