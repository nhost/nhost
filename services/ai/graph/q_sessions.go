package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *queryResolver) sessions(
	ctx context.Context,
) ([]*model.GraphiteSession, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.GetSessions(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteSessionsBoolExp{},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying sessions: %w", err)
	}

	if len(resp.GetGraphiteSessions()) == 0 {
		// we short-circuit here because we don't want to make an unnecessary call
		return nil, nil
	}

	// we need to filter the assistants returned by the AI service
	result := make([]*model.GraphiteSession, len(resp.GetGraphiteSessions()))
	for i, s := range resp.GetGraphiteSessions() {
		result[i] = &model.GraphiteSession{
			SessionID:   deptr(s.GetSessionID()),
			UserID:      deptr(s.GetUserID()),
			AssistantID: deptr(s.GetAssistantID()),
			CreatedAt:   deptr(s.GetCreatedAt()),
		}
	}

	return result, nil
}
