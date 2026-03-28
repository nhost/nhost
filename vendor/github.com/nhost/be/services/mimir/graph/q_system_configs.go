package graph

import (
	"context"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) systemConfigs(
	ctx context.Context,
	where *model.ConfigSystemConfigComparisonExp,
) ([]*model.ConfigAppSystemConfig, error) {
	if err := r.ensureAllLoaded(ctx); err != nil {
		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	logger := nhcontext.LoggerFromContext(ctx)

	res := make([]*model.ConfigAppSystemConfig, 0, 10) //nolint:mnd

	var rangeErr error

	r.store.Range(func(_ string, app *App) bool {
		cfg, err := app.ResolveSystemConfig(r.schema)
		if err != nil {
			logger.WithField("app", app.AppID).
				WithError(err).
				Error("could not resolve system config")
			rangeErr = err

			return false
		}

		if where.Matches(cfg) {
			res = append(res, &model.ConfigAppSystemConfig{
				AppID:        app.AppID,
				SystemConfig: app.SystemConfig,
			})
		}

		return true
	})

	if rangeErr != nil {
		return nil, rangeErr
	}

	return res, nil
}
