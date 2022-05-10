package controller

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/image"
)

// Only used if the request fails.
type GetFileResponse struct {
	Error *ErrorResponse `json:"error"`
}

func getQueryInt(ctx *gin.Context, param string) (int, *APIError) {
	s, ok := ctx.GetQuery(param)
	if !ok {
		return 0, nil
	}
	x, err := strconv.Atoi(s)
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("query parameter %s must be an int", param))
	}

	return x, nil
}

func getQueryFloat(ctx *gin.Context, param string) (float64, *APIError) {
	s, ok := ctx.GetQuery(param)
	if !ok {
		return 0, nil
	}
	x, err := strconv.ParseFloat(s, 32) // nolint: gomnd
	if err != nil {
		return 0, BadDataError(err, fmt.Sprintf("query parameter %s must be an int", param))
	}

	return x, nil
}

func getImageManipulationOptions(ctx *gin.Context, mimeType string) (image.Options, *APIError) {
	w, err := getQueryInt(ctx, "w")
	if err != nil {
		return image.Options{}, err
	}
	h, err := getQueryInt(ctx, "h")
	if err != nil {
		return image.Options{}, err
	}

	q, err := getQueryInt(ctx, "q")
	if err != nil {
		return image.Options{}, err
	}

	b, err := getQueryFloat(ctx, "b")
	if err != nil {
		return image.Options{}, err
	}

	opts := image.Options{
		Height:  h,
		Width:   w,
		Blur:    b,
		Quality: q,
	}
	if !opts.IsEmpty() {
		switch mimeType {
		case "image/webp":
			opts.Format = image.ImageTypeWEBP
		case "image/png":
			opts.Format = image.ImageTypePNG
		case "image/jpeg":
			opts.Format = image.ImageTypeJPEG
		default:
			return image.Options{}, BadDataError(
				fmt.Errorf("image manipulation features are not supported for '%s'", mimeType), // nolint: goerr113
				fmt.Sprintf("image manipulation features are not supported for '%s'", mimeType),
			)
		}
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

func (ctrl *Controller) manipulateImage(
	object io.ReadCloser, size uint64, opts image.Options,
) (io.ReadCloser, int64, string, *APIError) {
	defer object.Close()

	buf := &bytes.Buffer{}
	if err := ctrl.imageTransformer.Run(object, size, buf, opts); err != nil {
		return nil, 0, "", InternalServerError(err)
	}

	image := NewP(buf.Bytes())
	hash := sha256.New()
	if _, err := io.Copy(hash, image); err != nil {
		return nil, 0, "", InternalServerError(err)
	}
	if _, err := image.Seek(0, 0); err != nil {
		return nil, 0, "", InternalServerError(err)
	}

	etag := fmt.Sprintf("\"%x\"", hash.Sum(nil))

	return NewP(buf.Bytes()), int64(buf.Len()), etag, nil
}

func (ctrl *Controller) processFileToDownload(
	ctx *gin.Context,
	object io.ReadCloser,
	fileMetadata FileMetadata,
	bucketMetadata BucketMetadata,
	infoHeaders getFileInformationHeaders,
) (*FileResponse, *APIError) {
	opts, apiErr := getImageManipulationOptions(ctx, fileMetadata.MimeType)
	if apiErr != nil {
		return nil, apiErr
	}

	updateAt, apiErr := timeInRFC3339(fileMetadata.UpdatedAt)
	if apiErr != nil {
		return nil, apiErr
	}

	if !opts.IsEmpty() {
		object, fileMetadata.Size, fileMetadata.ETag, apiErr = ctrl.manipulateImage(object, uint64(fileMetadata.Size), opts)
		if apiErr != nil {
			return nil, apiErr
		}

		updateAt = time.Now().Format(time.RFC3339)
	}

	statusCode, apiErr := checkConditionals(fileMetadata, infoHeaders)
	if apiErr != nil {
		return nil, apiErr
	}

	return NewFileResponse(
		fileMetadata.MimeType,
		fileMetadata.Size,
		fileMetadata.ETag,
		bucketMetadata.CacheControl,
		updateAt,
		statusCode,
		object,
		fileMetadata.Name,
		make(http.Header),
	), nil
}

func (ctrl *Controller) getFileProcess(ctx *gin.Context) (*FileResponse, *APIError) {
	req, apiErr := ctrl.getFileParse(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(ctx.Request.Context(), req.fileID, ctx.Request.Header)
	if apiErr != nil {
		return nil, apiErr
	}

	object, apiErr := ctrl.contentStorage.GetFile(fileMetadata.ID)
	if apiErr != nil {
		return nil, apiErr
	}

	response, apiErr := ctrl.processFileToDownload(ctx, object, fileMetadata, bucketMetadata, req.headers)
	if apiErr != nil {
		return nil, apiErr
	}

	if response.statusCode == http.StatusOK {
		// if we want to download files at some point prepend `attachment;` before filename
		response.headers.Add("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, fileMetadata.Name))
	}

	return response, nil
}

func (ctrl *Controller) GetFile(ctx *gin.Context) {
	response, apiErr := ctrl.getFileProcess(ctx)
	if apiErr != nil {
		_ = ctx.Error(apiErr)

		ctx.JSON(apiErr.statusCode, GetFileResponse{apiErr.PublicResponse()})

		return
	}

	defer response.body.Close()

	response.Write(ctx)
}
