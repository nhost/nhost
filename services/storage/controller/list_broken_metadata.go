package controller

import (
	"context"
	"log/slog"
	"path"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

type ListBrokenMetadataResponse struct {
	Metadata []FileSummary `json:"metadata"`
}

func (ctrl *Controller) listBrokenMetadata(ctx context.Context) ([]FileSummary, *APIError) {
	filesInHasura, apiErr := ctrl.metadataStorage.ListFiles(ctx, nil)
	if apiErr != nil {
		return nil, apiErr
	}

	filesInS3, apiErr := ctrl.contentStorage.ListFiles(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	missing := make([]FileSummary, 0, 10) //nolint: mnd

	for _, fileHasura := range filesInHasura {
		found := false

		for _, fileS3 := range filesInS3 {
			if path.Base(fileS3) == fileHasura.ID || !fileHasura.IsUploaded {
				found = true
			}
		}

		if !found {
			missing = append(missing, fileHasura)
		}
	}

	return missing, nil
}

func fileListSummary(files []FileSummary) *[]api.FileSummary {
	apiFiles := make([]api.FileSummary, len(files))
	for i, f := range files {
		apiFiles[i] = api.FileSummary{
			Id:         f.ID,
			Name:       f.Name,
			IsUploaded: f.IsUploaded,
			BucketId:   f.BucketID,
		}
	}

	return &apiFiles
}

func (ctrl *Controller) ListBrokenMetadata( //nolint:ireturn
	ctx context.Context, _ api.ListBrokenMetadataRequestObject,
) (api.ListBrokenMetadataResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	files, apiErr := ctrl.listBrokenMetadata(ctx)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to list broken metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return api.ListBrokenMetadata200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
