package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) systemConfigs(
	_ context.Context,
	where *model.ConfigSystemConfigComparisonExp,
) ([]*model.ConfigAppSystemConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*model.ConfigAppSystemConfig, 0, 10) //nolint:mnd

	for _, app := range r.data {
		cfg, err := app.ResolveSystemConfig(r.schema)
		if err != nil {
			return nil, err
		}

		if where.Matches(cfg) {
			res = append(res, &model.ConfigAppSystemConfig{
				AppID:        app.AppID,
				SystemConfig: app.SystemConfig,
			})
		}
	}

	return res, nil
}
