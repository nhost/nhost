package graph

import (
	"context"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) configs(
	ctx context.Context,
	resolve bool,
	where *model.ConfigConfigComparisonExp,
) ([]*model.ConfigAppConfig, error) {
	if err := r.ensureAllLoaded(ctx); err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx)

	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*model.ConfigAppConfig, 0, 10) //nolint:mnd

	var rangeErr error

	r.store.Range(func(_ string, app *App) bool {
		logger = logger.WithField("app", app.AppID)

		cfg, err := app.ResolveConfig(r.schema, false)
		if err != nil {
			logger.WithError(err).Error("could not resolve config")
			rangeErr = err

			return false
		}

		if where.Matches(cfg) {
			if !resolve {
				cfg = app.Config
			}

			res = append(res, &model.ConfigAppConfig{
				AppID:  app.AppID,
				Config: cfg,
			})
		}

		return true
	})

	if rangeErr != nil {
		return nil, rangeErr
	}

	return res, nil
}
