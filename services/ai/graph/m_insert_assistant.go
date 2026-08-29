package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func graphiteAssistantInputToGraphiteAssistant(
	id string,
	// fileStoreIDs []string,
	object any,
) (*model.GraphiteAssistant, error) {
	var assistant *model.GraphiteAssistant

	b, err := json.Marshal(object)
	if err != nil {
		return nil, fmt.Errorf("error marshalling assistant's metadata: %w", err)
	}

	if err := json.Unmarshal(b, &assistant); err != nil {
		return nil, fmt.Errorf("error unmarshalling assistant: %w", err)
	}

	assistant.AssistantID = id
	// assistant.FileStores = fileStoreIDs
	return assistant, nil
}

func (r *mutationResolver) createAssistantFileStores(
	ctx context.Context,
	fileStoreIDs []string,
	assistantID string,
) ([]string, error) {
	ginC := middleware.GinFromContext(ctx)

	if len(fileStoreIDs) == 0 {
		return []string{}, nil
	}

	fsi := make([]*hasura.GraphiteAssistantFileStoresInsertInput, len(fileStoreIDs))
	for i, fs := range fileStoreIDs {
		fsi[i] = &hasura.GraphiteAssistantFileStoresInsertInput{ //nolint:exhaustruct
			AssistantID: new(assistantID),
			FileStoreID: &fs,
		}
	}

	resp, err := r.hasura.InsertGraphiteAssistantFileStores(
		ctx,
		fsi,
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return []string{}, fmt.Errorf("error inserting assistant's file stores: %w", err)
	}

	result := make([]string, len(resp.InsertGraphiteAssistantFileStores.GetReturning()))
	for i, fs := range resp.GetInsertGraphiteAssistantFileStores().GetReturning() {
		result[i] = fs.FileStoreID
	}

	return result, nil
}

func (r *mutationResolver) insertAssistant(
	ctx context.Context, object model.GraphiteAssistantInput,
) (*model.GraphiteAssistant, error) {
	ginC := middleware.GinFromContext(ctx)

	userID, err := getUserID(ginC.Request.Header)
	if err != nil {
		return nil, fmt.Errorf("error getting user id: %w", err)
	}

	insertResp, err := r.hasura.InsertAssistant(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteAssistantsInsertInput{
			UserID: userID,
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating assistant's metadata: %w", err)
	}

	assistantID, err := r.ai.AssistantsCreate(
		ctx, insertResp.GetInsertGraphiteAssistant().GetID(), object,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating assistant: %w", err)
	}

	// assistant, err := graphiteAssistantInputToGraphiteAssistant(assistantID, fileStoreIDs, &object)
	assistant, err := graphiteAssistantInputToGraphiteAssistant(assistantID, &object)
	if err != nil {
		return nil, fmt.Errorf("error converting assistant input to assistant: %w", err)
	}

	b, err := json.Marshal(assistant)
	if err != nil {
		return nil, fmt.Errorf("error marshalling assistant's metadata: %w", err)
	}

	if _, err := r.hasura.UpdateAssistants(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteAssistantsBoolExp{
			ID: &hasura.UUIDComparisonExp{
				Eq: new(insertResp.GetInsertGraphiteAssistant().GetID()),
			},
		},
		//nolint:exhaustruct
		hasura.GraphiteAssistantsSetInput{
			AssistantID: new(assistantID),
			Data:        b,
		},
	); err != nil {
		return nil, fmt.Errorf("error updating assistant's metadata: %w", err)
	}

	fileStoreIDs, err := r.createAssistantFileStores(ctx, object.FileStores, assistantID)
	if err != nil {
		return nil, fmt.Errorf("error creating assistant's file stores: %w", err)
	}

	assistant.FileStores = fileStoreIDs

	return assistant, nil
}
