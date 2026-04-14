package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) replaceRunServiceConfig(
	ctx context.Context,
	appID string,
	serviceID string,
	input model.ConfigRunServiceConfigInsertInput,
) (*model.ConfigRunServiceConfig, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	app, err := r.store.GetApp(appID)
	if err != nil {
		return nil, fmt.Errorf("failed to get app: %w", err)
	}

	if err := nameMustBeUnique(app.Services, serviceID, input.Name); err != nil {
		return nil, err
	}

	i, err := app.IndexService(serviceID)
	if err != nil {
		return nil, err
	}

	oldService := app.Services[i]

	newService := &Service{
		ServiceID:      oldService.ServiceID,
		Config:         &model.ConfigRunServiceConfig{}, //nolint:exhaustruct
		resolvedConfig: nil,
	}
	newService.Config.Insert(&input)

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

	app.Services[i] = newService

	return newService.Config, nil
}
