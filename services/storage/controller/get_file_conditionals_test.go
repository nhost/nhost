package controller_test

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/image"
	gomock "go.uber.org/mock/gomock"
)

func TestGetFileImageDateConditionals(t *testing.T) {
	t.Parallel()

	imgBytes, err := os.ReadFile("../image/testdata/nhost.jpg")
	if err != nil {
		t.Fatal(err)
	}

	// HTTP dates have second precision, even when updated_at does not.
	updatedAt := time.Date(2021, 12, 27, 9, 58, 11, 123456789, time.UTC)
	metadata := api.FileMetadata{
		Id:         "55af1e60-0f28-454e-885e-ea6aab2bb288",
		Name:       "nhost.jpg",
		Size:       int64(len(imgBytes)),
		BucketId:   "default",
		Etag:       `"image-etag"`,
		CreatedAt:  updatedAt,
		UpdatedAt:  updatedAt,
		IsUploaded: true,
		MimeType:   "image/jpeg",
	}

	tests := []struct {
		name       string
		header     string
		date       time.Time
		wantStatus int
	}{
		{"no condition", "", time.Time{}, http.StatusOK},
		{"modified since before", "If-Modified-Since", updatedAt.Add(-time.Second), http.StatusOK},
		{"modified since equal", "If-Modified-Since", updatedAt, http.StatusNotModified},
		{
			"modified since after",
			"If-Modified-Since",
			updatedAt.Add(time.Second),
			http.StatusNotModified,
		},
		{
			"unmodified since before",
			"If-Unmodified-Since",
			updatedAt.Add(-time.Second),
			http.StatusPreconditionFailed,
		},
		{"unmodified since equal", "If-Unmodified-Since", updatedAt, http.StatusOK},
		{
			"unmodified since after",
			"If-Unmodified-Since",
			updatedAt.Add(time.Second),
			http.StatusOK,
		},
	}
	transforms := []struct {
		name  string
		query string
	}{
		{"original", ""},
		{"width", "w=100"},
		{"height", "h=100"},
		{"quality", "q=80"},
		{"blur", "b=1"},
		{"format", "f=png"},
	}
	endpoints := []struct {
		name      string
		presigned bool
	}{
		{"regular", false},
		{"presigned", true},
	}

	for _, endpoint := range endpoints {
		for _, transform := range transforms {
			for _, tt := range tests {
				t.Run(endpoint.name+"/"+transform.name+"/"+tt.name, func(t *testing.T) {
					t.Parallel()

					handler := newImageConditionalHandler(t, metadata, imgBytes, endpoint.presigned)
					path := "/v1/files/" + metadata.Id

					query, err := url.ParseQuery(transform.query)
					if err != nil {
						t.Fatal(err)
					}

					if endpoint.presigned {
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

					request := httptest.NewRequest(http.MethodGet, path+"?"+query.Encode(), nil)
					if tt.header != "" {
						request.Header.Set(tt.header, tt.date.Format(http.TimeFormat))
					}

					recorder := httptest.NewRecorder()
					handler.ServeHTTP(recorder, request)
					assertImageConditionalResponse(t, recorder, metadata, tt.wantStatus)
				})
			}
		}
	}
}

func assertImageConditionalResponse(
	t *testing.T,
	recorder *httptest.ResponseRecorder,
	metadata api.FileMetadata,
	wantStatus int,
) {
	t.Helper()

	if recorder.Code != wantStatus {
		t.Fatalf(
			"status = %d, want %d; body: %s",
			recorder.Code,
			wantStatus,
			recorder.Body.String(),
		)
	}

	assert(t, recorder.Header().Get("Etag"), metadata.Etag)

	if wantStatus == http.StatusOK {
		assert(t, recorder.Header().Get("Last-Modified"), api.Time(metadata.UpdatedAt).String())

		if recorder.Body.Len() == 0 {
			t.Fatal("expected an image response body")
		}
	} else {
		assert(t, recorder.Body.Len(), 0)
	}
}

func newImageConditionalHandler(
	t *testing.T,
	metadata api.FileMetadata,
	imgBytes []byte,
	presigned bool,
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
	).Return(controller.BucketMetadata{
		ID:                   metadata.BucketId,
		PresignedURLsEnabled: true,
		CacheControl:         "max-age=3600",
	}, nil)

	download := &controller.File{
		StatusCode:    http.StatusOK,
		Etag:          metadata.Etag,
		Body:          io.NopCloser(bytes.NewReader(imgBytes)),
		ContentLength: int64(len(imgBytes)),
		ExtraHeaders:  make(http.Header),
	}
	if presigned {
		contentStorage.EXPECT().GetFileWithPresignedURL(
			gomock.Any(), metadata.Id, gomock.Any(), gomock.Any(),
		).Return(download, nil)
	} else {
		contentStorage.EXPECT().GetFile(
			gomock.Any(), metadata.Id, nil,
		).Return(download, nil)
	}

	ctrl := controller.New(
		"http://storage.local", "/v1", "admin-secret", metadataStorage, contentStorage,
		image.NewTransformer(0, 0, 0), nil, slog.New(slog.DiscardHandler),
	)
	router := gin.New()
	api.RegisterHandlersWithOptions(router, api.NewStrictHandler(ctrl, nil), api.GinServerOptions{
		BaseURL: "/v1",
	})

	return router
}
