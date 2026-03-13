package graph

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) configRawJSON(
	ctx context.Context,
	appID string,
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

	var (
		cfg *model.ConfigConfig
		err error
	)

	app, getErr := r.store.GetApp(appID)
	if getErr == nil {
		if !resolve {
			cfg = app.Config
		} else {
			cfg, err = app.ResolveConfig(r.schema, false)
			if err != nil {
				return "{}", err
			}
		}
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
