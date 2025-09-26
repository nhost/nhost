package controller

import (
	"context"
	"path"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/middleware"
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
	logger := middleware.LoggerFromContext(ctx)

	files, apiErr := ctrl.listBrokenMetadata(ctx)
	if apiErr != nil {
		logger.WithError(apiErr).Error("failed to list broken metadata")
		return apiErr, nil
	}

	return api.ListBrokenMetadata200JSONResponse{
		Metadata: fileListSummary(files),
	}, nil
}
