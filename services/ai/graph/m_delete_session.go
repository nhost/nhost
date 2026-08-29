package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) deleteSession(
	ctx context.Context, sessionID string,
) (bool, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.DeleteSessions(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteSessionsBoolExp{
			SessionID: &hasura.StringComparisonExp{
				Eq: &sessionID,
			},
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return false, fmt.Errorf("error deleting session's metadata: %w", err)
	}

	if len(resp.DeleteGraphiteSessions.GetReturning()) == 0 {
		return false, errors.New("error deleting session's metadata: not found") //nolint:err113
	}

	if err := r.ai.SessionsDelete(
		ctx, *resp.GetDeleteGraphiteSessions().GetReturning()[0].GetSessionID(),
	); err != nil {
		return false, fmt.Errorf("error deleting session: %w", err)
	}

	return true, nil
}
