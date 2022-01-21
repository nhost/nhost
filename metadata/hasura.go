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
		case "data-exception":
			return controller.BadDataError(err, ghErr.Error())
		default:
			return controller.InternalServerError(err)
		}
	}

	return controller.InternalServerError(err)
}

type FileSummaryList []FileSummary

func (md FileSummaryList) ToControllerType() []controller.FileSummary {
	res := make([]controller.FileSummary, len(md))

	for i, x := range md {
		res[i] = x.ToControllerType()
	}
	return res
}

type FileSummary struct {
	ID         graphql.String  `graphql:"id"`
	Name       graphql.String  `graphql:"name"`
	BucketID   graphql.String  `graphql:"bucket_id"`
	IsUploaded graphql.Boolean `graphql:"is_uploaded"`
}

func (md FileSummary) ToControllerType() controller.FileSummary {
	return controller.FileSummary{
		ID:         string(md.ID),
		Name:       string(md.Name),
		BucketID:   string(md.BucketID),
		IsUploaded: bool(md.IsUploaded),
	}
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

func (md BucketMetadata) ToControllerType() controller.BucketMetadata {
	return controller.BucketMetadata{
		ID:                   string(md.ID),
		MinUploadFile:        int(md.MinUploadFile),
		MaxUploadFile:        int(md.MaxUploadFile),
		PresignedURLsEnabled: bool(md.PresignedURLsEnabled),
		DownloadExpiration:   int(md.DownloadExpiration),
		CreatedAt:            string(md.CreatedAt),
		UpdatedAt:            string(md.UpdatedAt),
		CacheControl:         string(md.CacheControl),
	}
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

func (md FileMetadata) ToControllerType() controller.FileMetadata {
	return controller.FileMetadata{
		ID:               string(md.ID),
		Name:             string(md.Name),
		Size:             int64(md.Size),
		BucketID:         string(md.BucketID),
		ETag:             string(md.ETag),
		CreatedAt:        string(md.CreatedAt),
		UpdatedAt:        string(md.UpdatedAt),
		IsUploaded:       bool(md.IsUploaded),
		MimeType:         string(md.MimeType),
		UploadedByUserID: string(md.UploadedByUserID),
	}
}

type FileMetadataWithBucket struct {
	FileMetadata
	Bucket BucketMetadata `graphql:"bucket"`
}

func (md FileMetadataWithBucket) ToControllerType() controller.FileMetadataWithBucket {
	return controller.FileMetadataWithBucket{
		FileMetadata: md.FileMetadata.ToControllerType(),
		Bucket:       md.Bucket.ToControllerType(),
	}
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

	return query.StorageBucketsByPK.ToControllerType(), nil
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
		UpdateStorageFile FileMetadata `graphql:"update_storage_files_by_pk(pk_columns: {id: $id}, _set: {bucket_id: $bucket_id, etag: $etag, is_uploaded: $is_uploaded, mime_type: $mime_type, name: $name, size: $size})"` // nolint
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

	if query.UpdateStorageFile.ID == "" {
		return controller.FileMetadata{}, controller.ErrFileNotFound
	}

	return query.UpdateStorageFile.ToControllerType(), nil
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

	return query.StorageFilesByPK.ToControllerType(), nil
}

func (h *Hasura) SetIsUploaded(
	ctx context.Context, fileID string, isUploaded bool, headers http.Header,
) *controller.APIError {
	var query struct {
		UpdateStorageFile struct {
			ID graphql.String `graphql:"id"`
		} `graphql:"update_storage_files_by_pk(pk_columns: {id: $id}, _set: {is_uploaded: $is_uploaded})"`
	}

	variables := map[string]interface{}{
		"id":          uuid(fileID),
		"is_uploaded": graphql.Boolean(isUploaded),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Mutate(ctx, &query, variables)
	if err != nil {
		return parseGraphqlError(err)
	}

	if query.UpdateStorageFile.ID == "" {
		return controller.ErrFileNotFound
	}

	return nil
}

func (h *Hasura) DeleteFileByID(
	ctx context.Context,
	fileID string,
	headers http.Header,
) (controller.FileMetadataWithBucket, *controller.APIError) {
	var query struct {
		StorageFileByPK FileMetadataWithBucket `graphql:"delete_storage_files_by_pk(id: $id)"`
	}

	variables := map[string]interface{}{
		"id": uuid(fileID),
	}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Mutate(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return controller.FileMetadataWithBucket{}, aerr.ExtendError("problem executing query")
	}

	if query.StorageFileByPK.ID == graphql.String("") {
		return controller.FileMetadataWithBucket{}, controller.ErrFileNotFound
	}

	return query.StorageFileByPK.ToControllerType(), nil
}

func (h *Hasura) ListFiles(ctx context.Context, headers http.Header) ([]controller.FileSummary, *controller.APIError) {
	var query struct {
		StorageFilesSummary FileSummaryList `graphql:"storage_files"`
	}

	variables := map[string]interface{}{}

	client := h.client.WithRequestModifier(h.authorizer(headers))
	err := client.Query(ctx, &query, variables)
	if err != nil {
		aerr := parseGraphqlError(err)
		return nil, aerr.ExtendError("problem executing query")
	}

	return query.StorageFilesSummary.ToControllerType(), nil
}
