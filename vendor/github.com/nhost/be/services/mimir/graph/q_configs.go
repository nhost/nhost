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
	logger := nhcontext.LoggerFromContext(ctx)

	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*model.ConfigAppConfig, 0, 10) //nolint:mnd

	for _, app := range r.data {
		logger = logger.WithField("app", app.AppID)

		cfg, err := app.ResolveConfig(r.schema, false)
		if err != nil {
			logger.WithError(err).Error("could not resolve config")
			return nil, err
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
	}

	return res, nil
}
