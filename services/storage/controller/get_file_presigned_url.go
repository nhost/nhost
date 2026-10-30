package controller

import (
	"cmp"
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/middleware"
)

type GetFilePresignedURLResponse struct {
	Error      *ErrorResponse `json:"error,omitempty"`
	URL        string         `json:"url,omitempty"`
	Expiration int            `json:"expiration,omitempty"`
}

type GetFilePresignedURLRequest struct {
	FileID string
}

// maxPresignedURLExpiration is the longest validity an S3 SigV4 presigned
// URL can have (7 days).
const maxPresignedURLExpiration = 7 * 24 * 60 * 60

var (
	errExpirationOverrideRequiresAdmin = errors.New(
		"overriding the presigned URL expiration requires the admin secret",
	)
	errExpirationOutOfRange = fmt.Errorf(
		"expiresIn must be between 1 and %d seconds", maxPresignedURLExpiration,
	)
)

// isAdmin reports whether the request carries the configured admin secret.
// The presigned URL endpoint is not gated by the admin-secret security scheme,
// so the header has to be checked here rather than in AuthenticationFunc.
func (ctrl *Controller) isAdmin(sessionHeaders http.Header) bool {
	secret := sessionHeaders.Get("X-Hasura-Admin-Secret")
	if ctrl.hasuraAdminSecret == "" || secret == "" {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(secret), []byte(ctrl.hasuraAdminSecret)) == 1
}

// presignedURLExpiration returns the requested expiration override in seconds,
// or 0 when the bucket's download expiration applies.
func (ctrl *Controller) presignedURLExpiration(
	expiresIn *int, sessionHeaders http.Header,
) (int, *APIError) {
	if expiresIn == nil {
		return 0, nil
	}

	if !ctrl.isAdmin(sessionHeaders) {
		return 0, ForbiddenError(
			errExpirationOverrideRequiresAdmin, errExpirationOverrideRequiresAdmin.Error(),
		)
	}

	if *expiresIn < 1 || *expiresIn > maxPresignedURLExpiration {
		return 0, BadDataError(errExpirationOutOfRange, errExpirationOutOfRange.Error())
	}

	return *expiresIn, nil
}

func (ctrl *Controller) GetFilePresignedURL( //nolint:ireturn
	ctx context.Context,
	request api.GetFilePresignedURLRequestObject,
) (api.GetFilePresignedURLResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	logger = logger.With("file_id", request.Id)

	sessionHeaders := middleware.SessionHeadersFromContext(ctx)

	expirationOverride, apiErr := ctrl.presignedURLExpiration(
		request.Params.ExpiresIn, sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "invalid presigned URL expiration", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, true, sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "error getting file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	if !bucketMetadata.PresignedURLsEnabled {
		err := errors.New( //nolint: err113
			"presigned URLs are not enabled on the bucket where this file is located in",
		)

		logger.ErrorContext(ctx, "presigned URLs not enabled for bucket")

		return ForbiddenError(err, err.Error()), nil
	}

	expiration := cmp.Or(expirationOverride, bucketMetadata.DownloadExpiration)

	signature, apiErr := ctrl.contentStorage.CreatePresignedURL(
		ctx,
		fileMetadata.Id,
		time.Duration(expiration)*time.Second,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "error creating presigned URL for file", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	url := fmt.Sprintf(
		"%s%s/files/%s/presignedurl/contents?%s",
		ctrl.publicURL, ctrl.apiRootPrefix, fileMetadata.Id, signature,
	)

	return api.GetFilePresignedURL200JSONResponse{
		Expiration: expiration,
		Url:        url,
	}, nil
}
