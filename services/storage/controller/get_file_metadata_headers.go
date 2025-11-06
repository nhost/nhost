package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

func (ctrl *Controller) getFileMetadata(
	ctx context.Context,
	fileID string,
	checkIsUploaded bool,
	sessionHeaders http.Header,
) (api.FileMetadata, BucketMetadata, *APIError) {
	fileMetadata, apiErr := ctrl.metadataStorage.GetFileByID(ctx, fileID, sessionHeaders)
	if apiErr != nil {
		return api.FileMetadata{}, BucketMetadata{}, apiErr
	}

	if checkIsUploaded && !fileMetadata.IsUploaded {
		msg := "file is not uploaded"

		return api.FileMetadata{}, BucketMetadata{},
			ForbiddenError(errors.New(msg), msg) //nolint:err113
	}

	bucketMetadata, apiErr := ctrl.metadataStorage.GetBucketByID(
		ctx,
		fileMetadata.BucketId,
		http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}},
	)
	if apiErr != nil {
		return api.FileMetadata{}, BucketMetadata{}, apiErr
	}

	return fileMetadata, bucketMetadata, nil
}

func etagFound(etag string, candidate string) bool {
	return etag == candidate
}

func modifiedSince(updatedAt string, wants api.Time) (bool, *APIError) {
	modtime, err := time.Parse(time.RFC1123, updatedAt)
	if err != nil {
		return false, InternalServerError(err)
	}

	return modtime.After(time.Time(wants)), nil
}

type ConditionalChecksGetter interface {
	GetIfMatch() *string
	GetIfNoneMatch() *string
	GetIfModifiedSince() *api.Time
	GetIfUnmodifiedSince() *api.Time
}

func checkConditionals( //nolint: cyclop
	etag string,
	updatedAt string,
	params ConditionalChecksGetter,
	defaultStatusCode int,
) (int, *APIError) {
	if params.GetIfMatch() != nil && !etagFound(etag, deptr(params.GetIfMatch())) {
		return http.StatusPreconditionFailed, nil
	}

	if params.GetIfNoneMatch() != nil && etagFound(etag, deptr(params.GetIfNoneMatch())) {
		return http.StatusNotModified, nil
	}

	if params.GetIfModifiedSince() != nil {
		b, err := modifiedSince(updatedAt, *params.GetIfModifiedSince())
		if err != nil {
			return 0, err
		}

		if !b {
			return http.StatusNotModified, nil
		}
	}

	if params.GetIfUnmodifiedSince() != nil {
		b, err := modifiedSince(updatedAt, *params.GetIfUnmodifiedSince())
		if err != nil {
			return 0, err
		}

		if b {
			return http.StatusPreconditionFailed, nil
		}
	}

	return defaultStatusCode, nil
}

func (ctrl *Controller) getFileMetadataHeadersResponseObject( //nolint:ireturn
	statusCode int,
	bucketMetadata BucketMetadata,
	fileMetadata api.FileMetadata,
) (api.GetFileMetadataHeadersResponseObject, *APIError) {
	switch statusCode {
	case http.StatusOK:
		return api.GetFileMetadataHeaders200Response{
			Headers: api.GetFileMetadataHeaders200ResponseHeaders{
				AcceptRanges:     "bytes",
				CacheControl:     bucketMetadata.CacheControl,
				ContentType:      fileMetadata.MimeType,
				Etag:             fileMetadata.Etag,
				LastModified:     api.RFC2822Date(fileMetadata.UpdatedAt),
				SurrogateControl: bucketMetadata.CacheControl,
				SurrogateKey:     fileMetadata.Id,
				ContentDisposition: fmt.Sprintf(
					`inline; filename="%s"`,
					url.QueryEscape(fileMetadata.Name),
				),
				ContentLength: int(fileMetadata.Size),
			},
		}, nil
	case http.StatusNotModified:
		return api.GetFileMetadataHeaders304Response{
			Headers: api.GetFileMetadataHeaders304ResponseHeaders{
				CacheControl:     bucketMetadata.CacheControl,
				Etag:             fileMetadata.Etag,
				SurrogateControl: bucketMetadata.CacheControl,
			},
		}, nil
	case http.StatusPreconditionFailed:
		return api.GetFileMetadataHeaders412Response{
			Headers: api.GetFileMetadataHeaders412ResponseHeaders{
				CacheControl:     bucketMetadata.CacheControl,
				Etag:             fileMetadata.Etag,
				SurrogateControl: bucketMetadata.CacheControl,
			},
		}, nil
	default:
		return nil, ErrUnexpectedStatusCode
	}
}

func (ctrl *Controller) getFileMetadataHeaders( //nolint:ireturn
	ctx context.Context, request api.GetFileMetadataHeadersRequestObject,
) (api.GetFileMetadataHeadersResponseObject, *APIError) {
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)
	acceptHeader := middleware.AcceptHeaderFromContext(ctx)

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, true, sessionHeaders,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	updateAt := fileMetadata.UpdatedAt.Format(time.RFC1123)

	statusCode, apiErr := checkConditionals(
		fileMetadata.Etag, updateAt, request.Params, http.StatusOK,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	opts, apiErr := getImageManipulationOptions(request.Params, fileMetadata.MimeType, acceptHeader)
	if apiErr != nil {
		return nil, apiErr
	}

	if !opts.IsEmpty() {
		download, apiErr := ctrl.contentStorage.GetFile(ctx, fileMetadata.Id, nil)
		if apiErr != nil {
			return nil, apiErr
		}
		defer download.Body.Close()

		var object io.ReadCloser

		object, fileMetadata.Size, apiErr = ctrl.manipulateImage(
			download.Body, uint64(fileMetadata.Size), opts, //nolint:gosec
		)
		if apiErr != nil {
			return nil, apiErr
		}
		defer object.Close()
	}

	return ctrl.getFileMetadataHeadersResponseObject(statusCode, bucketMetadata, fileMetadata)
}

func (ctrl *Controller) GetFileMetadataHeaders( //nolint:ireturn
	ctx context.Context, request api.GetFileMetadataHeadersRequestObject,
) (api.GetFileMetadataHeadersResponseObject, error) {
	response, apiErr := ctrl.getFileMetadataHeaders(ctx, request)
	if apiErr != nil {
		return api.GetFileMetadataHeadersdefaultResponse{
			Headers: api.GetFileMetadataHeadersdefaultResponseHeaders{
				XError: apiErr.PublicMessage(),
			},
			StatusCode: apiErr.StatusCode(),
		}, nil
	}

	return response, nil
}
