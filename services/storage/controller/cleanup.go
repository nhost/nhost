package controller

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

const (
	cleanupInterval         = 24 * time.Hour
	cleanupMinAge           = 24 * time.Hour
	cleanupBatchSize        = 100
	cleanupOperationTimeout = time.Minute
)

// RunCleanup processes queued file deletions at startup and every 24 hours until
// ctx is canceled. Only entries at least 24 hours old are eligible.
func (ctrl *Controller) RunCleanup(ctx context.Context) {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for ctx.Err() == nil {
		ctrl.cleanupFiles(ctx)

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (ctrl *Controller) cleanupFiles(ctx context.Context) {
	headers := http.Header{"x-hasura-admin-secret": []string{ctrl.hasuraAdminSecret}}
	before := time.Now().Add(-cleanupMinAge)
	after := ""

	for ctx.Err() == nil {
		listCtx, cancel := context.WithTimeout(ctx, cleanupOperationTimeout)
		files, apiErr := ctrl.metadataStorage.ListFilesToDelete(
			listCtx, before, after, cleanupBatchSize, headers,
		)

		cancel()

		if apiErr != nil {
			ctrl.logger.ErrorContext(ctx, "problem listing file cleanup queue",
				slog.String("error", apiErr.Error()))

			return
		}

		for _, file := range files {
			if ctx.Err() != nil {
				return
			}

			if apiErr := ctrl.cleanupFile(ctx, file, headers); apiErr != nil {
				ctrl.logger.ErrorContext(ctx, "problem cleaning up file",
					slog.String("fileID", file.ID), slog.String("error", apiErr.Error()))
			}
		}

		if len(files) < cleanupBatchSize {
			return
		}

		// Advance even when a candidate was skipped or failed, so it cannot
		// prevent later entries from being processed during this sweep.
		after = files[len(files)-1].ID
	}
}

func (ctrl *Controller) cleanupFile(
	ctx context.Context, file FileToDelete, headers http.Header,
) *APIError {
	ctx, cancel := context.WithTimeout(ctx, cleanupOperationTimeout)
	defer cancel()

	_, apiErr := ctrl.metadataStorage.GetFileByID(ctx, file.ID, headers)
	if apiErr == nil {
		return nil
	}

	if !errors.Is(apiErr, ErrFileNotFound) {
		return apiErr
	}

	if apiErr := ctrl.contentStorage.DeleteFile(ctx, file.ID); apiErr != nil {
		return apiErr
	}

	// Do not acknowledge a more recent deletion of the same ID.
	return ctrl.metadataStorage.RemoveFileFromCleanup(ctx, file.ID, file.DeletedAt, headers)
}
