package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) systemConfig(
	_ context.Context,
	appID string,
) (*model.ConfigSystemConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, app := range r.data {
		if app.AppID == appID {
			return app.SystemConfig, nil
		}
	}

	return nil, nil //nolint: nilnil
}
