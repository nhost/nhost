package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *queryResolver) sessionMessages(
	ctx context.Context, sessionID string,
) (*model.GraphiteMessageResponse, error) {
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

	messages, err := r.ai.SessionsMessages(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("error getting session: %w", err)
	}

	return messages, nil
}
