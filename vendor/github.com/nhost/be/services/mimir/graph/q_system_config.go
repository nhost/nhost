package graph

import (
	"context"
	"errors"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) systemConfig(
	ctx context.Context,
	appID string,
) (*model.ConfigSystemConfig, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	app, err := r.store.GetApp(appID)
	if err != nil {
		return nil, nil //nolint: nilnil
	}

	return app.SystemConfig, nil
}
