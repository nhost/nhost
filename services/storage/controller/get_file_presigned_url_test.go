package controller_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func TestGetFilePresignedURL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		expectedStatus int
		fileFound      bool
	}{
		{
			name:           "success",
			expectedStatus: 200,
			fileFound:      true,
		},
		{
			name:           "fileNotFound",
			expectedStatus: 404,
			fileFound:      false,
		},
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			if tc.fileFound {
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
					UploadedByUserId: nil,
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

				contentStorage.EXPECT().CreatePresignedURL(
					gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", 30*time.Second,
				).Return(
					"this-is-the-signature", nil,
				)
			} else {
				metadataStorage.EXPECT().GetFileByID(
					gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
				).Return(api.FileMetadata{},
					controller.ErrFileNotFound)
			}

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

			resp, err := ctrl.GetFilePresignedURL(
				t.Context(),
				api.GetFilePresignedURLRequestObject{
					Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.fileFound {
				expectedResp := api.GetFilePresignedURL200JSONResponse{
					Url:        "http://asd/v1/files/55af1e60-0f28-454e-885e-ea6aab2bb288/presignedurl/contents?this-is-the-signature",
					Expiration: 30,
				}
				assert(t, expectedResp, resp)
			} else {
				assert(t, "*controller.APIError", fmt.Sprintf("%T", resp))
			}
		})
	}
}
