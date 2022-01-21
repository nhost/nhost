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
) (FileMetadataWithBucket, *APIError) {
	fileMetadata, err := ctrl.metadataStorage.GetFileByID(ctx, fileID, headers)
	if err != nil {
		return FileMetadataWithBucket{}, err
	}

	if !fileMetadata.IsUploaded {
		return FileMetadataWithBucket{}, ForbiddenError(nil, "you are not auhtorized")
	}

	return fileMetadata, nil
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
	fileMetadata FileMetadataWithBucket,
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

func writeCachingHeaders(ctx *gin.Context, fileMetadata FileMetadataWithBucket) *APIError {
	lastModified, err := time.Parse(time.RFC3339, fileMetadata.UpdatedAt)
	if err != nil {
		return InternalServerError(err)
	}

	ctx.Header("Cache-Control", fileMetadata.Bucket.CacheControl)
	ctx.Header("Content-Length", fmt.Sprintf("%d", fileMetadata.Size))
	ctx.Header("Content-Type", fileMetadata.MimeType)
	ctx.Header("ETag", fileMetadata.ETag)
	ctx.Header("Last-modified", lastModified.Format(time.RFC1123))

	return nil
}

func (ctrl *Controller) getFileInformationProcess(ctx *gin.Context) (string, string, int, *APIError) {
	req, apiErr := ctrl.getFileParse(ctx)
	if apiErr != nil {
		return "", "", 0, apiErr
	}

	id := ctx.Param("id")
	fileMetadata, apiErr := ctrl.getFileMetadata(ctx.Request.Context(), id, ctx.Request.Header)
	if apiErr != nil {
		return "", "", 0, apiErr
	}

	statusCode, apiErr := checkConditionals(fileMetadata, req.headers)
	if apiErr != nil {
		return "", "", 0, apiErr
	}

	if apiErr := writeCachingHeaders(ctx, fileMetadata); apiErr != nil {
		return "", "", 0, apiErr
	}

	return fmt.Sprintf("%s/%s", fileMetadata.BucketID, req.fileID), fileMetadata.Name, statusCode, nil
}

func (ctrl *Controller) GetFileInformation(ctx *gin.Context) {
	_, _, statusCode, apiErr := ctrl.getFileInformationProcess(ctx)
	if apiErr != nil {
		_ = ctx.Error(fmt.Errorf("problem parsing request: %w", apiErr))

		ctx.Header("X-Error", apiErr.publicMessage)
		ctx.AbortWithStatus(apiErr.statusCode)

		return
	}

	ctx.AbortWithStatus(statusCode)
}
