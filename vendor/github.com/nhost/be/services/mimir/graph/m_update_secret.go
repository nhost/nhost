package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) updateSecret(
	ctx context.Context,
	appID string,
	input model.ConfigEnvironmentVariableInsertInput,
) (*model.ConfigEnvironmentVariable, error) {
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
		SystemConfig:   oldApp.SystemConfig,
		Secrets:        oldApp.Secrets.Clone(),
		Services:       oldApp.Services,
	}

	j, err := newApp.IndexSecret(input.Name)
	if err != nil {
		return nil, err
	}

	newApp.Secrets[j].Value = input.Value

	if _, err := newApp.ResolveConfig(r.schema, true); err != nil {
		return nil, err
	}

	if err := r.configValidate(ctx, oldApp, newApp); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.UpdateSecrets(ctx, oldApp, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.resolvedConfig = newApp.resolvedConfig
	oldApp.Secrets = newApp.Secrets

	return newApp.Secrets[j], nil
}
