package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) config(
	_ context.Context,
	appID string,
	resolve bool,
) (*model.ConfigConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, app := range r.data {
		if app.AppID == appID {
			if !resolve {
				return app.Config, nil
			}

			cfg, err := app.ResolveConfig(r.schema, false)
			if err != nil {
				return nil, err
			}

			return cfg, nil
		}
	}

	// if the app is not found, we return nil, nil to
	// behave the same way that hasura does. Otherwise things
	// may break when the app is created for the first time
	// and the config object hasn't been created yet.
	return nil, nil //nolint: nilnil
}
