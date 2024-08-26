package graph

import (
	"context"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
)

func ptr[T any](v T) *T {
	return &v
}

func (r *mutationResolver) changeDatabaseVersion( //nolint:cyclop
	ctx context.Context, appID string, version string, force *bool,
) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return false, err
	}

	oldApp := r.data[i]
	skipCheck := force != nil && *force

	curVer := "14"
	if oldApp.SystemConfig.GetPostgres().GetMajorVersion() != nil {
		curVer = *oldApp.SystemConfig.GetPostgres().GetMajorVersion()
	}

	if !skipCheck && curVer >= version[:2] {
		return false, ErrDatabaseVersionMustBeGreater
	}

	newApp := &App{
		AppID:          oldApp.AppID,
		Config:         oldApp.Config.Clone(),
		resolvedConfig: nil,
		SystemConfig:   oldApp.SystemConfig,
		Secrets:        oldApp.Secrets,
		Services:       oldApp.Services,
	}

	newApp.Config.Postgres.Version = ptr(version)
	newApp.SystemConfig.Postgres.MajorVersion = ptr(version[:2])

	if _, err := newApp.ResolveConfig(r.schema, true); err != nil {
		return false, err
	}
	if _, err := newApp.ResolveSystemConfig(r.schema); err != nil {
		return false, err
	}

	if err := r.configValidate(oldApp, newApp); err != nil {
		return false, err
	}
	if err := newApp.ValidateConfig(r.schema); err != nil {
		return false, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.ChangeDatabaseVersion(ctx, oldApp, newApp, logger); err != nil {
			return false, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	oldApp.resolvedConfig = newApp.resolvedConfig
	oldApp.Config = newApp.Config
	oldApp.SystemConfig = newApp.SystemConfig

	return true, nil
}
