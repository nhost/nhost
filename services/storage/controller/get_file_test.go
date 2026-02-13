package controller_test

import (
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
	gomock "go.uber.org/mock/gomock"
)

func TestGetFile(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name     string
		request  api.GetFileRequestObject
		expected api.GetFileResponseObject
	}{
		{
			name: "no headers",
			request: api.GetFileRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileParams{},
			},
			expected: api.GetFile200ApplicationoctetStreamResponse{
				Headers: api.GetFile200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
				ContentLength: 64,
			},
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
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
				ContentLength: 64,
			},
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
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
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
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
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
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
				ContentLength: 64,
			},
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
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
				ContentLength: 64,
			},
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
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
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
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
				ContentLength: 64,
			},
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
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
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

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				nil,
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
