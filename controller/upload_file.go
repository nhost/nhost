package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// this type is used to ensure we respond consistently no matter the case.
type UploadFileResponse struct {
	ProcessedFiles []FileMetadata `json:"processedFiles,omitempty"`
	Error          *ErrorResponse `json:"error,omitempty"`
}

type fileData struct {
	Name     string         `json:"name"`
	ID       string         `json:"id"`
	Metadata map[string]any `json:"metadata"`
	header   *multipart.FileHeader
}

type uploadFileRequest struct {
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

func (ctrl *Controller) getMultipartFile(file fileData) (multipart.File, string, *APIError) {
	fileContent, err := file.header.Open()
	if err != nil {
		return nil, "", InternalServerError(fmt.Errorf("problem opening file %s: %w", file.Name, err))
	}

	contentType := file.header.Header.Get("Content-Type")
	if contentType != "" && contentType != "application/octet-stream" {
		return fileContent, contentType, nil
	}

	mt, err := mimetype.DetectReader(fileContent)
	if err != nil {
		return nil, "",
			InternalServerError(fmt.Errorf("problem figuring out content type for file %s: %w", file.Name, err))
	}

	return fileContent, mt.String(), nil
}

func (ctrl *Controller) scanAndReportVirus(
	ctx context.Context,
	fileContent multipart.File,
	fileID string,
	filename string,
	headers http.Header,
) *APIError {
	if err := ctrl.av.ScanReader(fileContent); err != nil {
		err.SetData("file", filename)

		userSession := GetUserSession(headers)

		if err := ctrl.metadataStorage.InsertVirus(
			ctx, fileID, filename, err.GetDataString("virus"), userSession,
			http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
		); err != nil {
			err := err.ExtendError("problem inserting virus into database")
			return err
		}

		return err
	}

	return nil
}

func (ctrl *Controller) processFile(
	ctx context.Context,
	file fileData,
	bucket BucketMetadata,
	headers http.Header,
) (FileMetadata, *APIError) {
	if err := checkFileSize(file.header, bucket.MinUploadFile, bucket.MaxUploadFile); err != nil {
		return FileMetadata{}, InternalServerError(fmt.Errorf("problem checking file size %s: %w", file.Name, err))
	}

	fileContent, contentType, err := ctrl.getMultipartFile(file)
	if err != nil {
		return FileMetadata{}, err
	}
	defer fileContent.Close()

	if err := ctrl.metadataStorage.InitializeFile(
		ctx, file.ID, file.Name, file.header.Size, bucket.ID, contentType, headers,
	); err != nil {
		return FileMetadata{}, err
	}

	if err := ctrl.scanAndReportVirus(
		ctx, fileContent, file.ID, file.Name, headers,
	); err != nil {
		return FileMetadata{}, err
	}

	etag, apiErr := ctrl.contentStorage.PutFile(ctx, fileContent, file.ID, contentType)
	if apiErr != nil {
		_ = ctrl.metadataStorage.DeleteFileByID(
			ctx,
			file.ID,
			http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
		)
		return FileMetadata{}, apiErr.ExtendError("problem uploading file to storage")
	}

	metadata, apiErr := ctrl.metadataStorage.PopulateMetadata(
		ctx,
		file.ID, file.Name, file.header.Size, bucket.ID, etag, true, contentType, file.Metadata,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return FileMetadata{}, apiErr.ExtendError(fmt.Sprintf("problem populating file metadata for file %s", file.Name))
	}

	return metadata, nil
}

func (ctrl *Controller) upload(
	ctx context.Context,
	request uploadFileRequest,
) ([]FileMetadata, *APIError) {
	bucket, err := ctrl.metadataStorage.GetBucketByID(
		ctx,
		request.bucketID,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if err != nil {
		return nil, err
	}

	filesMetadata := make([]FileMetadata, 0, len(request.files))

	for _, file := range request.files {
		metadata, err := ctrl.processFile(ctx, file, bucket, request.headers)
		if err != nil {
			return filesMetadata, err
		}

		filesMetadata = append(filesMetadata, metadata)
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

func parseUploadRequestOld(ctx *gin.Context) (uploadFileRequest, *APIError) {
	form, err := ctx.MultipartForm()
	if err != nil {
		return uploadFileRequest{}, InternalServerError(fmt.Errorf("problem reading multipart form: %w", err))
	}

	fileForm, ok := form.File["file"]
	if !ok {
		return uploadFileRequest{}, ErrMultipartFormFileNotFound
	}

	fileHeader := fileForm[0]

	bucketID := ctx.Request.Header.Get("x-nhost-bucket-id")
	if bucketID == "" {
		bucketID = "default"
	}
	fileName := ctx.Request.Header.Get("x-nhost-file-name")
	if fileName == "" {
		fileName = fileHeader.Filename
	}
	fileID := ctx.Request.Header.Get("x-nhost-file-id")
	if fileID == "" {
		fileID = uuid.New().String()
	}

	ctx.Writer.Header().Add(
		"X-deprecation-warning-old-upload-file-method",
		"please, update the SDK to leverage new API endpoint or read the API docs to adapt your code",
	)

	return uploadFileRequest{
		bucketID: bucketID,
		files: []fileData{
			{
				Name:   fileName,
				ID:     fileID,
				header: fileHeader,
			},
		},
		headers: ctx.Request.Header,
	}, nil
}

func parseUploadRequestNew(ctx *gin.Context) (uploadFileRequest, *APIError) {
	form, err := ctx.MultipartForm()
	if err != nil {
		return uploadFileRequest{}, InternalServerError(fmt.Errorf("problem reading multipart form: %w", err))
	}

	files, ok := form.File["file[]"]
	if !ok {
		return uploadFileRequest{}, ErrMultipartFormFileNotFound
	}

	md, ok := form.Value["metadata[]"]
	if ok {
		if len(md) != len(files) {
			return uploadFileRequest{}, ErrMetadataLength
		}
	}
	processedFiles := make([]fileData, len(files))

	for idx, fileHeader := range files {
		fileReq, err := fileDataFromFormValue(form.Value, fileHeader, idx)
		if err != nil {
			return uploadFileRequest{}, err
		}
		if fileReq.Name == "" {
			fileReq.Name = fileHeader.Filename
		}
		if fileReq.ID == "" {
			fileReq.ID = uuid.New().String()
		}
		processedFiles[idx] = fileReq
	}

	return uploadFileRequest{
		bucketID: getBucketIDFromFormValue(form.Value),
		files:    processedFiles,
		headers:  ctx.Request.Header,
	}, nil
}

func parseUploadRequest(ctx *gin.Context) (uploadFileRequest, bool, *APIError) {
	newMethod := true
	req, apiErr := parseUploadRequestNew(ctx)
	if errors.Is(apiErr, ErrMultipartFormFileNotFound) {
		req, apiErr = parseUploadRequestOld(ctx)
		newMethod = false
	}
	return req, newMethod, apiErr
}

func (ctrl *Controller) uploadFile(ctx *gin.Context) ([]FileMetadata, bool, *APIError) {
	request, newMethod, apiErr := parseUploadRequest(ctx)
	if apiErr != nil {
		return nil, false, apiErr
	}

	filesMetadata, apiErr := ctrl.upload(ctx.Request.Context(), request)
	return filesMetadata, newMethod, apiErr
}

func (ctrl *Controller) UploadFile(ctx *gin.Context) {
	filesMetadata, newMethod, apiErr := ctrl.uploadFile(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem processing request: %w", apiErr))

		ctx.JSON(apiErr.statusCode, UploadFileResponse{filesMetadata, apiErr.PublicResponse()})

		return
	}

	if newMethod {
		ctx.JSON(http.StatusCreated, UploadFileResponse{filesMetadata, nil})
	} else {
		ctx.JSON(http.StatusCreated, filesMetadata[0])
	}
}
