package controller_test

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/middleware"
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

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

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

func TestGetFilePresignedURLExpirationOverride(t *testing.T) {
	t.Parallel()

	const (
		fileID      = "55af1e60-0f28-454e-885e-ea6aab2bb288"
		adminSecret = "asdasd"
	)

	ptr := func(i int) *int { return &i }

	cases := []struct {
		name               string
		headers            http.Header
		expiresIn          *int
		expectedExpiration int
		expectedErr        *expectedAPIError
	}{
		{
			name:               "admin overrides the bucket expiration",
			headers:            http.Header{"X-Hasura-Admin-Secret": {adminSecret}},
			expiresIn:          ptr(86400),
			expectedExpiration: 86400,
		},
		{
			name:               "admin can use the S3 maximum",
			headers:            http.Header{"X-Hasura-Admin-Secret": {adminSecret}},
			expiresIn:          ptr(604800),
			expectedExpiration: 604800,
		},
		{
			name:               "admin without override gets the bucket expiration",
			headers:            http.Header{"X-Hasura-Admin-Secret": {adminSecret}},
			expiresIn:          nil,
			expectedExpiration: 30,
		},
		{
			name:      "user cannot override",
			headers:   http.Header{"Authorization": {"Bearer some-jwt"}},
			expiresIn: ptr(86400),
			expectedErr: &expectedAPIError{
				StatusCode: http.StatusForbidden,
				Message:    "overriding the presigned URL expiration requires the admin secret",
			},
		},
		{
			name:      "wrong admin secret cannot override",
			headers:   http.Header{"X-Hasura-Admin-Secret": {"not-the-secret"}},
			expiresIn: ptr(86400),
			expectedErr: &expectedAPIError{
				StatusCode: http.StatusForbidden,
				Message:    "overriding the presigned URL expiration requires the admin secret",
			},
		},
		{
			name:      "above the S3 maximum",
			headers:   http.Header{"X-Hasura-Admin-Secret": {adminSecret}},
			expiresIn: ptr(604801),
			expectedErr: &expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message:    "expiresIn must be between 1 and 604800 seconds",
			},
		},
		{
			name:      "zero",
			headers:   http.Header{"X-Hasura-Admin-Secret": {adminSecret}},
			expiresIn: ptr(0),
			expectedErr: &expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message:    "expiresIn must be between 1 and 604800 seconds",
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

			// A rejected override must fail before any metadata is fetched.
			if tc.expectedErr == nil {
				metadataStorage.EXPECT().GetFileByID(
					gomock.Any(), fileID, gomock.Any(),
				).Return(api.FileMetadata{
					Id:         fileID,
					Name:       "my-file.txt",
					BucketId:   "default",
					IsUploaded: true,
				}, nil)

				metadataStorage.EXPECT().GetBucketByID(
					gomock.Any(), "default", gomock.Any(),
				).Return(controller.BucketMetadata{
					ID:                   "default",
					PresignedURLsEnabled: true,
					DownloadExpiration:   30,
				}, nil)

				contentStorage.EXPECT().CreatePresignedURL(
					gomock.Any(), fileID, time.Duration(tc.expectedExpiration)*time.Second,
				).Return("this-is-the-signature", nil)
			}

			ctrl := controller.New(
				"http://asd",
				"/v1",
				adminSecret,
				metadataStorage,
				contentStorage,
				nil,
				nil,
				logger,
			)

			//nolint:staticcheck // the middleware stores headers under this string key.
			ctx := context.WithValue(t.Context(), middleware.HeadersContextKey, tc.headers)

			resp, err := ctrl.GetFilePresignedURL(
				ctx,
				api.GetFilePresignedURLRequestObject{
					Id:     fileID,
					Params: api.GetFilePresignedURLParams{ExpiresIn: tc.expiresIn},
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.expectedErr != nil {
				assertAPIError(t, resp, *tc.expectedErr)

				return
			}

			assert(t, resp, api.GetFilePresignedURL200JSONResponse{
				Url:        "http://asd/v1/files/" + fileID + "/presignedurl/contents?this-is-the-signature",
				Expiration: tc.expectedExpiration,
			})
		})
	}
}
