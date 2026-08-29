package graph

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/model"
)

func (r *mutationResolver) startDevSession(ctx context.Context) (*model.GraphiteSession, error) {
	if r.devAssistant == nil {
		devAssistant, err := r.ai.FindOrCreateDevAssistant(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to find or create dev assistant: %w", err)
		}

		r.devAssistant = devAssistant
	}

	ass, err := r.ai.SessionsStart(ctx, "dashboard", r.devAssistant.AssistantID, []string{})
	if err != nil {
		return nil, fmt.Errorf("problem starting developer's assistant session: %w", err)
	}

	return ass, nil
}
