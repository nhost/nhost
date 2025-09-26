package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
)

func validateAndFillConfig(
	sch *schema.Schema,
	app *App,
) (*model.ConfigConfig, *model.ConfigSystemConfig, error) {
	if _, err := app.ResolveConfig(sch, true); err != nil {
		return nil, nil, err
	}

	config, err := sch.Fill(app.Config)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to validate config: %w", err)
	}

	systemConfig, err := sch.FillSystemConfig(app.SystemConfig)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid system config: %w", err)
	}

	return config, systemConfig, nil
}

func (r *mutationResolver) insertConfig(
	ctx context.Context,
	appID string,
	configInput model.ConfigConfigInsertInput,
	systemConfigInput model.ConfigSystemConfigInsertInput,
	secretsInput []*model.ConfigEnvironmentVariableInsertInput,
) (*model.ConfigInsertConfigResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, err := r.data.IndexApp(appID)
	if err == nil {
		return nil, ErrAppAlreadyExists
	}

	config := &model.ConfigConfig{} //nolint:exhaustruct
	config.Insert(&configInput)

	secrets := make([]*model.ConfigEnvironmentVariable, len(secretsInput))
	for i, secretInput := range secretsInput {
		secret := &model.ConfigEnvironmentVariable{} //nolint:exhaustruct
		secret.Insert(secretInput)
		secrets[i] = secret
	}

	systemConfig := &model.ConfigSystemConfig{} //nolint:exhaustruct
	systemConfig.Insert(&systemConfigInput)

	newApp := &App{
		AppID:          appID,
		Config:         config,
		resolvedConfig: nil,
		SystemConfig:   systemConfig,
		Secrets:        secrets,
		Services:       make(Services, 0),
	}

	config, systemConfig, err = validateAndFillConfig(r.schema, newApp)
	if err != nil {
		return nil, err
	}

	newApp.Config = config
	newApp.SystemConfig = systemConfig

	if err := r.configValidate(ctx, nil, newApp); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.CreateApp(ctx, newApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	r.data = append(r.data, newApp)

	return &model.ConfigInsertConfigResponse{
		Config:       newApp.Config,
		SystemConfig: newApp.SystemConfig,
		Secrets:      newApp.Secrets,
	}, nil
}
