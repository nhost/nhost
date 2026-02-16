package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/image"
	"github.com/nhost/nhost/services/storage/middleware"
)

func deptr[T any](v *T) T { //nolint:ireturn
	if v == nil {
		var zero T
		return zero
	}

	return *v
}

func mimeTypeToImageType(mimeType string) (image.ImageType, *APIError) {
	switch mimeType {
	case "image/webp":
		return image.ImageTypeWEBP, nil
	case "image/png":
		return image.ImageTypePNG, nil
	case "image/jpeg":
		return image.ImageTypeJPEG, nil
	case "image/avif":
		return image.ImageTypeAVIF, nil
	case "image/heic", "image/heif":
		return image.ImageTypeHEIC, nil
	default:
		return 0, BadDataError(
			fmt.Errorf( //nolint: err113
				"image manipulation features are not supported for '%s'", mimeType,
			),
			fmt.Sprintf("image manipulation features are not supported for '%s'", mimeType),
		)
	}
}

func chooseImageFormat( //nolint: cyclop
	params ImageManipulationOptionsGetter,
	mimeType string,
	acceptHeader []string,
) (image.ImageType, image.ImageType, *APIError) {
	format := deptr(params.GetF())
	if format == "" {
		format = "same"
	}

	originalFormat, err := mimeTypeToImageType(mimeType)
	if err != nil {
		return 0, 0, err
	}

	switch format {
	case "", api.Same:
		return originalFormat, originalFormat, nil
	case api.Webp:
		return originalFormat, image.ImageTypeWEBP, nil
	case api.Png:
		return originalFormat, image.ImageTypePNG, nil
	case api.Jpeg:
		return originalFormat, image.ImageTypeJPEG, nil
	case api.Avif:
		return originalFormat, image.ImageTypeAVIF, nil
	case api.Heic:
		return originalFormat, image.ImageTypeHEIC, nil
	case api.Auto:
		for _, acceptHeader := range acceptHeader {
			acceptedTypes := strings.Split(acceptHeader, ",")
			switch {
			case slices.Contains(acceptedTypes, "image/avif"):
				return originalFormat, image.ImageTypeAVIF, nil
			case slices.Contains(acceptedTypes, "image/webp"):
				return originalFormat, image.ImageTypeWEBP, nil
			case slices.Contains(acceptedTypes, "image/jpeg"):
				return originalFormat, image.ImageTypeJPEG, nil
			case slices.Contains(acceptedTypes, "image/png"):
				return originalFormat, image.ImageTypePNG, nil
			case slices.Contains(acceptedTypes, "image/heic"):
				return originalFormat, image.ImageTypeHEIC, nil
			}
		}

		return originalFormat, originalFormat, nil
	default:
		return 0, 0, BadDataError(
			//nolint: err113
			fmt.Errorf(
				"format must be one of: same, webp, png, jpeg, avif, heic, auto. Got: %s",
				format,
			),
			"format must be one of: same, webp, png, jpeg, avif, heic, auto. Got: "+string(format),
		)
	}
}

type ImageManipulationOptionsGetter interface {
	GetH() *int
	GetW() *int
	GetB() *float32
	GetQ() *int
	GetF() *api.OutputImageFormat
}

func getImageManipulationOptions(
	params ImageManipulationOptionsGetter,
	mimeType string,
	acceptHeader []string,
) (image.Options, *APIError) {
	outputFormatFound := deptr(params.GetF()) != ""

	opts := image.Options{
		Height:         deptr(params.GetH()),
		Width:          deptr(params.GetW()),
		Blur:           deptr(params.GetB()),
		Quality:        deptr(params.GetQ()),
		OriginalFormat: 0,
		Format:         0,
	}
	if !opts.IsEmpty() || outputFormatFound {
		orig, format, err := chooseImageFormat(params, mimeType, acceptHeader)
		opts.Format = format
		opts.OriginalFormat = orig

		if err != nil {
			return image.Options{}, err
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
) (io.ReadCloser, int64, *APIError) {
	defer object.Close()

	buf := &bytes.Buffer{}

	done := make(chan error, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("panic in image manipulation", slog.Any("panic", r))

				done <- fmt.Errorf("panic in image manipulation: %v", r) //nolint: err113
			}
		}()

		done <- ctrl.imageTransformer.Run(object, size, buf, opts)
	}()

	if err := <-done; err != nil {
		slog.Error("image manipulation failed", slog.String("error", err.Error()))

		return nil, 0, InternalServerError(err)
	}

	return NewP(buf.Bytes()), int64(buf.Len()), nil
}

func getFileNameAndMimeType(fileMetadata api.FileMetadata, opts image.Options) (string, string) {
	filename := fileMetadata.Name
	mimeType := fileMetadata.MimeType

	if opts.FormatChanged() {
		filename = fmt.Sprintf("%s.%s", filename, opts.FileExtension())
		mimeType = opts.FormatMimeType()
	}

	return filename, mimeType
}

type getFileFunc func() (*File, *APIError)

type processFiler interface {
	ImageManipulationOptionsGetter
	ConditionalChecksGetter
}

type processedFile struct {
	statusCode    int
	body          io.ReadCloser
	fileMetadata  api.FileMetadata
	filename      string
	cacheControl  string
	mimeType      string
	contentLength int64
	extraHeaders  http.Header
}

