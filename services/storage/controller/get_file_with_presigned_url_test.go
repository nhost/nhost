package controller_test

import (
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/image"
	gomock "go.uber.org/mock/gomock"
)

func TestGetFileWithPresignedURLRejectsOversizedImageParams(t *testing.T) {
	t.Parallel()

	const fileID = "55af1e60-0f28-454e-885e-ea6aab2bb288"

	cases := []struct {
		name     string
		setParam func(*api.GetFileWithPresignedURLParams)
		expected expectedAPIError
	}{
		{
			name: "width over max is rejected",
			setParam: func(params *api.GetFileWithPresignedURLParams) {
				params.W = new(9000)
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"width 9000 exceeds the maximum of 8000",
			},
		},
		{
			name: "height over max is rejected",
			setParam: func(params *api.GetFileWithPresignedURLParams) {
				params.H = new(9000)
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"height 9000 exceeds the maximum of 8000",
			},
		},
		{
			name: "blur over max is rejected",
			setParam: func(params *api.GetFileWithPresignedURLParams) {
				params.B = new(float32(300))
			},
			expected: expectedAPIError{
				StatusCode: http.StatusBadRequest,
				Message: "image manipulation parameters out of range: " +
					"blur 300 exceeds the maximum of 250",
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
				gomock.Any(), fileID, gomock.Any(),
			).Return(api.FileMetadata{
				Id:               fileID,
				Name:             "my-file.jpg",
				Size:             64,
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

			params := validGetFileWithPresignedURLParams()
			tc.setParam(&params)

			resp, err := ctrl.GetFileWithPresignedURL(
				t.Context(),
				api.GetFileWithPresignedURLRequestObject{
					Id:     fileID,
					Params: params,
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assertAPIError(t, resp, tc.expected)
		})
	}
}

func validGetFileWithPresignedURLParams() api.GetFileWithPresignedURLParams {
	return api.GetFileWithPresignedURLParams{
		XAmzAlgorithm:     "AWS4-HMAC-SHA256",
		XAmzCredential:    "credential",
		XAmzDate:          time.Now().UTC().Format("20060102T150405Z"),
		XAmzExpires:       "3600",
		XAmzSignature:     "signature",
		XAmzSignedHeaders: "host",
		XAmzChecksumMode:  "ENABLED",
		XId:               "GetObject",
	}
}
