package controller

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type updateFileMetadata struct {
	Name     string         `json:"name"`
	Metadata map[string]any `json:"metadata"`
}

type UpdateFileResponse struct {
	*FileMetadata
	Error *ErrorResponse `json:"error,omitempty"`
}

func updateFileParseRequest(ctx *gin.Context) (fileData, *APIError) {
	res := fileData{
		ID: ctx.Param("id"),
	}

	form, err := ctx.MultipartForm()
	if err != nil {
		return fileData{}, InternalServerError(fmt.Errorf("problem reading multipart form: %w", err))
	}

	file := form.File["file"]
	if len(file) != 1 {
		return fileData{}, ErrMultipartFileWrong
	}

	res.header = file[0]

	metadata, ok := form.Value["metadata"]
	if ok { //nolint: nestif
		if len(metadata) != len(file) {
			return fileData{}, ErrMetadataLength
		}

		d := updateFileMetadata{}
		if err := json.Unmarshal([]byte(metadata[0]), &d); err != nil {
			return fileData{}, WrongMetadataFormatError(err)
		}

		res.Name = d.Name
		res.Metadata = d.Metadata
	} else {
		fileName := ctx.Request.Header.Get("x-nhost-file-name")
		if fileName == "" {
			fileName = res.header.Filename
		} else {
			ctx.Writer.Header().Add(
				"X-deprecation-warning-old-upload-file-method",
				"please, update the SDK to leverage new API endpoint or read the API docs to adapt your code",
			)
		}
		res.Name = fileName
	}

	return res, nil
}

func (ctrl *Controller) updateFile(ctx *gin.Context) (FileMetadata, *APIError) {
	file, apiErr := updateFileParseRequest(ctx)
	if apiErr != nil {
		return FileMetadata{}, apiErr
	}

	originalMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx.Request.Context(), file.ID, false, ctx.Request.Header,
	)
	if apiErr != nil {
		return FileMetadata{}, apiErr
	}

	if apiErr = checkFileSize(
		file.header,
		bucketMetadata.MinUploadFile,
		bucketMetadata.MaxUploadFile,
	); apiErr != nil {
		return FileMetadata{}, InternalServerError(fmt.Errorf("problem checking file size %s: %w", file.Name, apiErr))
	}

	if apiErr := ctrl.metadataStorage.SetIsUploaded(ctx, file.ID, false, ctx.Request.Header); apiErr != nil {
		return FileMetadata{}, apiErr.ExtendError(
			fmt.Sprintf("problem flagging file as pending upload %s: %s", file.Name, apiErr.Error()),
		)
	}

	fileContent, contentType, err := ctrl.getMultipartFile(file)
	if err != nil {
		return FileMetadata{}, err
	}
	defer fileContent.Close()

	if err := ctrl.scanAndReportVirus(
		ctx, fileContent, file.ID, file.Name, ctx.Request.Header,
	); err != nil {
		return FileMetadata{}, err
	}

	etag, apiErr := ctrl.contentStorage.PutFile(ctx, fileContent, file.ID, contentType)
	if apiErr != nil {
		// let's revert the change to isUploaded
		_ = ctrl.metadataStorage.SetIsUploaded(ctx, file.ID, true, ctx.Request.Header)

		return FileMetadata{}, apiErr.ExtendError("problem uploading file to storage")
	}

	newMetadata, apiErr := ctrl.metadataStorage.PopulateMetadata(
		ctx,
		file.ID, file.Name, file.header.Size, originalMetadata.BucketID, etag, true, contentType,
		file.Metadata,
		ctx.Request.Header,
	)
	if apiErr != nil {
		return FileMetadata{}, apiErr.ExtendError(fmt.Sprintf("problem populating file metadata for file %s", file.Name))
	}

	ctx.Set("FileChanged", file.ID)

	return newMetadata, nil
}

func (ctrl *Controller) UpdateFile(ctx *gin.Context) {
	metadata, apiErr := ctrl.updateFile(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem parsing request: %w", apiErr))

		ctx.Header("X-Error", apiErr.publicMessage)
		ctx.AbortWithStatus(apiErr.statusCode)

		ctx.JSON(apiErr.statusCode, UpdateFileResponse{nil, apiErr.PublicResponse()})

		return
	}

	ctx.JSON(http.StatusOK, UpdateFileResponse{&metadata, nil})
}
