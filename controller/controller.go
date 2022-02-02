package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
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

type FileMetadata struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Size             int64  `json:"size"`
	BucketID         string `json:"bucketId"`
	ETag             string `json:"etag"`
	CreatedAt        string `json:"createdAt"`
	UpdatedAt        string `json:"updatedAt"`
	IsUploaded       bool   `json:"isUploaded"`
	MimeType         string `json:"mimeType"`
	UploadedByUserID string `json:"uploadedByUserId"`
}

type FileMetadataWithBucket struct {
	FileMetadata
	Bucket BucketMetadata
}

//go:generate mockgen -destination mock_controller/metadata_storage.go -package mock_controller . MetadataStorage
type MetadataStorage interface {
	GetBucketByID(ctx context.Context, id string, headers http.Header) (BucketMetadata, *APIError)
	GetFileByID(ctx context.Context, id string, headers http.Header) (FileMetadataWithBucket, *APIError)
	InitializeFile(ctx context.Context, uuid string, headers http.Header) *APIError
	PopulateMetadata(
		ctx context.Context,
		id, name string, size int64, bucketID, etag string, IsUploaded bool, mimeType string,
		headers http.Header) (FileMetadata, *APIError,
	)
	SetIsUploaded(ctx context.Context, fileID string, isUploaded bool, headers http.Header) *APIError
	DeleteFileByID(ctx context.Context, fileID string, headers http.Header) (FileMetadataWithBucket, *APIError)
	ListFiles(ctx context.Context, headers http.Header) ([]FileSummary, *APIError)
}

//go:generate mockgen -destination mock_controller/content_storage.go -package mock_controller . ContentStorage
type ContentStorage interface {
	PutFile(content io.ReadSeeker, filepath, contentType string) (string, *APIError)
	GetFile(id string) (io.ReadCloser, *APIError)
	CreatePresignedURL(filepath string, expire time.Duration) (string, *APIError)
	DeleteFile(filepath string) *APIError
	ListFiles() ([]string, *APIError)
}

type Controller struct {
	metadataStorage MetadataStorage
	contentStorage  ContentStorage
	logger          *logrus.Logger
}

func New(
	metadataStorage MetadataStorage,
	contentStorage ContentStorage,
	logger *logrus.Logger,
) *Controller {
	return &Controller{
		metadataStorage,
		contentStorage,
		logger,
	}
}

func (ctrl *Controller) SetupRouter(trustedProxies []string, logger gin.HandlerFunc) (*gin.Engine, error) {
	router := gin.New()
	if err := router.SetTrustedProxies(trustedProxies); err != nil {
		return nil, fmt.Errorf("problem setting trusted proxies: %w", err)
	}

	router.MaxMultipartMemory = 8 << 20 // nolint:gomnd  // 8MB
	router.Use(gin.Recovery())
	router.Use(logger)

	router.GET("/healthz", ctrl.Health)

	apiV1 := router.Group("/api/v1")
	{
		apiV1.GET("/openapi.yaml", ctrl.OpenAPI)
		apiV1.GET("/version", ctrl.Version)
	}
	files := apiV1.Group("/files")
	{
		files.POST("/", ctrl.UploadFile)
		files.GET("/:id", ctrl.GetFile)
		files.HEAD("/:id", ctrl.GetFileInformation)
		files.PUT("/:id", ctrl.UpdateFile)
		files.DELETE("/:id", ctrl.DeleteFile)
	}

	ops := apiV1.Group("/ops")
	{
		ops.POST("list-orphans", ctrl.ListOrphans)
		ops.POST("delete-orphans", ctrl.DeleteOrphans)
		ops.POST("list-broken-metadata", ctrl.ListBrokenMetadata)
		ops.POST("delete-broken-metadata", ctrl.DeleteBrokenMetadata)
		ops.POST("list-not-uploaded", ctrl.ListNotUploaded)
	}
	return router, nil
}

func (ctrl *Controller) Health(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"healthz": "ok",
	})
}
