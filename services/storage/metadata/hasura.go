package metadata

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
)

func ptr[T any](x T) *T {
	return &x
}

func parseGraphqlError(err error) *controller.APIError {
	var ghErr *clientv2.ErrorResponse
	if errors.As(err, &ghErr) {
		code, ok := (*ghErr.GqlErrors)[0].Extensions["code"]
		if !ok {
			return controller.InternalServerError(err)
		}

		switch code {
		case "access-denied", "validation-failed", "permission-error":
			return controller.ForbiddenError(ghErr, "you are not authorized")
		case "data-exception", "constraint-violation":
			return controller.BadDataError(err, ghErr.Error())
		default:
			return controller.InternalServerError(err)
		}
	}

	return controller.InternalServerError(err)
}

func (md *FileMetadataSummaryFragment) ToControllerType() controller.FileSummary {
	return controller.FileSummary{
		ID:         md.GetID(),
		Name:       *md.GetName(),
		BucketID:   md.GetBucketID(),
		IsUploaded: *md.GetIsUploaded(),
	}
}

func (md *BucketMetadataFragment) ToControllerType() controller.BucketMetadata {
	return controller.BucketMetadata{
		ID:                   md.GetID(),
		MinUploadFile:        int(md.GetMinUploadFileSize()),
		MaxUploadFile:        int(md.GetMaxUploadFileSize()),
		PresignedURLsEnabled: md.GetPresignedUrlsEnabled(),
		DownloadExpiration:   int(md.GetDownloadExpiration()),
		CreatedAt:            md.GetCreatedAt().Format(time.RFC3339),
		UpdatedAt:            md.GetUpdatedAt().Format(time.RFC3339),
		CacheControl:         *md.GetCacheControl(),
	}
}

func (md *FileMetadataFragment) ToControllerType() api.FileMetadata {
	return api.FileMetadata{
		Id:               md.GetID(),
		Name:             *md.GetName(),
		Size:             *md.GetSize(),
		BucketId:         md.GetBucketID(),
		Etag:             *md.GetEtag(),
		CreatedAt:        *md.GetCreatedAt(),
		UpdatedAt:        *md.GetUpdatedAt(),
		IsUploaded:       *md.GetIsUploaded(),
		MimeType:         *md.GetMimeType(),
		Metadata:         ptr(md.GetMetadata()),
		UploadedByUserId: md.GetUploadedByUserID(),
	}
}

func WithHeaders(header http.Header) clientv2.RequestInterceptor {
	return func(
		ctx context.Context,
		req *http.Request,
		gqlInfo *clientv2.GQLRequestInfo,
		res any,
		next clientv2.RequestInterceptorFunc,
	) error {
		for k, v := range header {
			for _, vv := range v {
				req.Header.Add(k, vv)
			}
		}

		return next(ctx, req, gqlInfo, res)
	}
}

type Hasura struct {
	cl *Client
}

func NewHasura(endpoint string) *Hasura {
	return &Hasura{
		cl: NewClient(
			&http.Client{}, //nolint:exhaustruct
			endpoint,
			&clientv2.Options{}, //nolint:exhaustruct
		),
	}
}

func (h *Hasura) GetBucketByID(
	ctx context.Context,
	bucketID string,
	headers http.Header,
) (controller.BucketMetadata, *controller.APIError) {
	resp, err := h.cl.GetBucket(
		ctx,
		bucketID,
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return controller.BucketMetadata{}, aerr.ExtendError("problem getting bucket metadata")
	}

	if resp.Bucket == nil || resp.Bucket.ID == "" {
		return controller.BucketMetadata{}, controller.ErrBucketNotFound
	}

	return resp.Bucket.ToControllerType(), nil
}

