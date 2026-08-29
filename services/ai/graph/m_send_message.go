package graph

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) sendMessage(
	ctx context.Context, sessionID string, message string, prevMessageID string,
) (*model.GraphiteMessageResponse, error) {
	logger := middleware.LoggerFromContext(ctx)
	ginC := middleware.GinFromContext(ctx)

	updr, err := r.hasura.UpdateSessions(
		ctx,
		//nolint:exhaustruct
		hasura.GraphiteSessionsBoolExp{
			SessionID: &hasura.StringComparisonExp{
				Eq: new(sessionID),
			},
		},
		//nolint:exhaustruct
		hasura.GraphiteSessionsSetInput{
			UpdatedAt: new(time.Now()),
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error updating session's metadata: %w", err)
	}

	if updr.GetUpdateGraphiteSessions().GetReturning() == nil ||
		len(updr.GetUpdateGraphiteSessions().GetReturning()) == 0 {
		return nil, errors.New("session not found") //nolint:err113
	}

	ar, err := r.hasura.GetAssistants(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteAssistantsBoolExp{
			AssistantID: &hasura.StringComparisonExp{
				Eq: updr.GetUpdateGraphiteSessions().GetReturning()[0].AssistantID,
			},
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error getting assistant: %w", err)
	}

	data, err := firstAssistantData(ar.GetGraphiteAssistants())
	if err != nil {
		return nil, err
	}

	assistant, err := decodeAssistantData(data)
	if err != nil {
		return nil, err
	}

	resp, err := r.ai.SessionsSendMessage(ctx, sessionID, message, prevMessageID, assistant, logger)
	if err != nil {
		return nil, fmt.Errorf("error sending message: %w", err)
	}

	return resp, nil
}
