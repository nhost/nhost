package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) runServiceConfigs(
	_ context.Context,
	appID *string,
	resolve bool,
	where *model.ConfigRunServiceConfigComparisonExp,
) ([]*model.ConfigRunServiceConfigWithID, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	services := make([]*model.ConfigRunServiceConfigWithID, 0, 10) //nolint:gomnd
	for _, app := range r.data {
		if appID != nil && app.AppID != *appID {
			continue
		}
		for _, svc := range app.Services {
			cfg, err := svc.ResolveConfig(r.schema, false, app.Secrets)
			if err != nil {
				return nil, err
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
	}

	return services, nil
}
