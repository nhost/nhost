package controller_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/nhost/hasura-storage/image"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func getFileTestCases() []struct {
	name           string
	requestHeaders http.Header
	expectedStatus int
} {
	cases := []struct {
		name           string
		requestHeaders http.Header
		expectedStatus int
	}{
		{
			name:           "no headers",
			expectedStatus: 200,
			requestHeaders: http.Header{},
		},
		{
			name:           "If-Match matches",
			expectedStatus: 200,
			requestHeaders: http.Header{
				"If-Match": {"\"55af1e60-0f28-454e-885e-ea6aab2bb288\""},
			},
		},
		{
			name:           "If-Match doesn't match",
			expectedStatus: 412,
			requestHeaders: http.Header{
				"If-Match": {"blah"},
			},
		},
		{
			name:           "If-None-Match matches",
			expectedStatus: 304,
			requestHeaders: http.Header{
				"If-None-Match": {"\"55af1e60-0f28-454e-885e-ea6aab2bb288\""},
			},
		},
		{
			name:           "If-None-Match doesn't match",
			expectedStatus: 200,
			requestHeaders: http.Header{
				"If-None-Match": {"blah"},
			},
		},
		{
			name:           "If-Modified since matches",
			expectedStatus: 200,
			requestHeaders: http.Header{
				"If-Modified-since": {"Wed, 15 Jan 2020 10:00:00 UTC"},
			},
		},
		{
			name:           "If-Modified doesn't match",
			expectedStatus: 304,
			requestHeaders: http.Header{
				"If-Modified-since": {"Thu, 25 Jan 2024 10:00:00 UTC"},
			},
		},
		{
			name:           "If-Unmodified-Since matches",
			expectedStatus: 200,
			requestHeaders: http.Header{
				"If-Unmodified-Since": {"Thu, 25 Jan 2024 10:00:00 UTC"},
			},
		},
		{
			name:           "If-Unmodified-Since doesn't match",
			expectedStatus: 412,
			requestHeaders: http.Header{
				"If-Unmodified-Since": {"Wed, 15 Jan 2020 10:00:00 UTC"},
			},
		},
	}
	return cases
}

func TestGetFileInfo(t *testing.T) {
	t.Parallel()

	cases := getFileTestCases()

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
			).Return(controller.FileMetadata{
				ID:               "55af1e60-0f28-454e-885e-ea6aab2bb288",
				Name:             "my-file.txt",
				Size:             64,
				BucketID:         "default",
				ETag:             "\"55af1e60-0f28-454e-885e-ea6aab2bb288\"",
				CreatedAt:        "2021-12-27T09:58:11Z",
				UpdatedAt:        "2021-12-27T09:58:11Z",
				IsUploaded:       true,
				MimeType:         "text/plain; charset=utf-8",
				UploadedByUserID: "0f7f0ff0-f945-4597-89e1-3636b16775cd",
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

			router, _ := ctrl.SetupRouter(nil, "/v1", []string{"*"}, false, ginLogger(logger))

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(
				t.Context(),
				"HEAD",
				"/v1/files/55af1e60-0f28-454e-885e-ea6aab2bb288",
				nil,
			)

			req.Header.Add("X-Hasura-User-Id", "some-valid-uuid")
			for k, v := range tc.requestHeaders {
				for _, vv := range v {
					req.Header.Add(k, vv)
				}
			}

			router.ServeHTTP(responseRecorder, req)

			assert(t, tc.expectedStatus, responseRecorder.Code)

			switch tc.expectedStatus {
			case 200, 412:
				assert(t, responseRecorder.Header(), http.Header{
					"Cache-Control":     {"max-age=3600"},
					"Content-Length":    {"64"},
					"Content-Type":      {"text/plain; charset=utf-8"},
					"Etag":              {`"55af1e60-0f28-454e-885e-ea6aab2bb288"`},
					"Last-Modified":     {"Mon, 27 Dec 2021 09:58:11 UTC"},
					"Surrogate-Key":     {"55af1e60-0f28-454e-885e-ea6aab2bb288"},
					"Surrogate-Control": {"max-age=604800"},
				})
			default:
				assert(t, responseRecorder.Header(), http.Header{
					"Cache-Control":     {"max-age=3600"},
					"Etag":              {`"55af1e60-0f28-454e-885e-ea6aab2bb288"`},
					"Surrogate-Control": {"max-age=604800"},
				})
			}
		})
	}
}
