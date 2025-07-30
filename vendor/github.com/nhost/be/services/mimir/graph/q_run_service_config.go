package graph

import (
	"context"
	"errors"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) runServiceConfig(
	_ context.Context,
	appID string,
	serviceID string,
	resolve bool,
) (*model.ConfigRunServiceConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	app := r.data[i]

	for _, service := range app.Services {
		if service.ServiceID == serviceID {
			cfg := service.Config
			if resolve {
				cfg, err = service.ResolveConfig(r.schema, false, app.Secrets)
				if err != nil {
					return nil, err
				}
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
