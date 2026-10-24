package controller

import (
	"context"
	"log/slog"
	"net/http"
	"path"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

func (ctrl *Controller) listOrphans(ctx context.Context) ([]string, *APIError) {
	// uploads write the metadata row before the object, so list s3 first: an object
	// uploaded in between is then also in the hasura list and isn't seen as an orphan
	filesInS3, apiErr := ctrl.contentStorage.ListFiles(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(
		ctx,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
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
	ctx context.Context,
	_ api.ListOrphanedFilesRequestObject,
) (api.ListOrphanedFilesResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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
