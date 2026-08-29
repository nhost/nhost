package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
)

func (r *mutationResolver) deleteFileStore(ctx context.Context, id string) (bool, error) {
	ginC := middleware.GinFromContext(ctx)

	fs, err := r.hasura.GetGraphiteFileStore(
		ctx,
		id,
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return false, fmt.Errorf("error getting file store's metadata: %w", err)
	}

	if fs.GetGraphiteFileStore() == nil {
		return false, errors.New("error getting file store's metadata: not found") //nolint:err113
	}

	resp, err := r.hasura.DeleteGraphiteFileStore(
		ctx,
		id,
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return false, fmt.Errorf("error deleting file store's metadata: %w", err)
	}

	if resp.GetDeleteGraphiteFileStore() == nil {
		return false, errors.New("error deleting file store's metadata: not found") //nolint:err113
	}

	if err := r.ai.VectorStoreDelete(
		ctx,
		*fs.GetGraphiteFileStore().GetVectorStoreID(),
	); err != nil {
		return false, fmt.Errorf("error deleting vector store: %w", err)
	}

	return true, nil
}
