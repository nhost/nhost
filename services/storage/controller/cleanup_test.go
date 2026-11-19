package controller_test

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

func TestRunCleanup(t *testing.T) {
	t.Parallel()

	failure := controller.InternalServerError(context.DeadlineExceeded)
	wrongNotFound := controller.NewAPIError(
		http.StatusNotFound,
		"unrelated resource",
		context.Canceled,
		nil,
	)
	tests := []struct {
		name          string
		listError     *controller.APIError
		metadataError *controller.APIError
		contentError  *controller.APIError
		cleanupError  *controller.APIError
		deleteContent bool
	}{
		{
			name:          "deletes orphan and acknowledges queue entry",
			metadataError: controller.ErrFileNotFound,
			deleteContent: true,
		},
		{
			name: "existing pending metadata protects content",
		},
		{
			name:      "listing failure does not delete anything",
			listError: failure,
		},
		{
			name:          "metadata lookup fails closed",
			metadataError: failure,
		},
		{
			name:          "unrelated not found fails closed",
			metadataError: wrongNotFound,
		},
		{
			name:          "content deletion failure leaves queue entry",
			metadataError: controller.ErrFileNotFound,
			contentError:  failure,
			deleteContent: true,
		},
		{
			name:          "queue removal failure is retried later",
			metadataError: controller.ErrFileNotFound,
			cleanupError:  failure,
			deleteContent: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			synctest.Test(t, func(t *testing.T) {
				mocks := gomock.NewController(t)
				metadataStorage := mock.NewMockMetadataStorage(mocks)
				contentStorage := mock.NewMockContentStorage(mocks)
				headers := http.Header{"x-hasura-admin-secret": []string{"admin-secret"}}
				file := controller.FileToDelete{
					ID:        "00000000-0000-0000-0000-000000000001",
					DeletedAt: time.Now().Add(-25 * time.Hour),
				}
				metadataStorage.EXPECT().ListFilesToDelete(
					gomock.Any(), time.Now().Add(-24*time.Hour), "", 100, headers,
				).Return([]controller.FileToDelete{file}, tt.listError)

				if tt.listError == nil {
					metadataStorage.EXPECT().GetFileByID(
						gomock.Any(), file.ID, headers,
					).Return(api.FileMetadata{IsUploaded: false}, tt.metadataError)
				}

				if tt.deleteContent {
					deletion := contentStorage.EXPECT().DeleteFile(
						gomock.Any(), file.ID,
					).Return(tt.contentError)

					if tt.contentError == nil {
						metadataStorage.EXPECT().RemoveFileFromCleanup(
							gomock.Any(), file.ID, file.DeletedAt, headers,
						).Return(tt.cleanupError).After(deletion)
					}
				}

				ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
					nil, nil, slog.New(slog.DiscardHandler))

				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()

				go ctrl.RunCleanup(ctx)

				synctest.Wait()
				cancel()
				synctest.Wait()
			})
		})
	}
}

func TestRunCleanupRetriesDaily(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		mocks := gomock.NewController(t)
		metadataStorage := mock.NewMockMetadataStorage(mocks)
		contentStorage := mock.NewMockContentStorage(mocks)
		headers := http.Header{"x-hasura-admin-secret": []string{"admin-secret"}}
		file := controller.FileToDelete{
			ID:        "00000000-0000-0000-0000-000000000001",
			DeletedAt: time.Now().Add(-25 * time.Hour),
		}
		failure := controller.InternalServerError(context.DeadlineExceeded)
		gomock.InOrder(
			metadataStorage.EXPECT().ListFilesToDelete(
				gomock.Any(), time.Now().Add(-24*time.Hour), "", 100, headers,
			).Return([]controller.FileToDelete{file}, nil),
			metadataStorage.EXPECT().GetFileByID(gomock.Any(), file.ID, headers).
				Return(api.FileMetadata{}, controller.ErrFileNotFound),
			contentStorage.EXPECT().DeleteFile(gomock.Any(), file.ID).Return(failure),
			metadataStorage.EXPECT().ListFilesToDelete(
				gomock.Any(), time.Now(), "", 100, headers,
			).Return([]controller.FileToDelete{file}, nil),
			metadataStorage.EXPECT().GetFileByID(gomock.Any(), file.ID, headers).
				Return(api.FileMetadata{}, controller.ErrFileNotFound),
			contentStorage.EXPECT().DeleteFile(gomock.Any(), file.ID).Return(nil),
			metadataStorage.EXPECT().RemoveFileFromCleanup(
				gomock.Any(), file.ID, file.DeletedAt, headers,
			).Return(nil),
		)

		ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
			nil, nil, slog.New(slog.DiscardHandler))

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		go ctrl.RunCleanup(ctx)

		synctest.Wait()
		time.Sleep(23 * time.Hour)
		synctest.Wait()
		time.Sleep(time.Hour)
		synctest.Wait()
		cancel()
		synctest.Wait()
	})
}

func TestRunCleanupPaginatesPastProtectedFiles(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		mocks := gomock.NewController(t)
		metadataStorage := mock.NewMockMetadataStorage(mocks)
		contentStorage := mock.NewMockContentStorage(mocks)
		headers := http.Header{"x-hasura-admin-secret": []string{"admin-secret"}}
		before := time.Now().Add(-24 * time.Hour)

		files := make([]controller.FileToDelete, 100)
		for i := range files {
			files[i] = controller.FileToDelete{
				ID:        fmt.Sprintf("00000000-0000-0000-0000-%012d", i),
				DeletedAt: before,
			}
			metadataStorage.EXPECT().GetFileByID(gomock.Any(), files[i].ID, headers).
				Return(api.FileMetadata{}, nil)
		}

		metadataStorage.EXPECT().ListFilesToDelete(
			gomock.Any(), before, "", 100, headers,
		).Return(files, nil)
		lastFile := controller.FileToDelete{
			ID:        "00000000-0000-0000-0000-000000000100",
			DeletedAt: before,
		}
		metadataStorage.EXPECT().ListFilesToDelete(
			gomock.Any(), before, files[len(files)-1].ID, 100, headers,
		).Return([]controller.FileToDelete{lastFile}, nil)
		metadataStorage.EXPECT().GetFileByID(gomock.Any(), lastFile.ID, headers).
			Return(api.FileMetadata{}, controller.ErrFileNotFound)
		contentStorage.EXPECT().DeleteFile(gomock.Any(), lastFile.ID).Return(nil)
		metadataStorage.EXPECT().RemoveFileFromCleanup(
			gomock.Any(), lastFile.ID, lastFile.DeletedAt, headers,
		).Return(nil)

		ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
			nil, nil, slog.New(slog.DiscardHandler))

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		go ctrl.RunCleanup(ctx)

		synctest.Wait()
		cancel()
		synctest.Wait()
	})
}

func TestRunCleanupCanceled(t *testing.T) {
	t.Parallel()

	mocks := gomock.NewController(t)
	ctrl := controller.New("", "", "admin-secret", mock.NewMockMetadataStorage(mocks),
		mock.NewMockContentStorage(mocks), nil, nil, slog.New(slog.DiscardHandler))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	ctrl.RunCleanup(ctx)
}
