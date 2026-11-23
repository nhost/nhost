package controller_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

type cleanupLogBuffer struct {
	mu   sync.Mutex
	data []byte
}

func (b *cleanupLogBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data = append(b.data, p...)

	return len(p), nil
}

func (b *cleanupLogBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return string(b.data)
}

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
		name             string
		listError        *controller.APIError
		metadataError    *controller.APIError
		contentError     *controller.APIError
		cleanupError     *controller.APIError
		deleteContent    bool
		queueLength      int
		cancelOnList     bool
		wantDeletionLogs int
	}{
		{
			name:             "deletes orphan and acknowledges queue entry",
			metadataError:    controller.ErrFileNotFound,
			deleteContent:    true,
			queueLength:      1,
			wantDeletionLogs: 1,
		},
		{
			name:        "existing pending metadata protects content",
			queueLength: 1,
		},
		{
			name:        "empty cleanup queue",
			queueLength: 0,
		},
		{
			name:         "cancellation finishes sweep",
			queueLength:  1,
			cancelOnList: true,
		},
		{
			name:        "listing failure does not delete anything",
			listError:   failure,
			queueLength: 1,
		},
		{
			name:          "metadata lookup fails closed",
			metadataError: failure,
			queueLength:   1,
		},
		{
			name:          "unrelated not found fails closed",
			metadataError: wrongNotFound,
			queueLength:   1,
		},
		{
			name:          "content deletion failure leaves queue entry",
			metadataError: controller.ErrFileNotFound,
			contentError:  failure,
			deleteContent: true,
			queueLength:   1,
		},
		{
			name:             "queue removal failure is retried later",
			metadataError:    controller.ErrFileNotFound,
			cleanupError:     failure,
			deleteContent:    true,
			queueLength:      1,
			wantDeletionLogs: 1,
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

				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()

				var logged cleanupLogBuffer

				deletionLog := fmt.Sprintf(
					"level=INFO msg=%q fileID=%s",
					"deleted orphaned file",
					file.ID,
				)

				files := []controller.FileToDelete{file}[:tt.queueLength]

				metadataStorage.EXPECT().ListFilesToDelete(
					gomock.Any(), time.Now().Add(-24*time.Hour), "", 100, headers,
				).DoAndReturn(func(context.Context, time.Time, string, int, http.Header) ([]controller.FileToDelete, *controller.APIError) {
					if tt.cancelOnList {
						cancel()
					}

					return files, tt.listError
				})

				if tt.listError == nil && len(files) > 0 && !tt.cancelOnList {
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
						).DoAndReturn(func(context.Context, string, time.Time, http.Header) *controller.APIError {
							if !strings.Contains(logged.String(), deletionLog) {
								t.Error(
									"orphan deletion was not logged before queue acknowledgment",
								)
							}

							return tt.cleanupError
						}).After(deletion)
					}
				}

				ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
					nil, nil, slog.New(slog.NewTextHandler(&logged, nil)))

				go ctrl.RunCleanup(ctx)

				synctest.Wait()
				cancel()
				synctest.Wait()

				assert(t, strings.Count(logged.String(), deletionLog), tt.wantDeletionLogs)
				assertCleanupSweepLogs(t, logged.String(), 1)
			})
		})
	}
}

func assertCleanupSweepLogs(t *testing.T, logged string, wantSweeps int) {
	t.Helper()

	const (
		startLog  = `level=INFO msg="starting file cleanup"`
		finishLog = `level=INFO msg="finished file cleanup"`
	)

	lines := strings.Split(strings.TrimSpace(logged), "\n")
	assert(t, strings.Count(logged, startLog), wantSweeps)
	assert(t, strings.Count(logged, finishLog), wantSweeps)
	assert(t, strings.Contains(lines[0], startLog), true)
	assert(t, strings.Contains(lines[len(lines)-1], finishLog), true)
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

		var logged cleanupLogBuffer

		ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
			nil, nil, slog.New(slog.NewTextHandler(&logged, nil)))

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		go ctrl.RunCleanup(ctx)

		synctest.Wait()
		assertCleanupSweepLogs(t, logged.String(), 1)
		time.Sleep(23 * time.Hour)
		synctest.Wait()
		assertCleanupSweepLogs(t, logged.String(), 1)
		time.Sleep(time.Hour)
		synctest.Wait()
		cancel()
		synctest.Wait()
		assertCleanupSweepLogs(t, logged.String(), 2)
	})
}

