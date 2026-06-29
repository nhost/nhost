package controller_test

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/image"
	gomock "go.uber.org/mock/gomock"
)

type expectedAPIError struct {
	StatusCode int
	Message    string
}

func TestGetFile(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name         string
		request      api.GetFileRequestObject
		expected     any
		wantDownload bool
	}{
		{
			name: "no headers",
			request: api.GetFileRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       new("bytes"),
					CacheControl:       new("max-age=3600"),
					ContentDisposition: new(`inline; filename="my-file.txt"`),
					ContentType:        new("text/plain; charset=utf-8"),
					Etag:               new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					LastModified:       new(api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)),
					SurrogateControl:   new("max-age=3600"),
					SurrogateKey:       new("55af1e60-0f28-454e-885e-ea6aab2bb288"),
				},
				ContentLength: 64,
			},
			wantDownload: true,
		},
		{
			name: "If-Match matches",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfMatch: new("\"55af1e60-0f28-454e-885e-ea6aab2bb288\""),
				},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       new("bytes"),
					CacheControl:       new("max-age=3600"),
					ContentDisposition: new(`inline; filename="my-file.txt"`),
					ContentType:        new("text/plain; charset=utf-8"),
					Etag:               new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					LastModified:       new(api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)),
					SurrogateControl:   new("max-age=3600"),
					SurrogateKey:       new("55af1e60-0f28-454e-885e-ea6aab2bb288"),
				},
				ContentLength: 64,
			},
			wantDownload: true,
		},
		{
			name: "If-Match doesn't match",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfMatch: new("blah"),
				},
			},
			expected: api.GetFile412Response{
				Headers: api.GetFile412ResponseHeaders{
					CacheControl:     new("max-age=3600"),
					Etag:             new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					SurrogateControl: new("max-age=3600"),
				},
			},
			wantDownload: true,
		},
		{
			name: "If-None-Match matches",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfNoneMatch: new("\"55af1e60-0f28-454e-885e-ea6aab2bb288\""),
				},
			},
			expected: api.GetFile304Response{
				Headers: api.GetFile304ResponseHeaders{
					CacheControl:     new("max-age=3600"),
					Etag:             new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					SurrogateControl: new("max-age=3600"),
				},
			},
			wantDownload: true,
		},
		{
			name: "If-None-Match doesn't match",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfNoneMatch: new("blah"),
				},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       new("bytes"),
					CacheControl:       new("max-age=3600"),
					ContentDisposition: new(`inline; filename="my-file.txt"`),
					ContentType:        new("text/plain; charset=utf-8"),
					Etag:               new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					LastModified:       new(api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)),
					SurrogateControl:   new("max-age=3600"),
					SurrogateKey:       new("55af1e60-0f28-454e-885e-ea6aab2bb288"),
				},
				ContentLength: 64,
			},
			wantDownload: true,
		},
		{
			name: "If-Modified since matches",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfModifiedSince: new(api.Date(2020, 1, 15, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       new("bytes"),
					CacheControl:       new("max-age=3600"),
					ContentDisposition: new(`inline; filename="my-file.txt"`),
					ContentType:        new("text/plain; charset=utf-8"),
					Etag:               new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					LastModified:       new(api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)),
					SurrogateControl:   new("max-age=3600"),
					SurrogateKey:       new("55af1e60-0f28-454e-885e-ea6aab2bb288"),
				},
				ContentLength: 64,
			},
			wantDownload: true,
		},
		{
			name: "If-Modified doesn't match",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfModifiedSince: new(api.Date(2024, 1, 25, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFile304Response{
				Headers: api.GetFile304ResponseHeaders{
					CacheControl:     new("max-age=3600"),
					Etag:             new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					SurrogateControl: new("max-age=3600"),
				},
			},
			wantDownload: true,
		},
		{
			name: "If-Unmodified-Since matches",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfUnmodifiedSince: new(api.Date(2024, 1, 25, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       new("bytes"),
					CacheControl:       new("max-age=3600"),
					ContentDisposition: new(`inline; filename="my-file.txt"`),
					ContentType:        new("text/plain; charset=utf-8"),
					Etag:               new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					LastModified:       new(api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC)),
					SurrogateControl:   new("max-age=3600"),
					SurrogateKey:       new("55af1e60-0f28-454e-885e-ea6aab2bb288"),
				},
				ContentLength: 64,
			},
			wantDownload: true,
		},
		{
			name: "If-Unmodified-Since doesn't match",
			request: api.GetFileRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{
					IfUnmodifiedSince: new(api.Date(2020, 1, 15, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFile412Response{
				Headers: api.GetFile412ResponseHeaders{
					CacheControl:     new("max-age=3600"),
					Etag:             new(`"55af1e60-0f28-454e-885e-ea6aab2bb288"`),
					SurrogateControl: new("max-age=3600"),
				},
			},
			wantDownload: true,
		},
		{
			name: "width over max is rejected",
			request: api.GetFileRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{W: new(9000)},
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"width 9000 exceeds the maximum of 8000",
			},
			wantDownload: false,
		},
		{
			name: "height over max is rejected",
			request: api.GetFileRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{H: new(9000)},
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"height 9000 exceeds the maximum of 8000",
			},
			wantDownload: false,
		},
		{
			name: "blur over max is rejected",
			request: api.GetFileRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{B: new(float32(300))},
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"blur 300 exceeds the maximum of 250",
			},
			wantDownload: false,
		},
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
			).Return(api.FileMetadata{
				Id:               "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Name:             "my-file.txt",
				Size:             64,
				BucketId:         "default",
				Etag:             "\"55af1e60-0f28-454e-885e-ea6aab2bb288\"",
				CreatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
				UpdatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
				IsUploaded:       true,
				MimeType:         "text/plain; charset=utf-8",
				UploadedByUserId: new("0f7f0ff0-f945-4597-89e1-3636b16775cd"),
			}, nil)

			metadataStorage.EXPECT().GetBucketByID(
				gomock.Any(), "default", gomock.Any(),
			).Return(controller.BucketMetadata{
				ID:                   "default",
				MinUploadFile:        0,
				MaxUploadFile:        100,
				PresignedURLsEnabled: true,
				DownloadExpiration:   30,
				CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
				UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
				CacheControl:         "max-age=3600",
			}, nil)

			if tc.wantDownload {
				contentStorage.EXPECT().GetFile(
					gomock.Any(),
					"55af1e60-0f28-454e-885e-ea6aab2bb288",
					gomock.Any(),
				).Return(
					&controller.File{
						StatusCode:    200,
						Etag:          `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
						Body:          io.NopCloser(strings.NewReader("Hello, world!")),
						ContentLength: 64,
						ExtraHeaders:  make(http.Header),
					},
					nil,
				)
			}

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				image.NewTransformer(0, 0, 0),
				nil,
				logger,
			)

			resp, err := ctrl.GetFile(
				t.Context(),
				tc.request,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			switch expectedResp := tc.expected.(type) {
			case expectedAPIError:
				assertAPIError(t, resp, expectedResp)

				return
			}

			switch actualResp := resp.(type) {
			case api.GetFile200ApplicationoctetStreamResponse:
				if expectedResp, ok := tc.expected.(api.GetFile200ApplicationoctetStreamResponse); ok {
					gotBody, err := io.ReadAll(actualResp.Body)
					if err != nil {
						t.Fatalf("failed to read response body: %v", err)
					}

					assert(t, string(gotBody), "Hello, world!")
					assert(t, actualResp.Headers, expectedResp.Headers)
					assert(t, actualResp.ContentLength, expectedResp.ContentLength)
				} else {
					t.Errorf(
						"expected GetFile200ApplicationoctetStreamResponse, got %T", tc.expected,
					)
				}
			case api.GetFile304Response:
				assert(t, resp, tc.expected)
			case api.GetFile412Response:
				assert(t, resp, tc.expected)
			default:
				assert(t, resp, tc.expected)
			}
		})
	}
}

func assertAPIError(t *testing.T, resp any, expected expectedAPIError) {
	t.Helper()

	apiErr, ok := resp.(*controller.APIError)
	if !ok {
		t.Fatalf("expected *controller.APIError, got %T", resp)
	}

	got := expectedAPIError{
		StatusCode: apiErr.StatusCode(),
		Message:    apiErr.PublicMessage(),
	}

	assert(t, got, expected)
}

// TestGetFileRejectsOversizedDerivedDimension exercises the limit a request can
// only hit once the source image is loaded: nhost.jpg is 678x258 (landscape),
// so asking for only the height at the cap derives a width ~2.6x larger. The
// controller validates the explicit height fine (it is at the cap), so the
// oversized derived width is caught by the transformer, which must surface it
// as a 400 rather than a 500.
func TestGetFileRejectsOversizedDerivedDimension(t *testing.T) {
	t.Parallel()

	const fileID = "55af1e60-0f28-454e-885e-ea6aab2bb288"

	imgBytes, err := os.ReadFile("../image/testdata/nhost.jpg")
	if err != nil {
		t.Fatal(err)
	}

	c := gomock.NewController(t)
	defer c.Finish()

	metadataStorage := mock.NewMockMetadataStorage(c)
	contentStorage := mock.NewMockContentStorage(c)

	metadataStorage.EXPECT().GetFileByID(
		gomock.Any(), fileID, gomock.Any(),
	).Return(api.FileMetadata{
		Id:               fileID,
		Name:             "nhost.jpg",
		Size:             int64(len(imgBytes)),
		BucketId:         "default",
		Etag:             `"` + fileID + `"`,
		CreatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
		UpdatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
		IsUploaded:       true,
		MimeType:         "image/jpeg",
		UploadedByUserId: new("0f7f0ff0-f945-4597-89e1-3636b16775cd"),
	}, nil)

	metadataStorage.EXPECT().GetBucketByID(
		gomock.Any(), "default", gomock.Any(),
	).Return(controller.BucketMetadata{
		ID:                   "default",
		MinUploadFile:        0,
		MaxUploadFile:        100,
		PresignedURLsEnabled: true,
		DownloadExpiration:   30,
		CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
		UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
		CacheControl:         "max-age=3600",
	}, nil)

	contentStorage.EXPECT().GetFile(
		gomock.Any(), fileID, gomock.Any(),
	).Return(
		&controller.File{
			StatusCode:    200,
			Etag:          `"` + fileID + `"`,
			Body:          io.NopCloser(bytes.NewReader(imgBytes)),
			ContentLength: int64(len(imgBytes)),
			ExtraHeaders:  make(http.Header),
		},
		nil,
	)

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	ctrl := controller.New(
		"http://asd",
		"/v1",
		"asdasd",
		metadataStorage,
		contentStorage,
		image.NewTransformer(0, 0, 0),
		nil,
		logger,
	)

	resp, err := ctrl.GetFile(
		t.Context(),
		api.GetFileRequestObject{
			Id:     fileID,
			Params: api.GetFileParams{H: new(8000)},
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertAPIError(t, resp, expectedAPIError{
		StatusCode: http.StatusBadRequest,
		Message: "output dimensions exceed the maximum: " +
			"resizing to 21023x8000 exceeds the maximum dimension of 8000",
	})
}
