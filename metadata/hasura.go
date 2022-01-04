package metadata

import (
	"context"
	"errors"
	"net/http"

	"github.com/hasura/go-graphql-client"
	"github.com/nhost/hasura-storage/controller"
)

type (
	uuid string
)

func parseGraphqlError(err error) *controller.APIError {
	var ghErr graphql.Errors
	if errors.As(err, &ghErr) {
		code, ok := ghErr[0].Extensions["code"]
		if !ok {
			return controller.InternalServerError(err)
		}
		switch code {
		case "access-denied", "validation-failed":
			return controller.ForbiddenError(ghErr, "you are not authorized")
		default:
			return controller.InternalServerError(err)
		}
	}

	return controller.InternalServerError(err)
}

type BucketMetadata struct {
	ID                   graphql.String  `graphql:"id"`
	MinUploadFile        graphql.Int     `graphql:"min_upload_file_size"`
	MaxUploadFile        graphql.Int     `graphql:"max_upload_file_size"`
	PresignedURLsEnabled graphql.Boolean `graphql:"presigned_urls_enabled"`
	DownloadExpiration   graphql.Int     `graphql:"download_expiration"`
	CreatedAt            graphql.String  `graphql:"created_at"`
	UpdatedAt            graphql.String  `graphql:"updated_at"`
	CacheControl         graphql.String  `graphql:"cache_control"`
}

type FileMetadata struct {
	ID               graphql.String  `graphql:"id"`
	Name             graphql.String  `graphql:"name"`
	Size             graphql.Int     `graphql:"size"`
	BucketID         graphql.String  `graphql:"bucket_id"`
	ETag             graphql.String  `graphql:"etag"`
	CreatedAt        graphql.String  `graphql:"created_at"`
	UpdatedAt        graphql.String  `graphql:"updated_at"`
	IsUploaded       graphql.Boolean `graphql:"is_uploaded"`
	MimeType         graphql.String  `graphql:"mime_type"`
	UploadedByUserID graphql.String  `graphql:"uploaded_by_user_id"`
}

type FileMetadataWithBucket struct {
	FileMetadata
	Bucket BucketMetadata `graphql:"bucket"`
}

type HasuraAuthorizer func(in http.Header) graphql.RequestModifier

func ForWardHeadersAuthorizer(in http.Header) graphql.RequestModifier {
	return func(out *http.Request) {
		for k, v := range in {
			for _, vv := range v {
				out.Header.Add(k, vv)
			}
		}
	}
}

type Hasura struct {
	client     *graphql.Client
	authorizer HasuraAuthorizer
}

func NewHasura(endpoint string, authorizer HasuraAuthorizer) *Hasura {
	return &Hasura{
		graphql.NewClient(endpoint, nil),
		authorizer,
	}
}

