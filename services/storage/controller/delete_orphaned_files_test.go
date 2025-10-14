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

func TestDeleteOrphans(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		expected api.DeleteOrphanedFiles200JSONResponse
	}{
		{
			name: "successful",
			expected: api.DeleteOrphanedFiles200JSONResponse{
				Files: &[]string{"default/garbage"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := slog.New(
				slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}),
			)

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			metadataStorage.EXPECT().ListFiles(
				gomock.Any(), gomock.Any(),
			).Return(
				[]controller.FileSummary{
					{
						ID:         "b3b4e653-ca59-412c-a165-92d251c3fe86",
						Name:       "file-1.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
					{
						ID:         "7dc0b0d0-b100-4667-89f1-0434942d9c15",
						Name:       "file-two.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
				}, nil,
			)

			contentStorage.EXPECT().ListFiles(gomock.Any()).Return(
				[]string{
					"default/b3b4e653-ca59-412c-a165-92d251c3fe86",
					"default/7dc0b0d0-b100-4667-89f1-0434942d9c15",
					"default/garbage",
				}, nil,
			)

			contentStorage.EXPECT().DeleteFile(gomock.Any(), "default/garbage").Return(nil)

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

			resp, err := ctrl.DeleteOrphanedFiles(
				t.Context(),
				api.DeleteOrphanedFilesRequestObject{},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, tc.expected, resp)
		})
	}
}
