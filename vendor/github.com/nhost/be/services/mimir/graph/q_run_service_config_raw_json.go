package graph

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

func (r *queryResolver) runServiceConfigRawJSON(
	ctx context.Context,
	appID string,
	serviceID string,
	resolve bool,
) (string, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return "{}", nil
		}

		return "{}", err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	cfg, err := r.runServiceConfigLocked(appID, serviceID, resolve)
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
