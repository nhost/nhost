package controller_test

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

func TestListOrphans(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		filesInS3     []string
		filesInHasura []controller.FileSummary
		expected      api.ListOrphanedFiles200JSONResponse
	}{
		{
			name: "successful",
			filesInS3: []string{
				"app_id/b3b4e653-ca59-412c-a165-92d251c3fe86",
				"app_id/7dc0b0d0-b100-4667-89f1-0434942d9c15",
				"app_id/garbage",
			},
			filesInHasura: []controller.FileSummary{
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
			},
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{"app_id/garbage"},
			},
		},
		{
			name: "preserves S3 order and full keys",
			filesInS3: []string{
				"app_id/z-orphan",
				"app_id/present",
				"app_id/nested/a-orphan",
				"app_id/pending",
				"app_id/z-orphan",
			},
			filesInHasura: []controller.FileSummary{
				{ID: "pending", IsUploaded: false},
				{ID: "metadata-only", IsUploaded: true},
				{ID: "present", IsUploaded: true},
				{ID: "present", IsUploaded: true},
			},
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{"app_id/z-orphan", "app_id/nested/a-orphan", "app_id/z-orphan"},
			},
		},
		{
			name:      "no metadata",
			filesInS3: []string{"app_id/z-orphan", "app_id/a-orphan"},
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{"app_id/z-orphan", "app_id/a-orphan"},
			},
		},
		{
			name:          "no S3 objects",
			filesInHasura: []controller.FileSummary{{ID: "metadata-only", IsUploaded: true}},
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{},
			},
		},
		{
			name:      "all objects have metadata",
			filesInS3: []string{"app_id/present", "app_id/nested/pending"},
			filesInHasura: []controller.FileSummary{
				{ID: "pending", IsUploaded: false},
				{ID: "present", IsUploaded: true},
			},
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{},
			},
		},
		{
			name: "both listings empty",
			expected: api.ListOrphanedFiles200JSONResponse{
				Files: &[]string{},
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
			).Return(tc.filesInHasura, nil)

			contentStorage.EXPECT().ListFiles(gomock.Any()).Return(tc.filesInS3, nil)

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

			resp, err := ctrl.ListOrphanedFiles(
				t.Context(),
				api.ListOrphanedFilesRequestObject{},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, tc.expected, resp)
		})
	}
}

func TestListOrphansIgnoresUploadInFlight(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	c := gomock.NewController(t)
	defer c.Finish()

	metadataStorage := mock.NewMockMetadataStorage(c)
	contentStorage := mock.NewMockContentStorage(c)

	// an upload finishes between the two listings: whichever is listed first
	// sees the old state, the second one sees the new file
	listed := 0

	metadataStorage.EXPECT().ListFiles(gomock.Any(), gomock.Any()).DoAndReturn(
		func(_ context.Context, _ http.Header) ([]controller.FileSummary, *controller.APIError) {
			listed++
			if listed == 1 {
				return []controller.FileSummary{}, nil
			}

			return []controller.FileSummary{{ID: "new-file", IsUploaded: false}}, nil
		},
	)
	contentStorage.EXPECT().ListFiles(gomock.Any()).DoAndReturn(
		func(_ context.Context) ([]string, *controller.APIError) {
			listed++
			if listed == 1 {
				return []string{}, nil
			}

			return []string{"app_id/new-file"}, nil
		},
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

	resp, err := ctrl.ListOrphanedFiles(t.Context(), api.ListOrphanedFilesRequestObject{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assert(t, api.ListOrphanedFiles200JSONResponse{Files: &[]string{}}, resp)
}
