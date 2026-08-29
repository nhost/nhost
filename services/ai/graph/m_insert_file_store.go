package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) createFileStoreBuckets(
	ctx context.Context,
	fileStoreID string,
	bucketIDs []string,
) error {
	fsb := make([]*hasura.GraphiteFileStoreBucketsInsertInput, len(bucketIDs))
	for i, b := range bucketIDs {
		fsb[i] = &hasura.GraphiteFileStoreBucketsInsertInput{ //nolint:exhaustruct
			FileStoreID: new(fileStoreID),
			BucketID:    &b,
		}
	}

	if _, err := r.hasura.InsertGraphiteFileStoreBuckets(
		ctx,
		fsb,
		withRequestHeaders(middleware.GinFromContext(ctx).Request.Header),
	); err != nil {
		return fmt.Errorf("error inserting file store's buckets: %w", err)
	}

	return nil
}

func (r *mutationResolver) insertFileStore(
	ctx context.Context,
	object model.GraphiteFileStoreInput,
) (*model.GraphiteFileStore, error) {
	ginC := middleware.GinFromContext(ctx)

	userID, err := getUserID(ginC.Request.Header)
	if err != nil {
		return nil, fmt.Errorf("error getting user id: %w", err)
	}

	insertResp, err := r.hasura.InsertGraphiteFileStore(
		ctx,
		hasura.GraphiteFileStoresInsertInput{ //nolint:exhaustruct
			UserID: userID,
			Name:   new(object.Name),
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating file store's metadata: %w", err)
	}

	vs, err := r.ai.VectorStoresCreate(ctx, insertResp.GetInsertGraphiteFileStore().GetID())
	if err != nil {
		return nil, fmt.Errorf("error creating vector store: %w", err)
	}

	if err = r.createFileStoreBuckets(
		ctx,
		insertResp.GetInsertGraphiteFileStore().GetID(),
		object.Buckets,
	); err != nil {
		return nil, err
	}

	if _, err := r.hasura.UpdateGraphiteFileStores(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteFileStoresBoolExp{
			ID: &hasura.UUIDComparisonExp{
				Eq: new(insertResp.GetInsertGraphiteFileStore().GetID()),
			},
		},
		//nolint:exhaustruct
		hasura.GraphiteFileStoresSetInput{
			VectorStoreID: new(vs.Id),
		},
	); err != nil {
		return nil, fmt.Errorf("error updating assistant's metadata: %w", err)
	}

	var fs *model.GraphiteFileStore

	b, err := json.Marshal(object)
	if err != nil {
		return nil, fmt.Errorf("error marshalling file store's metadata: %w", err)
	}

	if err := json.Unmarshal(b, &fs); err != nil {
		return nil, fmt.Errorf("error unmarshalling file store: %w", err)
	}

	fs.VectorStoreID = vs.Id
	fs.ID = insertResp.GetInsertGraphiteFileStore().GetID()

	return fs, nil
}
