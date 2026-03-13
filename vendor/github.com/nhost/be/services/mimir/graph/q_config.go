package graph

import (
	"context"
	"errors"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) config(
	ctx context.Context,
	appID string,
	resolve bool,
) (*model.ConfigConfig, error) {
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
		// if the app is not found, we return nil, nil to
		// behave the same way that hasura does. Otherwise things
		// may break when the app is created for the first time
		// and the config object hasn't been created yet.
		return nil, nil //nolint: nilnil
	}

	if !resolve {
		return app.Config, nil
	}

	cfg, err := app.ResolveConfig(r.schema, false)
	if err != nil {
		return nil, err
	}

	return cfg, nil
}