func TestRunCleanupOperationDeadlines(t *testing.T) {
	t.Parallel()

	tests := []struct {
		operation string
		wantLog   string
	}{
		{operation: "list", wantLog: "problem listing file cleanup queue"},
		{operation: "metadata", wantLog: "problem cleaning up file"},
		{operation: "content", wantLog: "problem cleaning up file"},
		{operation: "acknowledgment", wantLog: "problem cleaning up file"},
	}
	outcomes := []struct {
		name   string
		cancel bool
	}{
		{name: "timeout retries daily", cancel: false},
		{name: "shutdown cancels in-flight call", cancel: true},
	}

	for _, tt := range tests {
		t.Run(tt.operation, func(t *testing.T) {
			t.Parallel()

			for _, outcome := range outcomes {
				t.Run(outcome.name, func(t *testing.T) {
					t.Parallel()

					testCleanupOperationDeadline(t, tt.operation, tt.wantLog, outcome.cancel)
				})
			}
		})
	}
}

func testCleanupOperationDeadline(t *testing.T, operation, wantLog string, canceled bool) {
	t.Helper()

	synctest.Test(t, func(t *testing.T) {
		mocks := gomock.NewController(t)
		metadataStorage := mock.NewMockMetadataStorage(mocks)
		contentStorage := mock.NewMockContentStorage(mocks)
		headers := http.Header{"x-hasura-admin-secret": []string{"admin-secret"}}
		started := time.Now()
		file := controller.FileToDelete{
			ID:        "00000000-0000-0000-0000-000000000001",
			DeletedAt: started.Add(-25 * time.Hour),
		}
		laterFile := controller.FileToDelete{
			ID:        "00000000-0000-0000-0000-000000000002",
			DeletedAt: file.DeletedAt,
		}
		waitForCancellation := func(ctx context.Context) *controller.APIError {
			return waitForCleanupCancellation(ctx, t, started, canceled)
		}
		calls := expectCleanupStall(
			metadataStorage,
			contentStorage,
			headers,
			[]controller.FileToDelete{
				file,
				laterFile,
			},
			started,
			operation,
			waitForCancellation,
		)

		if !canceled {
			if operation != "list" {
				calls = append(
					calls,
					metadataStorage.EXPECT().
						GetFileByID(gomock.Any(), laterFile.ID, headers).
						DoAndReturn(func(ctx context.Context, _ string, _ http.Header) (api.FileMetadata, *controller.APIError) {
							deadline, ok := ctx.Deadline()
							if ctx.Err() != nil || !ok ||
								!deadline.Equal(started.Add(2*time.Minute)) {
								t.Errorf(
									"later file did not get a fresh deadline: %v, %v",
									deadline,
									ctx.Err(),
								)
							}

							return api.FileMetadata{}, nil
						}),
				)
			}

			calls = append(
				calls,
				metadataStorage.EXPECT().
					ListFilesToDelete(gomock.Any(), started, "", 100, headers).
					Return([]controller.FileToDelete{file}, nil),
				metadataStorage.EXPECT().
					GetFileByID(gomock.Any(), file.ID, headers).
					Return(api.FileMetadata{}, controller.ErrFileNotFound),
				contentStorage.EXPECT().
					DeleteFile(gomock.Any(), file.ID).
					Return(nil),
				metadataStorage.EXPECT().
					RemoveFileFromCleanup(gomock.Any(), file.ID, file.DeletedAt, headers).
					Return(nil),
			)
		}

		gomock.InOrder(calls...)

		logged := make(cleanupLogWriter, 1)
		ctrl := controller.New(
			"",
			"",
			"admin-secret",
			metadataStorage,
			contentStorage,
			nil,
			nil,
			slog.New(slog.NewTextHandler(logged, &slog.HandlerOptions{
				AddSource:   false,
				Level:       slog.LevelError,
				ReplaceAttr: nil,
			})),
		)

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		done := make(chan struct{})
		go func() {
			ctrl.RunCleanup(ctx)
			close(done)
		}()

		synctest.Wait()
		time.Sleep(time.Minute - time.Nanosecond)
		synctest.Wait()

		select {
		case message := <-logged:
			t.Fatalf("operation returned before its deadline: %s", message)
		default:
		}

		if canceled {
			cancel()
		} else {
			time.Sleep(time.Nanosecond)
		}

		synctest.Wait()

		select {
		case message := <-logged:
			if !strings.Contains(message, wantLog) {
				t.Errorf("cleanup log = %q, want %q", message, wantLog)
			}
		default:
			t.Error("worker did not log the operation failure")
		}

		if !canceled {
			time.Sleep(24*time.Hour - time.Minute)
			synctest.Wait()
			cancel()
			synctest.Wait()
		}

		select {
		case <-done:
		default:
			t.Error("worker did not stop after cancellation")
		}
	})
}

