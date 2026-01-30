package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"

	"github.com/gabriel-vasile/mimetype"
	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

const maxFormMemory = 1 << 20 // 1 MB

// UploadFileResponse is used to ensure we respond consistently no matter the case.
type UploadFileResponse struct {
	ProcessedFiles []api.FileMetadata `json:"processedFiles,omitempty"`
	Error          *ErrorResponse     `json:"error,omitempty"`
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
		return nil, "", InternalServerError(
			fmt.Errorf("problem opening file %s: %w", file.Name, err),
		)
	}

	contentType := file.header.Header.Get("Content-Type")
	if contentType != "" && contentType != "application/octet-stream" {
		return fileContent, contentType, nil
	}

	mt, err := mimetype.DetectReader(fileContent)
	if err != nil {
		return nil, "",
			InternalServerError(
				fmt.Errorf("problem figuring out content type for file %s: %w", file.Name, err),
			)
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
	if err := ctrl.av.ScanReader(ctx, fileContent); err != nil {
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
	sessionHeaders http.Header,
) (api.FileMetadata, *APIError) {
	if err := checkFileSize(file.header, bucket.MinUploadFile, bucket.MaxUploadFile); err != nil {
		return api.FileMetadata{}, InternalServerError(
			fmt.Errorf("problem checking file size %s: %w", file.Name, err),
		)
	}

	fileContent, contentType, err := ctrl.getMultipartFile(file)
	if err != nil {
		return api.FileMetadata{}, err
	}
	defer fileContent.Close()

	if err := ctrl.metadataStorage.InitializeFile(
		ctx, file.ID, file.Name, file.header.Size, bucket.ID, contentType, sessionHeaders,
	); err != nil {
		return api.FileMetadata{}, err
	}

	if err := ctrl.scanAndReportVirus(
		ctx, fileContent, file.ID, file.Name, sessionHeaders,
	); err != nil {
		return api.FileMetadata{}, err
	}

	etag, apiErr := ctrl.contentStorage.PutFile(ctx, fileContent, file.ID, contentType)
	if apiErr != nil {
		_ = ctrl.metadataStorage.DeleteFileByID(
			ctx,
			file.ID,
			http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
		)

		return api.FileMetadata{}, apiErr.ExtendError("problem uploading file to storage")
	}

	metadata, apiErr := ctrl.metadataStorage.PopulateMetadata(
		ctx,
		file.ID, file.Name, file.header.Size, bucket.ID, etag, true, contentType, file.Metadata,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return api.FileMetadata{}, apiErr.ExtendError(
			"problem populating file metadata for file " + file.Name,
		)
	}

	return metadata, nil
}

func (ctrl *Controller) upload(
	ctx context.Context,
	request uploadFileRequest,
	sessionHeaders http.Header,
) ([]api.FileMetadata, *APIError) {
	bucket, err := ctrl.metadataStorage.GetBucketByID(
		ctx,
		request.bucketID,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if err != nil {
		return nil, err
	}

	filesMetadata := make([]api.FileMetadata, 0, len(request.files))

	for _, file := range request.files {
		metadata, err := ctrl.processFile(ctx, file, bucket, sessionHeaders)
		if err != nil {
			return filesMetadata, err
		}

		filesMetadata = append(filesMetadata, metadata)
	}

	return filesMetadata, nil
}

func fileDataFromFormValue(
	md map[string][]string,
	fileHedaer *multipart.FileHeader,
	i int,
) (fileData, *APIError) {
	formValue := []byte("{}")

	userSpecified, ok := md["metadata[]"]
	if ok {
		formValue = []byte(userSpecified[i])
	}

	var data fileData
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

func parseUploadRequest(form *multipart.Form) (uploadFileRequest, *APIError) {
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
	}, nil
}

func (ctrl *Controller) UploadFiles( //nolint:ireturn
	ctx context.Context, request api.UploadFilesRequestObject,
) (api.UploadFilesResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	form, err := request.Body.ReadForm(maxFormMemory)
	if err != nil {
		logger.ErrorContext(
			ctx, "problem reading multipart form", slog.String("error", err.Error()),
		)

		return InternalServerError(err), nil
	}
	defer form.RemoveAll() //nolint:errcheck

	uploadFilesRequest, apiErr := parseUploadRequest(form)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "problem parsing upload request", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	fm, apiErr := ctrl.upload(ctx, uploadFilesRequest, sessionHeaders)
	if apiErr != nil {
		logger.ErrorContext(ctx, "problem uploading files", slog.String("error", apiErr.Error()))

		return api.UploadFilesdefaultJSONResponse{
			Body: api.ErrorResponseWithProcessedFiles{
				Error: &struct {
					Data    *map[string]any `json:"data,omitempty"`
					Message string          `json:"message"`
				}{
					Data:    &apiErr.data,
					Message: apiErr.PublicMessage(),
				},
				ProcessedFiles: &fm,
			},
			StatusCode: apiErr.StatusCode(),
		}, nil
	}

	return api.UploadFiles201JSONResponse{
		ProcessedFiles: fm,
	}, nil
}
