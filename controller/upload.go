package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// this type is used to ensure we respond consistently no matter the case.
type UploadResponse struct {
	ProcessedFiles []FileMetadata `json:"processedFiles,omitempty"`
	Error          *ErrorResponse `json:"error,omitempty"`
}

type fileData struct {
	Name   string `json:"name"`
	ID     string `json:"id"`
	header *multipart.FileHeader
}

type uploadRequest struct {
	bucketID string
	files    []fileData
	headers  http.Header
}

func checkFileSize(file *multipart.FileHeader, minSize, maxSize int) *APIError {
	if minSize > int(file.Size) {
		return FileTooSmallError(file.Filename, int(file.Size), minSize)
	} else if int(file.Size) > maxSize {
		return FileTooBigError(file.Filename, int(file.Size), maxSize)
	}

	return nil
}

func (ctrl *Controller) uploadFile(
	ctx context.Context,
	file fileData,
	bucket BucketMetadata,
	headers http.Header,
) (FileMetadata, *APIError) {
	fileContent, err := file.header.Open()
	if err != nil {
		return FileMetadata{}, InternalServerError(fmt.Errorf("problem opening file %s: %w", file.Name, err))
	}
	defer fileContent.Close()

	contentType, err := mimetype.DetectReader(fileContent)
	if err != nil {
		return FileMetadata{},
			InternalServerError(fmt.Errorf("problem figuring out content type for file %s: %w", file.Name, err))
	}

	apiErr := ctrl.metadataStorage.InitializeFile(ctx, file.ID, headers)
	if apiErr != nil {
		return FileMetadata{}, apiErr
	}

	filepath := bucket.ID + "/" + file.ID
	etag, apiErr := ctrl.contentStorage.PutFile(fileContent, filepath, contentType.String())
	if apiErr != nil {
		return FileMetadata{}, apiErr.ExtendError("problem uploading file to storage")
	}

	if bucket.PresignedURLsEnabled {
		_, aerr := ctrl.contentStorage.CreatePresignedURL(filepath, time.Duration(bucket.DownloadExpiration)*time.Minute)
		if aerr != nil {
			return FileMetadata{},
				aerr.ExtendError(fmt.Sprintf("problem creating presigned URL for file %s", file.Name))
		}
	}

	metadata, aerr := ctrl.metadataStorage.PopulateMetadata(
		ctx,
		file.ID, file.Name, file.header.Size, bucket.ID, etag, true, contentType.String(),
		headers,
	)
	if err != nil {
		return FileMetadata{}, aerr.ExtendError(fmt.Sprintf("problem populating file metadata for file %s", file.Name))
	}

	return metadata, nil
}

func (ctrl *Controller) upload(
	ctx context.Context,
	request uploadRequest,
) ([]FileMetadata, *APIError) {
	bucket, err := ctrl.metadataStorage.GetBucketByID(ctx, request.bucketID, request.headers)
	if err != nil {
		return nil, err
	}

	filesMetadata := make([]FileMetadata, 0, len(request.files))

	for _, file := range request.files {
		if err := checkFileSize(file.header, bucket.MinUploadFile, bucket.MaxUploadFile); err != nil {
			return filesMetadata, InternalServerError(fmt.Errorf("problem checking file size %s: %w", file.Name, err))
		}

		md, err := ctrl.uploadFile(ctx, file, bucket, request.headers)
		if err != nil {
			return filesMetadata, InternalServerError(fmt.Errorf("problem processing file %s: %w", file.Name, err))
		}
		filesMetadata = append(filesMetadata, md)
	}

	return filesMetadata, nil
}

func fileDataFromFormValue(md map[string][]string, fileHedaer *multipart.FileHeader, i int) (fileData, *APIError) {
	formValue := []byte("{}")
	userSpecified, ok := md["metadata[]"]
	if ok {
		formValue = []byte(userSpecified[i])
	}

	data := fileData{}

	if err := json.Unmarshal(formValue, &data); err != nil {
		return fileData{}, WrongMetadataFormatError(err)
	}
	data.header = fileHedaer

	return data, nil
}

func getBucketIDFromFormValue(md map[string][]string) string {
	bucketID, ok := md["bucket-id"]
	if ok {
		return bucketID[0]
	}
	return "default"
}

func parseFilesData(ctx *gin.Context) ([]fileData, string, *APIError) {
	form, err := ctx.MultipartForm()
	if err != nil {
		return nil, "", InternalServerError(fmt.Errorf("problem reading multipart form: %w", err))
	}

	files := form.File["file[]"]

	md, ok := form.Value["metadata[]"]
	if ok {
		if len(md) != len(files) {
			return nil, "", ErrMetadataLength
		}
	}
	res := make([]fileData, len(files))

	for idx, fileHeader := range files {
		fileReq, err := fileDataFromFormValue(form.Value, fileHeader, idx)
		if err != nil {
			return []fileData{}, "", err
		}
		if fileReq.Name == "" {
			fileReq.Name = fileHeader.Filename
		}
		if fileReq.ID == "" {
			fileReq.ID = uuid.New().String()
		}
		res[idx] = fileReq
	}

	return res, getBucketIDFromFormValue(form.Value), nil
}

func parseUploadRequest(ctx *gin.Context) (uploadRequest, *APIError) {
	files, bucketID, err := parseFilesData(ctx)
	if err != nil {
		return uploadRequest{}, err
	}

	return uploadRequest{
		bucketID: bucketID,
		files:    files,
		headers:  ctx.Request.Header,
	}, nil
}

func (ctrl *Controller) Upload(ctx *gin.Context) {
	request, apiErr := parseUploadRequest(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem parsing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, UploadResponse{nil, apiErr.PublicResponse()})

		return
	}

	filesMetadata, apiErr := ctrl.upload(ctx.Request.Context(), request)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, UploadResponse{filesMetadata, apiErr.PublicResponse()})

		return
	}

	ctx.JSON(http.StatusCreated, UploadResponse{filesMetadata, nil})
}