func (ctrl *Controller) processFileToDownload(
	downloadFunc getFileFunc,
	fileMetadata api.FileMetadata,
	cacheControl string,
	params processFiler,
	acceptHeader []string,
) (*processedFile, *APIError) {
	opts, apiErr := getImageManipulationOptions(params, fileMetadata.MimeType, acceptHeader)
	if apiErr != nil {
		return nil, apiErr
	}

	download, apiErr := downloadFunc()
	if apiErr != nil {
		return nil, apiErr
	}

	if download.ContentLength == fileMetadata.Size {
		// we force this in case they included a Content-Range header
		// but the file is not actually partial
		download.StatusCode = http.StatusOK
	}

	updateAt := fileMetadata.UpdatedAt.Format(time.RFC1123)

	body := download.Body
	contentLength := download.ContentLength

	if !opts.IsEmpty() {
		body, contentLength, apiErr = ctrl.manipulateImage(
			body, uint64(contentLength), opts, //nolint:gosec
		)
		if apiErr != nil {
			return nil, apiErr
		}

		updateAt = time.Now().Format(time.RFC3339)
	}

	statusCode, apiErr := checkConditionals(
		fileMetadata.Etag,
		updateAt,
		params,
		download.StatusCode,
	)
	if apiErr != nil {
		body.Close()

		return nil, apiErr
	}

	filename, mimeType := getFileNameAndMimeType(fileMetadata, opts)

	return &processedFile{
		statusCode:    statusCode,
		body:          body,
		fileMetadata:  fileMetadata,
		filename:      filename,
		cacheControl:  cacheControl,
		mimeType:      mimeType,
		contentLength: contentLength,
		extraHeaders:  download.ExtraHeaders,
	}, nil
}

func (ctrl *Controller) getFileResponse( //nolint: ireturn,dupl
	ctx context.Context,
	file *processedFile,
	logger *slog.Logger,
) api.GetFileResponseObject {
	switch file.statusCode {
	case http.StatusOK:
		return api.GetFile200ApplicationoctetStreamResponse{
			Body: file.body,
			Headers: api.GetFile200ResponseHeaders{
				AcceptRanges: "bytes",
				CacheControl: file.cacheControl,
				ContentDisposition: fmt.Sprintf(
					`inline; filename="%s"`,
					url.QueryEscape(file.filename),
				),
				ContentType:      file.mimeType,
				Etag:             file.fileMetadata.Etag,
				LastModified:     api.RFC2822Date(file.fileMetadata.UpdatedAt),
				SurrogateControl: file.cacheControl,
				SurrogateKey:     file.fileMetadata.Id,
			},
			ContentLength: file.contentLength,
		}
	case http.StatusPartialContent:
		return api.GetFile206ApplicationoctetStreamResponse{
			Body: file.body,
			Headers: api.GetFile206ResponseHeaders{
				CacheControl: file.cacheControl,
				ContentDisposition: fmt.Sprintf(
					`inline; filename="%s"`,
					url.QueryEscape(file.filename),
				),
				ContentRange:     file.extraHeaders.Get("Content-Range"),
				ContentType:      file.mimeType,
				Etag:             file.fileMetadata.Etag,
				LastModified:     api.RFC2822Date(file.fileMetadata.UpdatedAt),
				SurrogateControl: file.cacheControl,
				SurrogateKey:     file.fileMetadata.Id,
			},
			ContentLength: file.contentLength,
		}
	case http.StatusNotModified:
		file.body.Close()

		return api.GetFile304Response{
			Headers: api.GetFile304ResponseHeaders{
				CacheControl:     file.cacheControl,
				Etag:             file.fileMetadata.Etag,
				SurrogateControl: file.cacheControl,
			},
		}
	case http.StatusPreconditionFailed:
		file.body.Close()

		return api.GetFile412Response{
			Headers: api.GetFile412ResponseHeaders{
				CacheControl:     file.cacheControl,
				Etag:             file.fileMetadata.Etag,
				SurrogateControl: file.cacheControl,
			},
		}
	default:
		file.body.Close()

		logger.ErrorContext(
			ctx, "unexpected status code from download", slog.Int("statusCode", file.statusCode),
		)

		return ErrUnexpectedStatusCode
	}
}

func (ctrl *Controller) GetFile( //nolint:ireturn
	ctx context.Context,
	request api.GetFileRequestObject,
) (api.GetFileResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)
	sessionHeaders := middleware.SessionHeadersFromContext(ctx)
	acceptHeader := middleware.AcceptHeaderFromContext(ctx)

	fileMetadata, bucketMetadata, apiErr := ctrl.getFileMetadata(
		ctx, request.Id, true, sessionHeaders,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to get file metadata", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	downloadFunc := func() (*File, *APIError) {
		if request.Params.HasImageManipulationOptions() {
			return ctrl.contentStorage.GetFile(ctx, fileMetadata.Id, nil)
		}

		return ctrl.contentStorage.GetFile(ctx, fileMetadata.Id, request.Params.Range)
	}

	processedFile, apiErr := ctrl.processFileToDownload(
		downloadFunc,
		fileMetadata,
		bucketMetadata.CacheControl,
		request.Params,
		acceptHeader,
	)
	if apiErr != nil {
		logger.ErrorContext(
			ctx, "failed to process file for download", slog.String("error", apiErr.Error()),
		)

		return apiErr, nil
	}

	return ctrl.getFileResponse(ctx, processedFile, logger), nil
}
