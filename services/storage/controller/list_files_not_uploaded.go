package controller

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
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
	logger := middleware.LoggerFromContext(ctx)

	files, apiErr := ctrl.listNotUploaded(ctx)
	if apiErr != nil {
		logger.WithError(apiErr).Error("failed to list not uploaded files")
		return apiErr, nil
	}

	return api.ListFilesNotUploaded200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
