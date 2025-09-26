package graph

import (
	"context"
	"encoding/json"
	"fmt"
)

func (r *queryResolver) runServiceConfigRawJSON(
	ctx context.Context,
	appID string,
	serviceID string,
	resolve bool,
) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cfg, err := r.runServiceConfig(ctx, appID, serviceID, resolve)
	if err != nil {
		return "", err
	}

	if cfg == nil {
		return "{}", nil
	}

	b, err := json.Marshal(cfg)
	if err != nil {
		return "{}", fmt.Errorf("failed to marshal config: %w", err)
	}

	return string(b), nil
}
