package graph

import (
	"context"
	"errors"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) deleteRunServiceConfig(
	ctx context.Context,
	appID string,
	serviceID string,
) (*model.ConfigRunServiceConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		// if the service is not found, we return nil, nil as there
		// isn't anything to delete
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	oldApp := r.data[i]

	i, err = oldApp.IndexService(serviceID)
	if err != nil {
		// if the service is not found, we return nil, nil as there
		// isn't anything to delete
		if errors.Is(err, ErrServiceNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	oldService := oldApp.Services[i]

	logger := nhcontext.LoggerFromContext(ctx).WithField("service_id", serviceID)
	for _, p := range r.plugins {
		if err := p.DeleteRunServiceConfig(ctx, appID, oldService, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.Services = append(oldApp.Services[:i], oldApp.Services[i+1:]...)

	return oldService.Config, nil
}
