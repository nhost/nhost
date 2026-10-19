package controller_test

import (
	"bytes"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/image"
	gomock "go.uber.org/mock/gomock"
)

func TestImageRevalidationTransformation(t *testing.T) {
	t.Parallel()

	imgBytes, err := os.ReadFile("../image/testdata/nhost.jpg")
	if err != nil {
		t.Fatal(err)
	}

	updatedAt := time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)
	tests := []struct {
		name       string
		query      string
		header     string
		value      string
		validImage bool
		wantStatus int
	}{
		{"etag cached", "w=100", "If-None-Match", `"image-etag"`, false, http.StatusNotModified},
		{
			"date cached",
			"w=100",
			"If-Modified-Since",
			updatedAt.Format(http.TimeFormat),
			false,
			http.StatusNotModified,
		},
		{
			"etag precondition failed",
			"w=100",
			"If-Match",
			`"other-etag"`,
			false,
			http.StatusPreconditionFailed,
		},
		{
			"date precondition failed",
			"w=100",
			"If-Unmodified-Since",
			updatedAt.Add(-time.Second).Format(http.TimeFormat),
			false,
			http.StatusPreconditionFailed,
		},
		{"uncached corrupt image", "w=100", "", "", false, http.StatusInternalServerError},
		{
			"nonmatching validator corrupt image",
			"w=100",
			"If-None-Match",
			`"other-etag"`,
			false,
			http.StatusInternalServerError,
		},
		{"uncached transform", "w=100&f=png", "", "", true, http.StatusOK},
		{
			"nonmatching validator transform",
			"w=100&f=png",
			"If-None-Match",
			`"other-etag"`,
			true,
			http.StatusOK,
		},
		{
			"cached invalid width",
			"w=9000",
			"If-None-Match",
			`"image-etag"`,
			false,
			http.StatusBadRequest,
		},
		{
			"cached invalid height",
			"h=9000",
			"If-None-Match",
			`"image-etag"`,
			false,
			http.StatusBadRequest,
		},
		{
			"failed precondition invalid blur",
			"b=300",
			"If-Match",
			`"other-etag"`,
			false,
			http.StatusBadRequest,
		},
		{
			"cached invalid format",
			"f=invalid",
			"If-Modified-Since",
			updatedAt.Format(http.TimeFormat),
			false,
			http.StatusBadRequest,
		},
	}

	for _, endpoint := range []string{"regular", "presigned", "head"} {
		for _, tt := range tests {
			t.Run(endpoint+"/"+tt.name, func(t *testing.T) {
				t.Parallel()

				source := []byte("not an image")
				if tt.validImage {
					source = imgBytes
				}

				metadata := revalidationMetadata(source, updatedAt)
				body := &revalidationBody{reader: bytes.NewReader(source)}
				terminal := tt.wantStatus == http.StatusNotModified ||
					tt.wantStatus == http.StatusPreconditionFailed
				wantDownload := tt.wantStatus != http.StatusBadRequest &&
					(endpoint != "head" || !terminal)

				var download *controller.File
				if wantDownload {
					download = &controller.File{
						StatusCode: http.StatusOK, Body: body, ContentLength: int64(len(source)),
					}
				}

				handler := newImageRevalidationHandler(t, metadata, endpoint, download, nil)

				request := imageRevalidationRequest(t, metadata.Id, endpoint, tt.query)
				if tt.header != "" {
					request.Header.Set(tt.header, tt.value)
				}

				recorder := httptest.NewRecorder()
				handler.ServeHTTP(recorder, request)
				assert(t, recorder.Code, tt.wantStatus)
				assert(t, body.closed, wantDownload)

				if terminal {
					assert(t, body.bytesRead, 0)
					assert(t, recorder.Body.Len(), 0)
					assert(t, recorder.Header().Get("Etag"), metadata.Etag)
				} else if wantDownload && body.bytesRead == 0 {
					t.Fatal("nonterminal response did not read the source for transformation")
				}

				if tt.wantStatus == http.StatusOK {
					assertRevalidationTransform(t, recorder, metadata, endpoint)
				}
			})
		}
	}
}

func TestImageRevalidationDownloadStatus(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		query          string
		ifNoneMatch    bool
		partial        bool
		downloadStatus int
		downloadErr    *controller.APIError
		wantStatus     int
	}{
		{
			name:        "download authorization failure precedes cached response",
			query:       "w=100",
			ifNoneMatch: true,
			downloadErr: controller.ForbiddenError(os.ErrPermission, "download denied"),
			wantStatus:  http.StatusForbidden,
		},
		{
			name: "full download normalizes 206 to 200", downloadStatus: http.StatusPartialContent,
			wantStatus: http.StatusOK,
		},
		{
			name:           "partial download retains 206",
			partial:        true,
			downloadStatus: http.StatusPartialContent,
			wantStatus:     http.StatusPartialContent,
		},
	}

	for _, endpoint := range []string{"regular", "presigned"} {
		for _, tt := range tests {
			t.Run(endpoint+"/"+tt.name, func(t *testing.T) {
				t.Parallel()

				source := []byte("download content")

				metadata := revalidationMetadata(source, time.Now().UTC())
				if tt.partial {
					metadata.Size++
				}

				body := &revalidationBody{reader: bytes.NewReader(source)}

				var download *controller.File
				if tt.downloadErr == nil {
					download = &controller.File{
						StatusCode:    tt.downloadStatus,
						Body:          body,
						ContentLength: int64(len(source)),
						ExtraHeaders:  http.Header{"Content-Range": {"bytes 0-15/17"}},
					}
				}

				handler := newImageRevalidationHandler(
					t,
					metadata,
					endpoint,
					download,
					tt.downloadErr,
				)

				request := imageRevalidationRequest(t, metadata.Id, endpoint, tt.query)
				if tt.ifNoneMatch {
					request.Header.Set("If-None-Match", metadata.Etag)
				}

				recorder := httptest.NewRecorder()
				handler.ServeHTTP(recorder, request)
				assert(t, recorder.Code, tt.wantStatus)

				if tt.downloadErr == nil {
					assert(t, recorder.Body.String(), string(source))
					assert(t, body.closed, true)
				}

				if tt.partial {
					assert(t, recorder.Header().Get("Content-Range"), "bytes 0-15/17")
				}
			})
		}
	}
}

