package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) insertSecret(
	ctx context.Context,
	appID string,
	input model.ConfigEnvironmentVariableInsertInput,
) (*model.ConfigEnvironmentVariable, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	oldApp, err := r.store.GetApp(appID)
	if err != nil {
		return nil, fmt.Errorf("failed to get app: %w", err)
	}

	newApp := &App{
		AppID:          oldApp.AppID,
		Config:         oldApp.Config,
		resolvedConfig: nil,
		SystemConfig:   oldApp.SystemConfig,
		Secrets:        oldApp.Secrets.Clone(),
		Services:       oldApp.Services.Clone(),
	}

	if _, err := newApp.IndexSecret(input.Name); err == nil {
		return nil, ErrSecretAlreadyExists
	}

	envVar := model.ConfigEnvironmentVariable(input)

	newApp.Secrets = append(newApp.Secrets, &envVar)

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.UpdateSecrets(ctx, oldApp, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.Secrets = newApp.Secrets

	return &envVar, nil
}
