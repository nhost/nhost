package graph

import (
	"context"
	"errors"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) appSecrets(
	ctx context.Context,
	appID string,
) ([]*model.ConfigEnvironmentVariable, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil
		}

		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	app, err := r.store.GetApp(appID)
	if err != nil {
		return nil, nil
	}

	return app.Secrets, nil
}
