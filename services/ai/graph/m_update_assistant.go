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

func (r *mutationResolver) recreateAssistantFileStores(
	ctx context.Context,
	fileStoreIDs []string,
	assistantID string,
) ([]string, error) {
	_, err := r.hasura.DeleteGraphiteAssistantFileStores(
		ctx,
		hasura.GraphiteAssistantFileStoresBoolExp{ //nolint:exhaustruct
			AssistantID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: &assistantID,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error deleting assistant's file stores: %w", err)
	}

	return r.createAssistantFileStores(ctx, fileStoreIDs, assistantID)
	// return r.createAssistantFileStores(ctx, fileStoreIDs, assistantID)
}

func (r *mutationResolver) updateAssistant(
	ctx context.Context, assistantID string, object model.GraphiteAssistantInput,
) (*model.GraphiteAssistant, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.UpdateAssistants(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteAssistantsBoolExp{
			AssistantID: &hasura.StringComparisonExp{
				Eq: &assistantID,
			},
		},
		//nolint:exhaustruct
		hasura.GraphiteAssistantsSetInput{
			UpdatedAt: new(time.Now()),
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error updating assistant's metadata: %w", err)
	}

	if len(resp.UpdateGraphiteAssistants.GetReturning()) == 0 {
		return nil, errors.New("error updating assistant's metadata: not found") //nolint:err113
	}

	if err := r.ai.AssistantsUpdate(ctx, assistantID, object); err != nil {
		return nil, fmt.Errorf("error updating assistant: %w", err)
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
				Eq: new(resp.UpdateGraphiteAssistants.GetReturning()[0].GetID()),
			},
		},
		//nolint:exhaustruct
		hasura.GraphiteAssistantsSetInput{
			Data: b,
		},
	); err != nil {
		return nil, fmt.Errorf("error updating assistant's metadata: %w", err)
	}

	fileStoreIDs, err := r.recreateAssistantFileStores(ctx, object.FileStores, assistantID)
	if err != nil {
		return nil, fmt.Errorf("error recreating assistant's file stores: %w", err)
	}

	assistant.FileStores = fileStoreIDs

	return assistant, nil
}