func assertRevalidationTransform(
	t *testing.T, recorder *httptest.ResponseRecorder, metadata api.FileMetadata, endpoint string,
) {
	t.Helper()

	assert(t, recorder.Header().Get("Last-Modified"), api.Time(metadata.UpdatedAt).String())

	length, err := strconv.ParseInt(recorder.Header().Get("Content-Length"), 10, 64)
	if err != nil {
		t.Fatal(err)
	}

	if length <= 0 || length == metadata.Size {
		t.Fatalf("transformed Content-Length = %d, source size = %d", length, metadata.Size)
	}

	if endpoint == "head" {
		assert(t, recorder.Body.Len(), 0)
		return
	}

	assert(t, recorder.Header().Get("Content-Type"), "image/png")
	assert(t, int64(recorder.Body.Len()), length)

	config, err := png.DecodeConfig(bytes.NewReader(recorder.Body.Bytes()))
	if err != nil {
		t.Fatal(err)
	}

	assert(t, config.Width, 100)
}

func revalidationMetadata(source []byte, updatedAt time.Time) api.FileMetadata {
	return api.FileMetadata{
		Id: "55af1e60-0f28-454e-885e-ea6aab2bb288", Name: "nhost.jpg", Size: int64(len(source)),
		BucketId: "default", Etag: `"image-etag"`, CreatedAt: updatedAt, UpdatedAt: updatedAt,
		IsUploaded: true, MimeType: "image/jpeg",
	}
}

func newImageRevalidationHandler(
	t *testing.T,
	metadata api.FileMetadata,
	endpoint string,
	download *controller.File,
	downloadErr *controller.APIError,
) http.Handler {
	t.Helper()

	c := gomock.NewController(t)
	metadataStorage := mock.NewMockMetadataStorage(c)
	contentStorage := mock.NewMockContentStorage(c)

	metadataStorage.EXPECT().GetFileByID(
		gomock.Any(), metadata.Id, gomock.Any(),
	).Return(metadata, nil)
	metadataStorage.EXPECT().GetBucketByID(
		gomock.Any(), metadata.BucketId, gomock.Any(),
	).Return(controller.BucketMetadata{ID: metadata.BucketId, CacheControl: "max-age=3600"}, nil)

	if download != nil || downloadErr != nil {
		if endpoint == "presigned" {
			contentStorage.EXPECT().GetFileWithPresignedURL(
				gomock.Any(), metadata.Id, gomock.Any(), gomock.Any(),
			).Return(download, downloadErr)
		} else {
			contentStorage.EXPECT().
				GetFile(gomock.Any(), metadata.Id, nil).
				Return(download, downloadErr)
		}
	}

	ctrl := controller.New(
		"http://storage.local", "/v1", "admin-secret", metadataStorage, contentStorage,
		image.NewTransformer(0, 0, 0), nil, slog.New(slog.DiscardHandler),
	)
	router := gin.New()
	api.RegisterHandlersWithOptions(
		router,
		api.NewStrictHandler(ctrl, nil),
		api.GinServerOptions{BaseURL: "/v1"},
	)

	return router
}

func imageRevalidationRequest(t *testing.T, fileID, endpoint, rawQuery string) *http.Request {
	t.Helper()

	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		t.Fatal(err)
	}

	path := "/v1/files/" + fileID

	method := http.MethodGet
	if endpoint == "head" {
		method = http.MethodHead
	}

	if endpoint == "presigned" {
		path += "/presignedurl/contents"
		params := validGetFileWithPresignedURLParams()
		query.Set("X-Amz-Algorithm", params.XAmzAlgorithm)
		query.Set("X-Amz-Credential", params.XAmzCredential)
		query.Set("X-Amz-Date", params.XAmzDate)
		query.Set("X-Amz-Expires", params.XAmzExpires)
		query.Set("X-Amz-Signature", params.XAmzSignature)
		query.Set("X-Amz-SignedHeaders", params.XAmzSignedHeaders)
		query.Set("X-Amz-Checksum-Mode", params.XAmzChecksumMode)
		query.Set("x-id", params.XId)
	}

	return httptest.NewRequest(method, path+"?"+query.Encode(), nil)
}

type revalidationBody struct {
	reader    io.Reader
	bytesRead int
	closed    bool
}

func (b *revalidationBody) Read(p []byte) (int, error) {
	n, err := b.reader.Read(p)
	b.bytesRead += n

	return n, err //nolint:wrapcheck // Preserve the source's reader error in this test observer.
}

func (b *revalidationBody) Close() error {
	b.closed = true
	return nil
}
