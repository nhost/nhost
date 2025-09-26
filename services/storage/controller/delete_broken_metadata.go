package controller

import (
	"context"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
)

func (ctrl *Controller) deleteBrokenMetadata(
	ctx context.Context,
) ([]FileSummary, *APIError) {
	missing, apiErr := ctrl.listBrokenMetadata(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	for _, m := range missing {
		if apiErr := ctrl.metadataStorage.DeleteFileByID(ctx, m.ID, nil); apiErr != nil {
			return nil, apiErr
		}
	}

	return missing, nil
}

func (ctrl *Controller) DeleteBrokenMetadata( //nolint:ireturn
	ctx context.Context,
	_ api.DeleteBrokenMetadataRequestObject,
) (api.DeleteBrokenMetadataResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	files, apiErr := ctrl.deleteBrokenMetadata(ctx)
	if apiErr != nil {
		logger.WithError(apiErr).Error("failed to delete broken metadata")
		return apiErr, nil
	}

	return api.DeleteBrokenMetadata200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
