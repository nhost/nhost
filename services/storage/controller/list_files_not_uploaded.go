package controller

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

func (ctrl *Controller) listNotUploaded(ctx context.Context) ([]FileSummary, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(
		ctx,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]FileSummary, 0, 10) //nolint: mnd

	for _, fileHasura := range filesInHasura {
		if !fileHasura.IsUploaded {
			missing = append(missing, fileHasura)
		}
	}

	return missing, nil
}

func (ctrl *Controller) ListNotUploaded(ctx *gin.Context) {
	files, apiErr := ctrl.listNotUploaded(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, apiErr.PublicResponse())

		return
	}

	ctx.JSON(
		http.StatusOK,
		ListBrokenMetadataResponse{
			files,
		},
	)
}

func (ctrl *Controller) ListFilesNotUploaded( //nolint:ireturn
	ctx context.Context, _ api.ListFilesNotUploadedRequestObject,
) (api.ListFilesNotUploadedResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	files, apiErr := ctrl.listNotUploaded(ctx)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to list not uploaded files", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return api.ListFilesNotUploaded200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
