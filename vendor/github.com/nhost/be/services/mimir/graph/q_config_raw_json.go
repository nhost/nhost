package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) configRawJSON(
	_ context.Context,
	appID string,
	resolve bool,
) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var (
		cfg *model.ConfigConfig
		err error
	)

	for _, app := range r.data {
		if app.AppID == appID {
			if !resolve {
				cfg = app.Config
				break
			}

			cfg, err = app.ResolveConfig(r.schema, false)
			if err != nil {
				return "{}", err
			}

			break
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
