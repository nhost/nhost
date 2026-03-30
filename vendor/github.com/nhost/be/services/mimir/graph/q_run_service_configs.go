package graph

import (
	"context"
	"errors"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) ensureRunServiceConfigsLoaded(
	ctx context.Context, appID *string,
) ([]*model.ConfigRunServiceConfigWithID, error) {
	if appID != nil {
		err := r.ensureLoaded(ctx, *appID)
		if err == nil {
			return nil, nil
		}

		if errors.Is(err, ErrAppNotFound) {
			return make([]*model.ConfigRunServiceConfigWithID, 0), nil
		}

		return nil, err
	}

	if err := r.ensureAllLoaded(ctx); err != nil {
		return nil, err
	}

	return nil, nil
}

func (r *queryResolver) runServiceConfigs(
	ctx context.Context,
	appID *string,
	resolve bool,
	where *model.ConfigRunServiceConfigComparisonExp,
) ([]*model.ConfigRunServiceConfigWithID, error) {
	early, err := r.ensureRunServiceConfigsLoaded(ctx, appID)
	if early != nil || err != nil {
		return early, err
	}

	logger := nhcontext.LoggerFromContext(ctx)

	r.mu.RLock()
	defer r.mu.RUnlock()

	services := make([]*model.ConfigRunServiceConfigWithID, 0, 10) //nolint:mnd

	var rangeErr error

	r.store.Range(func(_ string, app *App) bool {
		if appID != nil && app.AppID != *appID {
			return true
		}

		for _, svc := range app.Services {
			logger = logger.WithField("service_id", svc.ServiceID)

			cfg, err := svc.ResolveConfig(r.schema, false, app.Secrets)
			if err != nil {
				logger.WithError(err).Error("could not resolve config")
				rangeErr = err

				return false
			}

			if where.Matches(cfg) {
				if !resolve {
					cfg = svc.Config
				}

				services = append(services, &model.ConfigRunServiceConfigWithID{
					ServiceID: svc.ServiceID,
					Config:    cfg,
				})
			}
		}

		return true
	})

	if rangeErr != nil {
		return nil, rangeErr
	}

	return services, nil
}
