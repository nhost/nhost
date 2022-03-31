package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/image"
)

// Only used if the request fails.
type GetFileResponse struct {
	Error *ErrorResponse `json:"error"`
}

func getQueryInt(ctx *gin.Context, param string) (int, bool, *APIError) {
	s, ok := ctx.GetQuery(param)
	if !ok {
		return 0, false, nil
	}
	x, err := strconv.Atoi(s)
	if err != nil {
		return 0, false, BadDataError(err, fmt.Sprintf("query parameter %s must be an int", param))
	}

	return x, true, nil
}

func isImage(mimeType string) bool {
	for _, supported := range []string{"image/webp", "image/png", "image/jpeg"} {
		if mimeType == supported {
			return true
		}
	}
	return false
}

func getImageManipulationOptions(ctx *gin.Context, mimeType string) ([]image.Options, *APIError) { // nolint: cyclop
	opts := make([]image.Options, 0, 3) // nolint: gomnd
	// newSizeX, y, q, b
	newSizeX, okX, err := getQueryInt(ctx, "w")
	if err != nil {
		return nil, err
	}
	newSizeY, okY, err := getQueryInt(ctx, "h")
	if err != nil {
		return nil, err
	}

	if okX || okY {
		opts = append(opts, image.WithNewSize(newSizeX, newSizeY))
	}

	q, ok, err := getQueryInt(ctx, "q")
	if err != nil {
		return nil, err
	}
	if ok {
		opts = append(opts, image.WithQuality(q))
	}

	b, ok, err := getQueryInt(ctx, "b")
	if err != nil {
		return nil, err
	}
	if ok {
		opts = append(opts, image.WithBlur(b))
	}

	if len(opts) > 0 && !isImage(mimeType) {
		return nil, BadDataError(
			fmt.Errorf("image manipulation features are not supported for '%s'", mimeType), // nolint: goerr113
			fmt.Sprintf("image manipulation features are not supported for '%s'", mimeType),
		)
	}

	return opts, nil
}

type FakeReadCloserWrapper struct {
	*bytes.Reader
}

func NewP(b []byte) *FakeReadCloserWrapper {
	return &FakeReadCloserWrapper{bytes.NewReader(b)}
}

func (p *FakeReadCloserWrapper) Close() error {
	return nil
}

func (ctrl *Controller) modifyImage(
	ctx context.Context, filepath string, opts ...image.Options,
) (io.ReadCloser, string, int, *APIError) {
	object, apiErr := ctrl.contentStorage.GetFile(filepath)
	if apiErr != nil {
		return nil, "", 0, apiErr
	}
	defer object.Close()

	buf := &bytes.Buffer{}
	if err := image.Manipulate(ctx, object, buf, opts...); err != nil {
		return nil, "", 0, InternalServerError(err)
	}

	image := NewP(buf.Bytes())
	hash := sha256.New()
	if _, err := io.Copy(hash, image); err != nil {
		return nil, "", 0, InternalServerError(err)
	}
	if _, err := image.Seek(0, 0); err != nil {
		return nil, "", 0, InternalServerError(err)
	}

	etag := fmt.Sprintf("\"%x\"", hash.Sum(nil))

	return image, etag, buf.Len(), nil
}

func (ctrl *Controller) getFileImage(
	ctx context.Context, fileMetadata *FileMetadataWithBucket, opts ...image.Options,
) (io.ReadCloser, *APIError) {
	var src io.ReadCloser
	if len(opts) > 0 {
		buf, etag, n, apiErr := ctrl.modifyImage(ctx, fileMetadata.ID, opts...)
		if apiErr != nil {
			return nil, apiErr
		}
		fileMetadata.Size = int64(n)
		fileMetadata.ETag = etag

		src = buf
	} else {
		object, apiErr := ctrl.contentStorage.GetFile(fileMetadata.ID)
		if apiErr != nil {
			return nil, apiErr
		}
		src = object
	}
	return src, nil
}

func (ctrl *Controller) getFileProcess(ctx *gin.Context) (int, *APIError) {
	req, apiErr := ctrl.getFileParse(ctx)
	if apiErr != nil {
		return 0, apiErr
	}

	id := ctx.Param("id")
	fileMetadata, apiErr := ctrl.getFileMetadata(ctx.Request.Context(), id, ctx.Request.Header)
	if apiErr != nil {
		return 0, apiErr
	}

	opts, apiErr := getImageManipulationOptions(ctx, fileMetadata.MimeType)
	if apiErr != nil {
		return 0, apiErr
	}

	object, apiErr := ctrl.getFileImage(ctx.Request.Context(), &fileMetadata, opts...)
	if apiErr != nil {
		return 0, apiErr
	}
	defer object.Close()

	statusCode, apiErr := checkConditionals(fileMetadata, req.headers)
	if apiErr != nil {
		return 0, apiErr
	}

	if apiErr := writeCachingHeaders(ctx, fileMetadata); apiErr != nil {
		return 0, apiErr
	}

	if statusCode == http.StatusOK {
		// if we want to download files at some point prepend `attachment;` before filename
		ctx.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, fileMetadata.Name))

		if _, err := io.Copy(ctx.Writer, object); err != nil {
			return 0, InternalServerError(err)
		}
	}

	return statusCode, nil
}

func (ctrl *Controller) GetFile(ctx *gin.Context) {
	statusCode, apiErr := ctrl.getFileProcess(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, GetFileResponse{apiErr.PublicResponse()})

		return
	}

	ctx.AbortWithStatus(statusCode)
}
