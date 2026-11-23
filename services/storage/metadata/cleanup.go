package metadata

import (
	"context"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/storage/controller"
)

// ListFilesToDelete returns a bounded, ID-ordered page of eligible cleanup entries.
func (h *Hasura) ListFilesToDelete(
	ctx context.Context, before time.Time, after string, limit int, headers http.Header,
) ([]controller.FileToDelete, *controller.APIError) {
	var cursor UUIDComparisonExp
	if after != "" {
		cursor.Gt = &after
	}

	resp, err := h.cl.ListFilesToDelete(ctx, before, cursor, int64(limit), WithHeaders(headers))
	if err != nil {
		return nil, parseGraphqlError(err).ExtendError("problem listing file cleanup queue")
	}

	files := make([]controller.FileToDelete, len(resp.FilesToDelete))
	for i, file := range resp.FilesToDelete {
		files[i] = controller.FileToDelete{ID: file.ID, DeletedAt: file.DeletedAt}
	}

	return files, nil
}

// RemoveFileFromCleanup acknowledges deletions no newer than before.
// Missing entries are already complete and are treated as success.
func (h *Hasura) RemoveFileFromCleanup(
	ctx context.Context, id string, before time.Time, headers http.Header,
) *controller.APIError {
	if _, err := h.cl.RemoveFileFromCleanup(ctx, id, before, WithHeaders(headers)); err != nil {
		return parseGraphqlError(err).ExtendError("problem removing file from cleanup queue")
	}

	return nil
}
