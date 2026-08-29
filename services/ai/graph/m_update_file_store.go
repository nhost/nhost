package graph

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) deleteFileStoreBuckets(
	ctx context.Context,
	fileStoreID string,
	bucketIDs []string,
) error {
	if _, err := r.hasura.DeleteGraphiteFileStoreBuckets(
		ctx,
		hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			And: []*hasura.GraphiteFileStoreBucketsBoolExp{
				{
					FileStoreID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
						Eq: &fileStoreID,
					},
				},
				{
					BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
						In: bucketIDs,
					},
				},
			},
		},
	); err != nil {
		return fmt.Errorf("error deleting file store's buckets: %w", err)
	}

	return nil
}

func (r *mutationResolver) updateFileStoreBuckets(
	ctx context.Context,
	fileStoreID string,
	updatedBucketIDs []string,
) error {
	fsBuckets, err := r.hasura.GetGraphiteFileStoreBuckets(
		ctx,
		&hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			FileStoreID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: &fileStoreID,
			},
		},
	)
	if err != nil {
		return fmt.Errorf("error getting file store's buckets: %w", err)
	}

	currentBucketIDs := make([]string, len(fsBuckets.GetGraphiteFileStoreBuckets()))
	for i, id := range fsBuckets.GetGraphiteFileStoreBuckets() {
		currentBucketIDs[i] = id.GetBucketID()
	}

	// new buckets
	ids := make(map[string]bool, len(currentBucketIDs))
	for _, id := range currentBucketIDs {
		ids[id] = true
	}

	diff := make([]string, 0, len(updatedBucketIDs))
	for _, id := range updatedBucketIDs {
		if !ids[id] {
			diff = append(diff, id)
		}
	}

	if err = r.createFileStoreBuckets(ctx, fileStoreID, diff); err != nil {
		return err
	}

	// removed buckets
	ids = make(map[string]bool, len(updatedBucketIDs))
	for _, id := range updatedBucketIDs {
		ids[id] = true
	}

	diff = make([]string, 0, len(currentBucketIDs))
	for _, id := range currentBucketIDs {
		if !ids[id] {
			diff = append(diff, id)
		}
	}

	return r.deleteFileStoreBuckets(ctx, fileStoreID, diff)
}

func (r *mutationResolver) updateFileStore(
	ctx context.Context,
	id string,
	object model.GraphiteFileStoreInput,
) (*model.GraphiteFileStore, error) {
	ginC := middleware.GinFromContext(ctx)

	updateResp, err := r.hasura.UpdateGraphiteFileStores(
		ctx,
		hasura.GraphiteFileStoresBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: &id,
			},
		},
		hasura.GraphiteFileStoresSetInput{ //nolint:exhaustruct
			Name:      new(object.Name),
			UpdatedAt: new(time.Now()),
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error updating file store: %w", err)
	}

	if len(updateResp.UpdateGraphiteFileStores.GetReturning()) == 0 {
		return nil, errors.New("error updating file store: not found") //nolint:err113
	}

	if err = r.updateFileStoreBuckets(ctx, id, object.Buckets); err != nil {
		return nil, err
	}

	var fs *model.GraphiteFileStore

	b, err := json.Marshal(object)
	if err != nil {
		return nil, fmt.Errorf("error marshalling file store: %w", err)
	}

	if err = json.Unmarshal(b, &fs); err != nil {
		return nil, fmt.Errorf("error unmarshalling file store: %w", err)
	}

	fs.VectorStoreID = *updateResp.UpdateGraphiteFileStores.GetReturning()[0].GetVectorStoreID()
	fs.ID = updateResp.UpdateGraphiteFileStores.GetReturning()[0].GetID()

	return fs, nil
}
