package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) updateSystemConfig(
	ctx context.Context,
	appID string,
	systemConfigInput model.ConfigSystemConfigUpdateInput,
) (*model.ConfigSystemConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return nil, err
	}

	oldApp := r.data[i]
	newApp := &App{
		AppID:          oldApp.AppID,
		Config:         oldApp.Config,
		resolvedConfig: nil,
		SystemConfig:   oldApp.SystemConfig.Clone(),
		Secrets:        oldApp.Secrets,
		Services:       oldApp.Services,
	}

	newApp.SystemConfig.Update(&systemConfigInput)

	if _, err := newApp.ResolveSystemConfig(r.schema); err != nil {
		return nil, err
	}

	if err := r.configValidate(ctx, oldApp, newApp); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.UpdateSystemConfig(ctx, oldApp, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.SystemConfig = newApp.SystemConfig

	return oldApp.SystemConfig, nil
}
