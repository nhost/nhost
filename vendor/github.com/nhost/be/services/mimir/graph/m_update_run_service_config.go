package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) updateRunServiceConfig(
	ctx context.Context,
	appID string,
	serviceID string,
	input model.ConfigRunServiceConfigUpdateInput,
) (*model.ConfigRunServiceConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return nil, err
	}

	app := r.data[i]

	i, err = app.IndexService(serviceID)
	if err != nil {
		return nil, err
	}

	oldService := app.Services[i]

	if input.Name != nil {
		if err := nameMustBeUnique(app.Services, serviceID, *input.Name); err != nil {
			return nil, err
		}
	}

	newService := &Service{
		ServiceID:      oldService.ServiceID,
		Config:         oldService.Config.Clone(),
		resolvedConfig: oldService.resolvedConfig.Clone(),
	}

	newService.Config.Update(&input)

	if _, err := newService.ResolveConfig(r.schema, true, app.Secrets); err != nil {
		return nil, err
	}

	if err := r.runServiceConfigValidate(ctx, appID, oldService, newService); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("service_id", serviceID)
	for _, p := range r.plugins {
		if err := p.UpdateRunServiceConfig(ctx, appID, oldService, newService, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldService.resolvedConfig = newService.resolvedConfig
	oldService.Config = newService.Config

	return newService.Config, nil
}
