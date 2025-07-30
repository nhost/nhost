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
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		// if the app is not found, we return nil, nil as there
		// isn't anything to delete
		if errors.Is(err, ErrAppNotFound) {
			return nil, nil //nolint: nilnil
		}

		return nil, err
	}

	oldApp := r.data[i]

	logger := nhcontext.LoggerFromContext(ctx).WithField("app_id", appID)
	for _, p := range r.plugins {
		if err := p.DeleteApp(ctx, oldApp, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	r.data = append(r.data[:i], r.data[i+1:]...)

	return oldApp.Config, nil
}
