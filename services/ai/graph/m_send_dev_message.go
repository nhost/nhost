package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
)

func (r *mutationResolver) sendDevMessage(
	ctx context.Context, sessionID string, message string, prevMessageID string,
) (*model.GraphiteMessageResponse, error) {
	logger := middleware.LoggerFromContext(ctx)

	if r.devAssistant == nil {
		devAssistant, err := r.ai.FindOrCreateDevAssistant(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to find or create dev assistant: %w", err)
		}

		r.devAssistant = devAssistant
	}

	resp, err := r.ai.SessionsSendMessage(
		ctx, sessionID, message, prevMessageID, r.devAssistant, logger,
	)
	if err != nil {
		return nil, fmt.Errorf("error sending message: %w", err)
	}

	return resp, nil
}
