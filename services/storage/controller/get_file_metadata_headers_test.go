package controller_test

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/image"
	gomock "go.uber.org/mock/gomock"
)

func TestGetFileInfo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		request  api.GetFileMetadataHeadersRequestObject
		expected api.GetFileMetadataHeadersResponseObject
	}{
		{
			name: "no headers",
			request: api.GetFileMetadataHeadersRequestObject{
				Id:     "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{},
			},
			expected: api.GetFileMetadataHeaders200Response{
				Headers: api.GetFileMetadataHeaders200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentLength:      64,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			},
		},
		{
			name: "If-Match matches",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfMatch: new("\"55af1e60-0f28-454e-885e-ea6aab2bb288\""),
				},
			},
			expected: api.GetFileMetadataHeaders200Response{
				Headers: api.GetFileMetadataHeaders200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentLength:      64,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			},
		},
		{
			name: "If-Match doesn't match",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfMatch: new("blah"),
				},
			},
			expected: api.GetFileMetadataHeaders412Response{
				Headers: api.GetFileMetadataHeaders412ResponseHeaders{
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
		},
		{
			name: "If-None-Match matches",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfNoneMatch: new("\"55af1e60-0f28-454e-885e-ea6aab2bb288\""),
				},
			},
			expected: api.GetFileMetadataHeaders304Response{
				Headers: api.GetFileMetadataHeaders304ResponseHeaders{
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
		},
		{
			name: "If-None-Match doesn't match",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfNoneMatch: new("blah"),
				},
			},
			expected: api.GetFileMetadataHeaders200Response{
				Headers: api.GetFileMetadataHeaders200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentLength:      64,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			},
		},
		{
			name: "If-Modified since matches",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfModifiedSince: new(api.Date(2020, 1, 15, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFileMetadataHeaders200Response{
				Headers: api.GetFileMetadataHeaders200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentLength:      64,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			},
		},
		{
			name: "If-Modified doesn't match",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfModifiedSince: new(api.Date(2024, 1, 25, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFileMetadataHeaders304Response{
				Headers: api.GetFileMetadataHeaders304ResponseHeaders{
					CacheControl:     "max-age=3600",
					Etag:             `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					SurrogateControl: "max-age=3600",
				},
			},
		},
		{
			name: "If-Unmodified-Since matches",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfUnmodifiedSince: new(api.Date(2024, 1, 25, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFileMetadataHeaders200Response{
				Headers: api.GetFileMetadataHeaders200ResponseHeaders{
					AcceptRanges:       "bytes",
					CacheControl:       "max-age=3600",
					ContentDisposition: `inline; filename="my-file.txt"`,
					ContentLength:      64,
					ContentType:        "text/plain; charset=utf-8",
					Etag:               `"55af1e60-0f28-454e-885e-ea6aab2bb288"`,
					LastModified:       api.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC),
					SurrogateControl:   "max-age=3600",
					SurrogateKey:       "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			},
		},
		{
			name: "If-Unmodified-Since doesn't match",
			request: api.GetFileMetadataHeadersRequestObject{
				Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Params: api.GetFileMetadataHeadersParams{
					IfUnmodifiedSince: new(api.Date(2020, 1, 15, 10, 0, 0, 0, time.UTC)),
				},
			},
			expected: api.GetFileMetadataHeaders412Response{
				Headers: api.GetFileMetadataHeaders412ResponseHeaders{
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

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				image.NewTransformer(),
				nil,
				logger,
			)

			resp, err := ctrl.GetFileMetadataHeaders(
				t.Context(),
				tc.request,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, resp, tc.expected)
		})
	}
}
