package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
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

//go:generate mockgen --build_flags=--mod=mod -destination mock_controller/metadata_storage.go -package mock_controller . MetadataStorage
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

//go:generate mockgen --build_flags=--mod=mod -destination mock_controller/content_storage.go -package mock_controller . ContentStorage
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
	router.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "PUT", "POST", "HEAD", "DELETE"},
		AllowHeaders: []string{
			"Authorization", "Origin", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since",
		},
		// AllowWildcard: true,
		ExposeHeaders: []string{
			"Content-Length", "Content-Type", "Cache-Control", "ETag", "Last-Modified", "X-Error",
		},
		MaxAge: 12 * time.Hour, // nolint: gomnd
	}))

	router.GET("/healthz", ctrl.Health)

	apiRoot := router.Group("/v1/storage")
	{
		apiRoot.GET("/openapi.yaml", ctrl.OpenAPI)
		apiRoot.GET("/version", ctrl.Version)
	}
	files := apiRoot.Group("/files")
	{
		files.POST("", ctrl.UploadFile) // To delete
		files.POST("/", ctrl.UploadFile)
		files.GET("/:id", ctrl.GetFile)
		files.HEAD("/:id", ctrl.GetFileInformation)
		files.PUT("/:id", ctrl.UpdateFile)
		files.DELETE("/:id", ctrl.DeleteFile)
		files.GET("/:id/presignedurl", ctrl.GetFilePresignedURL)
	}

	ops := apiRoot.Group("/ops")
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
