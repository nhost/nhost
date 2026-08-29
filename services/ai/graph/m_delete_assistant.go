package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) deleteAssistant(
	ctx context.Context, assistantID string,
) (bool, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.DeleteAssistants(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteAssistantsBoolExp{
			AssistantID: &hasura.StringComparisonExp{
				Eq: &assistantID,
			},
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return false, fmt.Errorf("error deleting assistant's metadata: %w", err)
	}

	if len(resp.DeleteGraphiteAssistants.GetReturning()) == 0 {
		return false, errors.New("error deleting assistant's metadata: not found") //nolint:err113
	}

	if err := r.ai.AssistantsDelete(
		ctx, *resp.GetDeleteGraphiteAssistants().GetReturning()[0].GetAssistantID(),
	); err != nil {
		return false, fmt.Errorf("error deleting assistant: %w", err)
	}

	return true, nil
}
