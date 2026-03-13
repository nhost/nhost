package graph

import (
	"context"
	"errors"
	"fmt"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) deleteConfig(
	ctx context.Context,
	appID string,
) (*model.ConfigConfig, error) {
	if err := r.ensureLoaded(ctx, appID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	oldApp, err := r.store.GetApp(appID)
	if err != nil {
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, fmt.Errorf("failed to get app: %w", err)
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.DeleteApp(ctx, oldApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	r.store.DeleteApp(appID)

	return oldApp.Config, nil
}
