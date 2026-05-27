package controller

import (
	"context"
	"log/slog"
	"net/http"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

func (ctrl *Controller) deleteBrokenMetadata(
	ctx context.Context,
) ([]FileSummary, *APIError) {
	missing, apiErr := ctrl.listBrokenMetadata(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	// Deletion runs as admin to match the admin-only listing above; the
	// endpoint is already gated by the admin secret in AuthenticationFunc.
	adminHeaders := http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}}

	for _, m := range missing {
		if apiErr := ctrl.metadataStorage.DeleteFileByID(ctx, m.ID, adminHeaders); apiErr != nil {
			return nil, apiErr
		}
	}

	return missing, nil
}

func (ctrl *Controller) DeleteBrokenMetadata( //nolint:ireturn
	ctx context.Context,
	_ api.DeleteBrokenMetadataRequestObject,
) (api.DeleteBrokenMetadataResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	files, apiErr := ctrl.deleteBrokenMetadata(ctx)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to delete broken metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return api.DeleteBrokenMetadata200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
