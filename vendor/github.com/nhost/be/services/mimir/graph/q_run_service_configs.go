package graph

import (
	"context"

	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) runServiceConfigs(
	ctx context.Context,
	appID *string,
	resolve bool,
	where *model.ConfigRunServiceConfigComparisonExp,
) ([]*model.ConfigRunServiceConfigWithID, error) {
	logger := nhcontext.LoggerFromContext(ctx)

	r.mu.RLock()
	defer r.mu.RUnlock()

	services := make([]*model.ConfigRunServiceConfigWithID, 0, 10) //nolint:mnd

	for _, app := range r.data {
		if appID != nil && app.AppID != *appID {
			continue
		}

		for _, svc := range app.Services {
			logger = logger.WithField("service_id", svc.ServiceID)

			cfg, err := svc.ResolveConfig(r.schema, false, app.Secrets)
			if err != nil {
				logger.WithError(err).Error("could not resolve config")
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
