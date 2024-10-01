package controller

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	x, err := strconv.ParseFloat(s, 32)
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
			return image.Options{},
				BadDataError(
					fmt.Errorf( //nolint: goerr113
						"image manipulation features are not supported for '%s'", mimeType,
					),
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

type getFileFunc func() (*File, *APIError)

func (ctrl *Controller) processFileToDownload( //nolint: funlen
	ctx *gin.Context,
	downloadFunc getFileFunc,
	fileMetadata FileMetadata,
	cacheControl string,
	infoHeaders *getFileInformationHeaders,
) (*FileResponse, *APIError) {
	opts, apiErr := getImageManipulationOptions(ctx, fileMetadata.MimeType)
	if apiErr != nil {
		return nil, apiErr
	}

	// we remove this header if image manipulation options are specified
	// because we pass them as is to the storage backend which means
	// we'd get a partial file prior to performing the image manipulation
	rangeHeader := ctx.Request.Header.Get("Range")
	if !opts.IsEmpty() {
		ctx.Request.Header.Set("Range", "")
	}
	download, apiErr := downloadFunc()
	if apiErr != nil {
		return nil, apiErr
	}
	ctx.Request.Header.Set("Range", rangeHeader)

	updateAt, apiErr := timeFromRFC3339ToRFC1123(fileMetadata.UpdatedAt)
	if apiErr != nil {
		return nil, apiErr
	}

	body := download.Body
	contentLength := download.ContentLength
	etag := download.Etag

	if !opts.IsEmpty() {
		defer body.Close()

		body, contentLength, etag, apiErr = ctrl.manipulateImage(
			body, uint64(contentLength), opts, //nolint:gosec
		)
		if apiErr != nil {
			return nil, apiErr
		}

		updateAt = time.Now().Format(time.RFC3339)

		if _, ok := download.ExtraHeaders["Content-Range"]; ok {
			download.ExtraHeaders["Content-Range"] = []string{
				fmt.Sprintf("bytes 0-%d/%d", contentLength-1, contentLength),
			}
		}
	}

	statusCode := download.StatusCode
	if infoHeaders != nil {
		statusCode, apiErr = checkConditionals(etag, updateAt, infoHeaders, download.StatusCode)
		if apiErr != nil {
			return nil, apiErr
		}
	}
	return NewFileResponse(
		fileMetadata.ID,
		fileMetadata.MimeType,
		contentLength,
		etag,
		cacheControl,
		updateAt,
		statusCode,
		body,
		fileMetadata.Name,
		download.ExtraHeaders,
	), nil
}

func (ctrl *Controller) getFileProcess(ctx *gin.Context) (*FileResponse, *APIError) {
	req, apiErr := ctrl.getFileParse(ctx)
	if apiErr != nil {
		return nil, apiErr
	}

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx.Request.Context(), req.fileID, true, ctx.Request.Header,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	downloadFunc := func() (*File, *APIError) {
		return ctrl.contentStorage.GetFile(ctx, fileMetadata.ID, ctx.Request.Header)
	}

	response, apiErr := ctrl.processFileToDownload(
		ctx, downloadFunc, fileMetadata, bucketMetadata.CacheControl, &req.headers)
	if apiErr != nil {
		return nil, apiErr
	}

	if response.statusCode == http.StatusOK {
		// if we want to download files at some point prepend `attachment;` before filename
		response.headers.Add(
			"Content-Disposition",
			fmt.Sprintf(`inline; filename="%s"`, url.QueryEscape(fileMetadata.Name)),
		)
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
