package controller_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock_controller"
	"github.com/sirupsen/logrus"
)

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		expectedStatus   int
		expectedResponse []byte
	}{
		{
			name:           "success",
			expectedStatus: 204,
		},
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock_controller.NewMockMetadataStorage(c)
			contentStorage := mock_controller.NewMockContentStorage(c)

			metadataStorage.EXPECT().DeleteFileByID(
				gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
			).Return(
				controller.FileMetadataWithBucket{
					FileMetadata: controller.FileMetadata{
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
					},
					Bucket: controller.BucketMetadata{
						ID:                   "default",
						MinUploadFile:        0,
						MaxUploadFile:        100,
						PresignedURLsEnabled: true,
						DownloadExpiration:   30,
						CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
						UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
						CacheControl:         "max-age=3600",
					},
				}, nil)

			contentStorage.EXPECT().DeleteFile(
				"55af1e60-0f28-454e-885e-ea6aab2bb288",
			).Return(
				nil,
			)

			ctrl := controller.New("http://asd", "asdasd", metadataStorage, contentStorage, nil, logger)

			router, _ := ctrl.SetupRouter(nil, ginLogger(logger))

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(
				context.Background(),
				"DELETE",
				"/v1/storage/files/55af1e60-0f28-454e-885e-ea6aab2bb288",
				nil,
			)

			router.ServeHTTP(responseRecorder, req)

			assert(t, tc.expectedStatus, responseRecorder.Code)
			assert(t, tc.expectedResponse, responseRecorder.Body.Bytes())
		})
	}
}