func (h *Hasura) GetBucketByID(
	ctx context.Context,
	bucketID string,
	headers http.Header,
) (controller.BucketMetadata, *controller.APIError) {
	var query struct {
		StorageBucketsByPK BucketMetadata `graphql:"storage_buckets_by_pk(id: $id)"`
	}

	variables := map[string]interface{}{
		"id": graphql.String(bucketID),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Query(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return controller.BucketMetadata{}, aerr.ExtendError("problem executing query")
	}

	if query.StorageBucketsByPK.ID == graphql.String("") {
		return controller.BucketMetadata{}, controller.ErrBucketNotFound
	}

	return controller.BucketMetadata{
		ID:                   string(query.StorageBucketsByPK.ID),
		MinUploadFile:        int(query.StorageBucketsByPK.MinUploadFile),
		MaxUploadFile:        int(query.StorageBucketsByPK.MaxUploadFile),
		PresignedURLsEnabled: bool(query.StorageBucketsByPK.PresignedURLsEnabled),
		DownloadExpiration:   int(query.StorageBucketsByPK.DownloadExpiration),
		CreatedAt:            string(query.StorageBucketsByPK.CreatedAt),
		UpdatedAt:            string(query.StorageBucketsByPK.UpdatedAt),
		CacheControl:         string(query.StorageBucketsByPK.CacheControl),
	}, nil
}

func (h *Hasura) InitializeFile(ctx context.Context, fileID string, headers http.Header) *controller.APIError {
	var query struct {
		InsertStorageFiles struct {
			ID graphql.String `graphql:"id"`
		} `graphql:"insert_storage_files_one (object: {id: $id})"`
	}

	variables := map[string]interface{}{
		"id": uuid(fileID),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Mutate(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return aerr.ExtendError("problem initializing file metadata")
	}

	return nil
}

func (h *Hasura) PopulateMetadata(
	ctx context.Context,
	fileID, name string, size int64, bucketID, etag string, isUploaded bool, mimeType string,
	headers http.Header,
) (controller.FileMetadata, *controller.APIError) {
	var query struct {
		InsertStorageFiles FileMetadata `graphql:"update_storage_files_by_pk(pk_columns: {id: $id}, _set: {bucket_id: $bucket_id, etag: $etag, is_uploaded: $is_uploaded, mime_type: $mime_type, name: $name, size: $size})"` // nolint
	}

	variables := map[string]interface{}{
		"id":          uuid(fileID),
		"bucket_id":   graphql.String(bucketID),
		"etag":        graphql.String(etag),
		"is_uploaded": graphql.Boolean(isUploaded),
		"mime_type":   graphql.String(mimeType),
		"name":        graphql.String(name),
		"size":        graphql.Int(size),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Mutate(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return controller.FileMetadata{}, aerr.ExtendError("problem initializing file metadata")
	}

	return controller.FileMetadata{
		ID:               string(query.InsertStorageFiles.ID),
		Name:             string(query.InsertStorageFiles.Name),
		Size:             int64(query.InsertStorageFiles.Size),
		BucketID:         string(query.InsertStorageFiles.BucketID),
		ETag:             string(query.InsertStorageFiles.ETag),
		CreatedAt:        string(query.InsertStorageFiles.CreatedAt),
		UpdatedAt:        string(query.InsertStorageFiles.UpdatedAt),
		IsUploaded:       bool(query.InsertStorageFiles.IsUploaded),
		MimeType:         string(query.InsertStorageFiles.MimeType),
		UploadedByUserID: string(query.InsertStorageFiles.UploadedByUserID),
	}, nil
}

func (h *Hasura) GetFileByID(
	ctx context.Context,
	fileID string,
	headers http.Header,
) (controller.FileMetadataWithBucket, *controller.APIError) {
	var query struct {
		StorageFilesByPK FileMetadataWithBucket `graphql:"storage_files_by_pk(id: $id)"`
	}

	variables := map[string]interface{}{
		"id": uuid(fileID),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Query(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return controller.FileMetadataWithBucket{}, aerr.ExtendError("problem executing query")
	}

	if query.StorageFilesByPK.ID == graphql.String("") {
		return controller.FileMetadataWithBucket{}, controller.ErrFileNotFound
	}

	return controller.FileMetadataWithBucket{
		FileMetadata: controller.FileMetadata{
			ID:               fileID,
			Name:             string(query.StorageFilesByPK.Name),
			Size:             int64(query.StorageFilesByPK.Size),
			BucketID:         string(query.StorageFilesByPK.BucketID),
			ETag:             string(query.StorageFilesByPK.ETag),
			CreatedAt:        string(query.StorageFilesByPK.CreatedAt),
			UpdatedAt:        string(query.StorageFilesByPK.UpdatedAt),
			IsUploaded:       bool(query.StorageFilesByPK.IsUploaded),
			MimeType:         string(query.StorageFilesByPK.MimeType),
			UploadedByUserID: string(query.StorageFilesByPK.UploadedByUserID),
		},
		Bucket: controller.BucketMetadata{
			ID:                   string(query.StorageFilesByPK.Bucket.ID),
			MinUploadFile:        int(query.StorageFilesByPK.Bucket.MinUploadFile),
			MaxUploadFile:        int(query.StorageFilesByPK.Bucket.MaxUploadFile),
			PresignedURLsEnabled: bool(query.StorageFilesByPK.Bucket.PresignedURLsEnabled),
			DownloadExpiration:   int(query.StorageFilesByPK.Bucket.DownloadExpiration),
			CreatedAt:            string(query.StorageFilesByPK.Bucket.CreatedAt),
			UpdatedAt:            string(query.StorageFilesByPK.Bucket.UpdatedAt),
			CacheControl:         string(query.StorageFilesByPK.Bucket.CacheControl),
		},
	}, nil
}
