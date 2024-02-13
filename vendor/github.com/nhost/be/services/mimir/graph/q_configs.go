package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) configs(
	_ context.Context,
	resolve bool,
	where *model.ConfigConfigComparisonExp,
) ([]*model.ConfigAppConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*model.ConfigAppConfig, 0, 10) //nolint:gomnd
	for _, app := range r.data {
		cfg, err := app.ResolveConfig(r.schema, false)
		if err != nil {
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
