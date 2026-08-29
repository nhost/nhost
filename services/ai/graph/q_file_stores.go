package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *queryResolver) getBucketsByFileStore(
	ctx context.Context,
	fileStoreIDs []string,
) (map[string][]string, error) {
	resp, err := r.hasura.GetGraphiteFileStoreBuckets(
		ctx,
		&hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			FileStoreID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				In: fileStoreIDs,
			},
		},
		withRequestHeaders(middleware.GinFromContext(ctx).Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying file store's buckets: %w", err)
	}

	bucketsByFileStore := make(map[string][]string, len(fileStoreIDs))
	for _, fsb := range resp.GetGraphiteFileStoreBuckets() {
		if _, ok := bucketsByFileStore[fsb.FileStoreID]; !ok {
			bucketsByFileStore[fsb.FileStoreID] = []string{}
		}

		bucketsByFileStore[fsb.FileStoreID] = append(
			bucketsByFileStore[fsb.FileStoreID],
			fsb.BucketID,
		)
	}

	return bucketsByFileStore, nil
}

func (r *queryResolver) fileStores(ctx context.Context) ([]*model.GraphiteFileStore, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.GetGraphiteFileStores(
		ctx,
		&hasura.GraphiteFileStoresBoolExp{}, //nolint:exhaustruct
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying file stores: %w", err)
	}

	if len(resp.GetGraphiteFileStores()) == 0 {
		return []*model.GraphiteFileStore{}, nil
	}

	fileStoreIDs := make([]string, len(resp.GetGraphiteFileStores()))
	for i, fs := range resp.GetGraphiteFileStores() {
		fileStoreIDs[i] = fs.ID
	}

	buckets, err := r.getBucketsByFileStore(ctx, fileStoreIDs)
	if err != nil {
		return nil, err
	}

	result := make([]*model.GraphiteFileStore, 0, len(resp.GetGraphiteFileStores()))
	for _, fs := range resp.GetGraphiteFileStores() {
		result = append(result, &model.GraphiteFileStore{ //nolint:exhaustruct
			ID:            fs.ID,
			Name:          fs.Name,
			VectorStoreID: *fs.VectorStoreID,
			Buckets:       buckets[fs.ID],
		})
	}

	return result, nil
}
