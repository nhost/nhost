package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *queryResolver) assistants(ctx context.Context) ([]*model.GraphiteAssistant, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.GetAssistants(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteAssistantsBoolExp{},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying assistant: %w", err)
	}

	if len(resp.GetGraphiteAssistants()) == 0 {
		// we short-circuit here because we don't want to make an unnecessary call
		return nil, nil
	}

	// we need to filter the assistants returned by the AI service
	result := make([]*model.GraphiteAssistant, 0, len(resp.GetGraphiteAssistants()))
	for _, a := range resp.GetGraphiteAssistants() {
		if a.GetAssistantID() != nil &&
			!isEmptyData(a.Data) {
			var assistant *model.GraphiteAssistant
			if err := json.Unmarshal(a.Data, &assistant); err != nil {
				return nil, fmt.Errorf("error unmarshalling assistant: %w", err)
			}

			if assistant == nil {
				continue
			}

			result = append(result, assistant)
		}
	}

	return result, nil
}
