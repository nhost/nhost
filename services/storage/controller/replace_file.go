package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
	"github.com/nhost/nhost/services/storage/middleware/cdn/fastly"
)

type replaceFileMetadata struct {
	Name     string         `json:"name"`
	Metadata map[string]any `json:"metadata"`
}

type ReplaceFileResponse struct {
	*api.FileMetadata

	Error *ErrorResponse `json:"error,omitempty"`
}

func replaceFileParseRequest(request api.ReplaceFileRequestObject) (fileData, *APIError) {
	res := fileData{
		ID:       request.Id,
		Name:     "",
		Metadata: nil,
		header:   nil,
	}

	form, err := request.Body.ReadForm(maxFormMemory)
	if err != nil {
		return fileData{}, InternalServerError(
			fmt.Errorf("problem reading multipart form: %w", err),
		)
	}

	file := form.File["file"]
	if len(file) != 1 {
		return fileData{}, ErrMultipartFileWrong
	}

	res.header = file[0]
	res.Name = file[0].Filename

	metadata, ok := form.Value["metadata"]
	if ok {
		if len(metadata) != len(file) {
			return fileData{}, ErrMetadataLength
		}

		var d replaceFileMetadata
		if err := json.Unmarshal([]byte(metadata[0]), &d); err != nil {
			return fileData{}, WrongMetadataFormatError(err)
		}

		res.Name = d.Name
		res.Metadata = d.Metadata
	}

	return res, nil
}

func (ctrl *Controller) ReplaceFile( //nolint:funlen,ireturn
	ctx context.Context,
	request api.ReplaceFileRequestObject,
) (api.ReplaceFileResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	file, apiErr := replaceFileParseRequest(request)
	if apiErr != nil {
		logger.ErrorContext(ctx, "problem parsing request", slog.String("error", apiErr.Error()))
		return apiErr, nil
	}

	originalMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, false, sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "problem getting file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	if apiErr = checkFileSize(
		file.header, bucketMetadata.MinUploadFile, bucketMetadata.MaxUploadFile,
	); apiErr != nil {
		wrappedErr := fmt.Errorf("problem checking file size %s: %w", file.Name, apiErr)
		logger.ErrorContext(
			ctx, "problem checking file size",
			slog.String("error", wrappedErr.Error()),
			slog.String("fileName", file.Name),
		)

		return InternalServerError(wrappedErr), nil
	}

	fileContent, contentType, apiErr := ctrl.getMultipartFile(file)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "problem getting multipart file",
			slog.String("error", apiErr.Error()),
			slog.String("fileName", file.Name),
		)

		return apiErr, nil
	}
	defer fileContent.Close()

	if apiErr := ctrl.scanAndReportVirus(
		ctx, fileContent, file.ID, file.Name, sessionHeaders,
	); apiErr != nil {
		logger.ErrorContext(
			ctx, "problem scanning file for viruses",
			slog.String("error", apiErr.Error()),
			slog.String("fileName", file.Name),
		)

		return apiErr, nil
	}

	if apiErr := ctrl.metadataStorage.SetIsUploaded(
		ctx, file.ID, false, sessionHeaders,
	); apiErr != nil {
		logger.ErrorContext(
			ctx, "problem flagging file as pending upload",
			slog.String("error", apiErr.Error()),
			slog.String("fileName", file.Name),
		)

		return apiErr, nil
	}

	etag, apiErr := ctrl.contentStorage.PutFile(ctx, fileContent, file.ID, contentType)
	if apiErr != nil {
		// let's revert the change to isUploaded
		_ = ctrl.metadataStorage.SetIsUploaded(ctx, file.ID, true, sessionHeaders)
		logger.ErrorContext(
			ctx, "problem uploading file to storage",
			slog.String("error", apiErr.Error()),
			slog.String("fileName", file.Name),
		)

		return apiErr, nil
	}

	newMetadata, apiErr := ctrl.metadataStorage.PopulateMetadata(
		ctx,
		file.ID, file.Name, file.header.Size, originalMetadata.BucketId, etag, true, contentType,
		file.Metadata,
		sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "problem populating file metadata for file",
			slog.String("error", apiErr.Error()),
			slog.String("fileName", file.Name),
		)

		return apiErr, nil
	}

	fastly.FileChangedToContext(ctx, request.Id)

	return api.ReplaceFile200JSONResponse(newMetadata), nil
}
