package graph

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	nhcontext "github.com/nhost/be/lib/graphql/context"
)

func ptr[T any](v T) *T {
	return &v
}

func deptr[T any](v *T) T {
	if v == nil {
		return *new(T)
	}

	return *v
}

func (r *mutationResolver) changeDatabaseVersionValidate(
	ctx context.Context,
	oldApp *App,
	newApp *App,
) error {
	id, err := uuid.Parse(newApp.AppID)
	if err != nil {
		return fmt.Errorf("failed to parse app id: %w", err)
	}

	desiredState, err := r.nhost.GetAppDesiredState(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get app desired state: %w", err)
	}

	oldMajorVersion := deptr(oldApp.Config.Postgres.Version)[:3]

	newMajorVersion := deptr(newApp.Config.Postgres.Version)[:3]
	if oldMajorVersion >= newMajorVersion {
		return ErrDatabaseVersionMustBeGreater
	}

	if !slices.Contains([]int32{appLive, appEmpty}, desiredState) {
		return ErrAppMustBeLive
	}

	return nil
}

func (r *mutationResolver) changeDatabaseVersion(
	ctx context.Context, appID string, version string, force *bool,
) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return false, err
	}

	oldApp := r.data[i]
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

	if !deptr(force) {
		if err := r.changeDatabaseVersionValidate(ctx, oldApp, newApp); err != nil {
			return false, err
		}
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
