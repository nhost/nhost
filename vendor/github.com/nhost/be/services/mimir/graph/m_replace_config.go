package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) replaceConfig(
	ctx context.Context,
	appID string,
	input model.ConfigConfigInsertInput,
) (*model.ConfigConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return nil, err
	}

	oldApp := r.data[i]
	newApp := &App{
		AppID:          oldApp.AppID,
		Config:         &model.ConfigConfig{}, //nolint:exhaustruct
		resolvedConfig: nil,
		SystemConfig:   oldApp.SystemConfig,
		Secrets:        oldApp.Secrets,
		Services:       oldApp.Services,
	}

	newApp.Config.Insert(&input)

	if _, err := newApp.ResolveConfig(r.schema, true); err != nil {
		return nil, err
	}

	if err := r.configValidate(ctx, oldApp, newApp); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.UpdateConfig(ctx, oldApp, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.resolvedConfig = newApp.resolvedConfig
	oldApp.Config = newApp.Config

	return oldApp.Config, nil
}
