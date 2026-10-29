package controller

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"path"

	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

func (ctrl *Controller) deleteOrphans(ctx context.Context) ([]string, *APIError) {
	toDelete, apiErr := ctrl.listOrphans(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	deleted := make([]string, 0, len(toDelete))
	adminHeaders := http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}}

	for _, f := range toDelete {
		// A same-ID upload may have created metadata since the snapshot. This
		// narrows, but does not eliminate, the check-to-delete race.
		if id := path.Base(f); uuid.Validate(id) == nil {
			_, apiErr := ctrl.metadataStorage.GetFileByID(ctx, id, adminHeaders)
			if apiErr == nil {
				continue
			}

			if !errors.Is(apiErr, ErrFileNotFound) {
				return nil, apiErr
			}
		}

		if apiErr := ctrl.contentStorage.DeleteFile(ctx, f); apiErr != nil {
			return nil, apiErr
		}

		deleted = append(deleted, f)
	}

	return deleted, nil
}

func (ctrl *Controller) DeleteOrphanedFiles( //nolint:ireturn
	ctx context.Context,
	_ api.DeleteOrphanedFilesRequestObject,
) (api.DeleteOrphanedFilesResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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
