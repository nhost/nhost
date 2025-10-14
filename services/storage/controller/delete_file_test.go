package controller_test

import (
	"log/slog"
	"os"
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		expected api.DeleteFileResponseObject
	}{
		{
			name:     "success",
			expected: api.DeleteFile204Response{},
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

			metadataStorage.EXPECT().DeleteFileByID(
				gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
			).Return(nil)

			contentStorage.EXPECT().DeleteFile(
				gomock.Any(),
				"55af1e60-0f28-454e-885e-ea6aab2bb288",
			).Return(
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

			resp, err := ctrl.DeleteFile(
				t.Context(),
				api.DeleteFileRequestObject{
					Id: "55af1e60-0f28-454e-885e-ea6aab2bb288",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, tc.expected, resp)
		})
	}
}
