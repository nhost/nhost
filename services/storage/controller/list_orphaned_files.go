package controller

import (
	"context"
	"log/slog"
	"net/http"
	"path"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

func (ctrl *Controller) listOrphans(ctx context.Context) ([]string, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(
		ctx,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return nil, apiErr
	}

	filesInS3, apiErr := ctrl.contentStorage.ListFiles(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]string, 0, 10) //nolint: mnd

	for _, fileS3 := range filesInS3 {
		found := false

		for _, fileHasura := range filesInHasura {
			if path.Base(fileS3) == fileHasura.ID {
				found = true
				break
			}
		}

		if !found {
			missing = append(missing, fileS3)
		}
	}

	return missing, nil
}

func (ctrl *Controller) ListOrphanedFiles( //nolint:ireturn
	ctx context.Context, _ api.ListOrphanedFilesRequestObject,
) (api.ListOrphanedFilesResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	files, apiErr := ctrl.listOrphans(ctx)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to list orphaned files", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return api.ListOrphanedFiles200JSONResponse{
		Files: &files,
	}, nil
}
