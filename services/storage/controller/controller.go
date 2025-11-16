//go:generate mockgen -destination mock/controller.go -package mock -source=controller.go MetadataStorage
package controller

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/image"
)

type FileSummary struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IsUploaded bool   `json:"isUploaded"`
	BucketID   string `json:"bucketId"`
}

type BucketMetadata struct {
	ID                   string
	MinUploadFile        int
	MaxUploadFile        int
	PresignedURLsEnabled bool
	DownloadExpiration   int
	CreatedAt            string
	UpdatedAt            string
	CacheControl         string
}

type MetadataStorage interface {
	GetBucketByID(ctx context.Context, id string, headers http.Header) (BucketMetadata, *APIError)
	GetFileByID(ctx context.Context, id string, headers http.Header) (api.FileMetadata, *APIError)
	InitializeFile(
		ctx context.Context,
		id, name string, size int64, bucketID, mimeType string,
		headers http.Header,
	) *APIError
	PopulateMetadata(
		ctx context.Context,
		id, name string, size int64, bucketID, etag string, IsUploaded bool, mimeType string,
		metadata map[string]any,
		headers http.Header) (api.FileMetadata, *APIError,
	)
	SetIsUploaded(
		ctx context.Context,
		fileID string,
		isUploaded bool,
		headers http.Header,
	) *APIError
	DeleteFileByID(ctx context.Context, fileID string, headers http.Header) *APIError
	ListFiles(ctx context.Context, headers http.Header) ([]FileSummary, *APIError)
	InsertVirus(
		ctx context.Context,
		fileID, filename, virus string,
		userSession map[string]any,
		headers http.Header,
	) *APIError
}

type ContentStorage interface {
	PutFile(
		ctx context.Context,
		content io.ReadSeeker,
		filepath, contentType string,
	) (string, *APIError)
	GetFile(ctx context.Context, filepath string, downloadRange *string) (*File, *APIError)
	CreatePresignedURL(
		ctx context.Context,
		filepath string,
		expire time.Duration,
	) (string, *APIError)
	GetFileWithPresignedURL(
		ctx context.Context, filepath, signature string, headers http.Header,
	) (*File, *APIError)
	DeleteFile(ctx context.Context, filepath string) *APIError
	ListFiles(ctx context.Context) ([]string, *APIError)
}

type Antivirus interface {
	ScanReader(ctx context.Context, r io.ReaderAt) *APIError
}

type Controller struct {
	publicURL         string
	apiRootPrefix     string
	hasuraAdminSecret string
	metadataStorage   MetadataStorage
	contentStorage    ContentStorage
	imageTransformer  *image.Transformer
	av                Antivirus
	logger            *slog.Logger
}

func New(
	publicURL string,
	apiRootPrefix string,
	hasuraAdminSecret string,
	metadataStorage MetadataStorage,
	contentStorage ContentStorage,
	imageTransformer *image.Transformer,
	av Antivirus,
	logger *slog.Logger,
) *Controller {
	return &Controller{
		publicURL,
		apiRootPrefix,
		hasuraAdminSecret,
		metadataStorage,
		contentStorage,
		imageTransformer,
		av,
		logger,
	}
}
