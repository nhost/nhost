package controller_test

import (
	"context"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	failure := controller.InternalServerError(context.DeadlineExceeded)
	tests := []struct {
		name          string
		metadataError *controller.APIError
		contentError  *controller.APIError
		cleanupError  *controller.APIError
		expected      api.DeleteFileResponseObject
	}{
		{
			name:     "success clears cleanup queue",
			expected: api.DeleteFile204Response{},
		},
		{
			name:          "metadata deletion fails",
			metadataError: failure,
			expected:      failure,
		},
		{
			name:         "content deletion fails and leaves cleanup queued",
			contentError: failure,
			expected:     failure,
		},
		{
			name:         "queue removal failure does not fail a completed deletion",
			cleanupError: failure,
			expected:     api.DeleteFile204Response{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			const fileID = "55af1e60-0f28-454e-885e-ea6aab2bb288"

			mocks := gomock.NewController(t)
			metadataStorage := mock.NewMockMetadataStorage(mocks)
			contentStorage := mock.NewMockContentStorage(mocks)
			deletion := metadataStorage.EXPECT().DeleteFileByID(
				gomock.Any(), fileID, gomock.Any(),
			).Return(tt.metadataError)

			if tt.metadataError == nil {
				contentDeletion := contentStorage.EXPECT().DeleteFile(
					gomock.Any(), fileID,
				).Return(tt.contentError).After(deletion)

				if tt.contentError == nil {
					metadataStorage.EXPECT().RemoveFileFromCleanup(
						gomock.Any(), fileID, gomock.Any(),
						http.Header{"x-hasura-admin-secret": []string{"admin-secret"}},
					).DoAndReturn(func(
						_ context.Context, _ string, before time.Time, _ http.Header,
					) *controller.APIError {
						if before.Before(time.Now().Add(-time.Minute)) || before.After(time.Now()) {
							t.Errorf("cleanup cutoff = %v, want current time", before)
						}

						return tt.cleanupError
					}).After(contentDeletion)
				}
			}

			ctrl := controller.New(
				"http://example.com", "/v1", "admin-secret",
				metadataStorage, contentStorage, nil, nil, slog.New(slog.DiscardHandler),
			)

			resp, err := ctrl.DeleteFile(t.Context(), api.DeleteFileRequestObject{Id: fileID})
			if err != nil {
				t.Fatalf("DeleteFile() error = %v", err)
			}

			if resp != tt.expected {
				t.Errorf("DeleteFile() response = %v, want %v", resp, tt.expected)
			}
		})
	}
}