func waitForCleanupCancellation(
	ctx context.Context, t *testing.T, started time.Time, canceled bool,
) *controller.APIError {
	t.Helper()

	deadline, ok := ctx.Deadline()
	if !ok || !deadline.Equal(started.Add(time.Minute)) {
		t.Errorf("operation deadline = %v, set = %v, want one minute", deadline, ok)
	}

	<-ctx.Done()

	wantErr := context.DeadlineExceeded
	if canceled {
		wantErr = context.Canceled
	}

	if !errors.Is(ctx.Err(), wantErr) {
		t.Errorf("operation error = %v, want %v", ctx.Err(), wantErr)
	}

	return controller.InternalServerError(ctx.Err())
}

func expectCleanupStall(
	metadataStorage *mock.MockMetadataStorage, contentStorage *mock.MockContentStorage,
	headers http.Header, files []controller.FileToDelete, started time.Time, operation string,
	waitForCancellation func(context.Context) *controller.APIError,
) []any {
	calls := []any{
		metadataStorage.EXPECT().ListFilesToDelete(
			gomock.Any(), started.Add(-24*time.Hour), "", 100, headers,
		).DoAndReturn(func(ctx context.Context, _ time.Time, _ string, _ int, _ http.Header) ([]controller.FileToDelete, *controller.APIError) {
			if operation == "list" {
				return nil, waitForCancellation(ctx)
			}

			return files, nil
		}),
	}
	if operation == "list" {
		return calls
	}

	file := files[0]
	calls = append(calls, metadataStorage.EXPECT().GetFileByID(gomock.Any(), file.ID, headers).
		DoAndReturn(func(ctx context.Context, _ string, _ http.Header) (api.FileMetadata, *controller.APIError) {
			if operation == "metadata" {
				return api.FileMetadata{}, waitForCancellation(ctx)
			}

			return api.FileMetadata{}, controller.ErrFileNotFound
		}),
	)

	if operation == "metadata" {
		return calls
	}

	calls = append(calls, contentStorage.EXPECT().DeleteFile(gomock.Any(), file.ID).
		DoAndReturn(func(ctx context.Context, _ string) *controller.APIError {
			if operation == "content" {
				return waitForCancellation(ctx)
			}

			return nil
		}))

	if operation == "content" {
		return calls
	}

	return append(calls, metadataStorage.EXPECT().RemoveFileFromCleanup(
		gomock.Any(), file.ID, file.DeletedAt, headers,
	).DoAndReturn(func(ctx context.Context, _ string, _ time.Time, _ http.Header) *controller.APIError {
		return waitForCancellation(ctx)
	}))
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

		var logged cleanupLogBuffer

		ctrl := controller.New("", "", "admin-secret", metadataStorage, contentStorage,
			nil, nil, slog.New(slog.NewTextHandler(&logged, nil)))

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		go ctrl.RunCleanup(ctx)

		synctest.Wait()
		assertCleanupSweepLogs(t, logged.String(), 1)
		cancel()
		synctest.Wait()
	})
}

func TestRunCleanupCanceled(t *testing.T) {
	t.Parallel()

	var logged cleanupLogBuffer

	mocks := gomock.NewController(t)
	ctrl := controller.New("", "", "admin-secret", mock.NewMockMetadataStorage(mocks),
		mock.NewMockContentStorage(mocks), nil, nil, slog.New(slog.NewTextHandler(&logged, nil)))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	ctrl.RunCleanup(ctx)
	assert(t, logged.String(), "")
}
