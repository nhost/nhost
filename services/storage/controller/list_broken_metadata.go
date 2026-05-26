package controller

import (
	"context"
	"log/slog"
	"net/http"
	"path"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
)

type ListBrokenMetadataResponse struct {
	Metadata []FileSummary `json:"metadata"`
}

func (ctrl *Controller) listBrokenMetadata(ctx context.Context) ([]FileSummary, *APIError) {
	// Broken metadata detection must compare the full set of files in Hasura
	// against the full set in storage, so it always queries Hasura as admin
	// (like /ops/list-orphans and /ops/list-not-uploaded). The endpoint itself
	// is already gated by the admin secret in AuthenticationFunc.
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

	s3IDs := make(map[string]struct{}, len(filesInS3))
	for _, fileS3 := range filesInS3 {
		s3IDs[path.Base(fileS3)] = struct{}{}
	}

	missing := make([]FileSummary, 0, 10) //nolint: mnd

	for _, fileHasura := range filesInHasura {
		// A file that hasn't finished uploading is expected to be absent from
		// S3; that's "not uploaded", not "broken metadata".
		if !fileHasura.IsUploaded {
			continue
		}

		if _, found := s3IDs[fileHasura.ID]; !found {
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