func (h *Hasura) InitializeFile(
	ctx context.Context,
	fileID, name string, size int64, bucketID, mimeType string,
	headers http.Header,
) *controller.APIError {
	_, err := h.cl.InsertFile(
		ctx,
		FilesInsertInput{ //nolint:exhaustruct
			BucketID: ptr(bucketID),
			ID:       ptr(fileID),
			MimeType: ptr(mimeType),
			Name:     ptr(name),
			Size:     ptr(size),
		},
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return aerr.ExtendError("problem initializing file metadata")
	}

	return nil
}

func (h *Hasura) PopulateMetadata(
	ctx context.Context,
	fileID, name string, size int64, bucketID, etag string, isUploaded bool, mimeType string,
	metadata map[string]any,
	headers http.Header,
) (api.FileMetadata, *controller.APIError) {
	resp, err := h.cl.UpdateFile(
		ctx,
		fileID,
		FilesSetInput{ //nolint:exhaustruct
			BucketID:   ptr(bucketID),
			Etag:       ptr(etag),
			IsUploaded: ptr(isUploaded),
			Metadata:   metadata,
			MimeType:   ptr(mimeType),
			Name:       ptr(name),
			Size:       ptr(size),
		},
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return api.FileMetadata{}, aerr.ExtendError("problem populating file metadata")
	}

	if resp.UpdateFile == nil || resp.UpdateFile.ID == "" {
		return api.FileMetadata{}, controller.ErrFileNotFound
	}

	return resp.UpdateFile.ToControllerType(), nil
}

func (h *Hasura) GetFileByID(
	ctx context.Context,
	fileID string,
	headers http.Header,
) (api.FileMetadata, *controller.APIError) {
	resp, err := h.cl.GetFile(
		ctx,
		fileID,
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return api.FileMetadata{}, aerr.ExtendError("problem getting file metadata")
	}

	if resp.File == nil || resp.File.ID == "" {
		return api.FileMetadata{}, controller.ErrFileNotFound
	}

	return resp.File.ToControllerType(), nil
}

func (h *Hasura) SetIsUploaded(
	ctx context.Context, fileID string, isUploaded bool, headers http.Header,
) *controller.APIError {
	resp, err := h.cl.UpdateFile(
		ctx,
		fileID,
		FilesSetInput{ //nolint:exhaustruct
			IsUploaded: ptr(isUploaded),
		},
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return aerr.ExtendError("problem setting file as uploaded")
	}

	if resp.UpdateFile == nil || resp.UpdateFile.ID == "" {
		return controller.ErrFileNotFound
	}

	return nil
}

func (h *Hasura) DeleteFileByID(
	ctx context.Context,
	fileID string,
	headers http.Header,
) *controller.APIError {
	resp, err := h.cl.DeleteFile(
		ctx,
		fileID,
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return aerr.ExtendError("problem deleting file")
	}

	if resp.DeleteFile == nil || resp.DeleteFile.ID == "" {
		return controller.ErrFileNotFound
	}

	return nil
}

func (h *Hasura) ListFiles(
	ctx context.Context,
	headers http.Header,
) ([]controller.FileSummary, *controller.APIError) {
	resp, err := h.cl.ListFilesSummary(
		ctx,
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return nil, aerr.ExtendError("problem listing files")
	}

	files := make([]controller.FileSummary, len(resp.Files))
	for i, f := range resp.Files {
		files[i] = f.ToControllerType()
	}

	return files, nil
}

func (h *Hasura) InsertVirus(
	ctx context.Context,
	fileID, filename, virus string,
	userSession map[string]any,
	headers http.Header,
) *controller.APIError {
	_, err := h.cl.InsertVirus(
		ctx,
		VirusInsertInput{ //nolint:exhaustruct
			FileID:      ptr(fileID),
			Filename:    ptr(filename),
			UserSession: userSession,
			Virus:       ptr(virus),
		},
		WithHeaders(headers),
	)
	if err != nil {
		aerr := parseGraphqlError(err)
		return aerr.ExtendError("problem inserting virus")
	}

	return nil
}
