package controller

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (ctrl *Controller) getFileMetadata(
	ctx context.Context,
	fileID string,
	headers http.Header,
) (FileMetadata, BucketMetadata, *APIError) {
	fileMetadata, apiErr := ctrl.metadataStorage.GetFileByID(ctx, fileID, headers)
	if apiErr != nil {
		return FileMetadata{}, BucketMetadata{}, apiErr
	}

	if !fileMetadata.IsUploaded {
		return FileMetadata{}, BucketMetadata{}, ForbiddenError(nil, "you are not auhtorized")
	}

	bucketMetadata, apiErr := ctrl.metadataStorage.GetBucketByID(
		ctx, fileMetadata.BucketID, http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return FileMetadata{}, BucketMetadata{}, apiErr
	}

	return fileMetadata, bucketMetadata, nil
}

type getFileInformationHeaders struct {
	IfMatch           []string `header:"if-match"`
	IfNoneMatch       []string `header:"if-none-match"`
	IfModifiedSince   string   `header:"if-modified-since"`
	IfUnmodifiedSince string   `header:"if-unmodified-since"`
}

type getFileRequest struct {
	fileID  string
	headers getFileInformationHeaders
}

func (ctrl *Controller) getFileParse(ctx *gin.Context) (getFileRequest, *APIError) {
	var headers getFileInformationHeaders
	if err := ctx.ShouldBindHeader(&headers); err != nil {
		return getFileRequest{}, InternalServerError(fmt.Errorf("problem parsing request headers: %w", err))
	}

	return getFileRequest{ctx.Param("id"), headers}, nil
}

func etagFound(etag string, candidates []string) bool {
	matches := false
	for _, m := range candidates {
		if m == etag {
			matches = true
			break
		}
	}
	return matches
}

func modifiedSince(updatedAt string, modifiedSince string) (bool, *APIError) {
	modtime, err := time.Parse(time.RFC3339, updatedAt)
	if err != nil {
		return false, InternalServerError(err)
	}

	wants, err := time.Parse(time.RFC1123, modifiedSince)
	if err != nil {
		return false, ErrWrongDate
	}

	return modtime.After(wants), nil
}

func checkConditionals( // nolint: cyclop
	fileMetadata FileMetadata,
	headers getFileInformationHeaders,
) (int, *APIError) {
	if len(headers.IfMatch) > 0 && !etagFound(fileMetadata.ETag, headers.IfMatch) {
		return http.StatusPreconditionFailed, nil
	}

	if len(headers.IfNoneMatch) > 0 && etagFound(fileMetadata.ETag, headers.IfNoneMatch) {
		return http.StatusNotModified, nil
	}

	if headers.IfModifiedSince != "" {
		b, err := modifiedSince(fileMetadata.UpdatedAt, headers.IfModifiedSince)
		if err != nil {
			return 0, err
		}
		if !b {
			return http.StatusNotModified, nil
		}
	}

	if headers.IfUnmodifiedSince != "" {
		b, err := modifiedSince(fileMetadata.UpdatedAt, headers.IfUnmodifiedSince)
		if err != nil {
			return 0, err
		}
		if b {
			return http.StatusPreconditionFailed, nil
		}
	}

	return http.StatusOK, nil
}

func (ctrl *Controller) getFileInformationProcess(ctx *gin.Context) (*FileResponse, *APIError) {
	req, apiErr := ctrl.getFileParse(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	id := ctx.Param("id")
	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(ctx.Request.Context(), id, ctx.Request.Header)
	if apiErr != nil {
		return nil, apiErr
	}

	statusCode, apiErr := checkConditionals(fileMetadata, req.headers)
	if apiErr != nil {
		return nil, apiErr
	}

	opts, apiErr := getImageManipulationOptions(ctx, fileMetadata.MimeType)
	if apiErr != nil {
		return nil, apiErr
	}

	updateAt, apiErr := timeInRFC3339(fileMetadata.UpdatedAt)
	if apiErr != nil {
		return nil, apiErr
	}

	if len(opts) > 0 {
		object, apiErr := ctrl.contentStorage.GetFile(fileMetadata.ID)
		if apiErr != nil {
			return nil, apiErr
		}
		defer object.Close()

		object, fileMetadata.Size, fileMetadata.ETag, apiErr = ctrl.manipulateImage(ctx.Request.Context(), object, opts...)
		if apiErr != nil {
			return nil, apiErr
		}
		defer object.Close()

		updateAt = time.Now().Format(time.RFC3339)
	}

	return NewFileResponse(
		fileMetadata.MimeType,
		fileMetadata.Size,
		fileMetadata.ETag,
		bucketMetadata.CacheControl,
		updateAt,
		statusCode,
		nil,
		fileMetadata.Name,
		make(http.Header),
	), nil
}

func (ctrl *Controller) GetFileInformation(ctx *gin.Context) {
	response, apiErr := ctrl.getFileInformationProcess(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem parsing request: %w", apiErr))

		ctx.Header("X-Error", apiErr.publicMessage)
		ctx.AbortWithStatus(apiErr.statusCode)

		return
	}

	response.Write(ctx)
}
