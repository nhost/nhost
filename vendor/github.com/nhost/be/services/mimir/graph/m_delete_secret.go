package graph

import (
	"context"
	"errors"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func (r *mutationResolver) deleteSecret(
	ctx context.Context,
	appID string,
	key string,
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
		Services:       oldApp.Services.Clone(),
	}

	j, err := newApp.IndexSecret(key)
	if err != nil {
		return nil, err
	}

	envVar := newApp.Secrets[j]

	newApp.Secrets = append(newApp.Secrets[:j], newApp.Secrets[j+1:]...)

	if _, err := newApp.ResolveConfig(r.schema, true); err != nil {
		errNotFound := &appconfig.VariableNotFoundError{} //nolint:exhaustruct
		if errors.As(err, &errNotFound) {
			return nil, NewVariableRequiredError(errNotFound.Name)
		}

		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.UpdateSecrets(ctx, oldApp, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.Secrets = newApp.Secrets

	return envVar, nil
}
