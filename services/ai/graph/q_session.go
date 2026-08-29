package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func deptr[T any](p *T) T { //nolint:ireturn
	if p == nil {
		return *new(T)
	}

	return *p
}

func (r *queryResolver) session(
	ctx context.Context, sessionID string,
) (*model.GraphiteSession, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.GetSessions(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteSessionsBoolExp{
			SessionID: &hasura.StringComparisonExp{
				Eq: new(sessionID),
			},
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying session: %w", err)
	}

	if len(resp.GetGraphiteSessions()) == 0 {
		return nil, nil //nolint:nilnil // we return nil to emulate hasura's response
	}

	return &model.GraphiteSession{
		SessionID:   deptr(resp.GetGraphiteSessions()[0].GetSessionID()),
		UserID:      deptr(resp.GetGraphiteSessions()[0].GetUserID()),
		AssistantID: deptr(resp.GetGraphiteSessions()[0].GetAssistantID()),
		CreatedAt:   deptr(resp.GetGraphiteSessions()[0].GetCreatedAt()),
	}, nil
}
