package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) runServiceConfigLocked(
	appID string,
	serviceID string,
	resolve bool,
) (*model.ConfigRunServiceConfig, error) {
	app, err := r.store.GetApp(appID)
	if err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, fmt.Errorf("failed to get app: %w", err)
	}

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

	// if the service is not found, we return nil, nil to
	// behave the same way that hasura does.
	return nil, nil //nolint: nilnil
}

func (r *queryResolver) runServiceConfig(
	ctx context.Context,
	appID string,
	serviceID string,
	resolve bool,
) (*model.ConfigRunServiceConfig, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.runServiceConfigLocked(appID, serviceID, resolve)
}
